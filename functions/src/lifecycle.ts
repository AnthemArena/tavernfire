// The voting lifecycle: decides what should happen to each request and applies it.
//
// Timeline (from the request's createdAt):
//   0 to 3 days   status "open": answers and picks are open.
//   3 to 5 days   status "voting": answers closed, picks still open.
//   after 5 days  status "revealed": picks counted, authors shown, ranks stored.
// Small requests skip ahead: no entries means "closed"; a single entry is
// revealed at day 3 (there is nothing to vote on).
// Seven days after the reveal, the private ballots are deleted.
//
// decide() is pure (no database) so it can be unit-tested. runLifecycle() does the
// reading and writing. It only imports types from firebase-admin so the same file
// can run in the Cloud Function and in the emulator tests.

import type { DocumentData, Firestore } from "firebase-admin/firestore";
import { cleanBallot, rankEntries, type RankedEntry } from "./ranking.ts";

// Keep these in step with ANSWER_WINDOW_DAYS and VOTING_WINDOW_DAYS in
// src/lib/requests.ts (a unit test compares them).
export const ANSWER_WINDOW_DAYS = 3;
export const VOTING_WINDOW_DAYS = 5;
/** Ballots are deleted this long after the reveal. */
export const BALLOT_KEEP_DAYS = 7;

const DAY = 24 * 60 * 60 * 1000;
const BATCH_SIZE = 400;

export type Action =
  | "none"
  | "mark-voting"
  | "close-empty"
  | "reveal-single"
  | "tally"
  | "delete-ballots";

export type Snapshot = {
  createdAt: Date;
  status: string | undefined;
  revealedAt: Date | null;
  ballotsDeleted: boolean;
  /** Visible entries (moderation "ok") answering this request. */
  entryCount: number;
};

export function decide(s: Snapshot, now: Date): Action {
  const t = now.getTime();

  if (s.status === "revealed" || s.status === "closed") {
    const ready = s.revealedAt !== null && t >= s.revealedAt.getTime() + BALLOT_KEEP_DAYS * DAY;
    return !s.ballotsDeleted && ready ? "delete-ballots" : "none";
  }

  const created = s.createdAt.getTime();
  if (t < created + ANSWER_WINDOW_DAYS * DAY) return "none";
  if (s.entryCount === 0) return "close-empty";
  if (s.entryCount === 1) return "reveal-single";
  if (t < created + VOTING_WINDOW_DAYS * DAY) {
    return s.status === "voting" ? "none" : "mark-voting";
  }
  return "tally";
}

export type Results = {
  ranked: RankedEntry[];
  /** People who picked at least one valid entry. */
  ballotCount: number;
};

/** Rank the entries from the ballots. Picks of unknown or hidden entries are ignored. */
export function buildResults(requestId: string, entryIds: string[], ballots: string[][]): Results {
  const known = new Set(entryIds);
  const ballotCount = ballots.filter((b) => cleanBallot(b, known).length > 0).length;
  return { ranked: rankEntries(requestId, entryIds, ballots), ballotCount };
}

export type Report = {
  checked: number;
  markedVoting: number;
  closed: number;
  revealed: number;
  ballotsCleared: number;
  errors: number;
};

function toDate(value: unknown): Date | null {
  const v = value as { toDate?: () => Date } | null | undefined;
  return typeof v?.toDate === "function" ? v.toDate() : null;
}

/** Run one pass over every request that needs attention. Safe to run repeatedly. */
export async function runLifecycle(db: Firestore, now: Date): Promise<Report> {
  const report: Report = {
    checked: 0,
    markedVoting: 0,
    closed: 0,
    revealed: 0,
    ballotsCleared: 0,
    errors: 0,
  };

  // Requests still open or voting whose answer window has ended.
  const due = await db
    .collection("requests")
    .where("status", "in", ["open", "voting"])
    .where("createdAt", "<=", new Date(now.getTime() - ANSWER_WINDOW_DAYS * DAY))
    .get();
  // Finished requests that still have ballots to clear.
  const finished = await db
    .collection("requests")
    .where("status", "in", ["revealed", "closed"])
    .where("ballotsDeleted", "==", false)
    .get();

  for (const doc of [...due.docs, ...finished.docs]) {
    report.checked++;
    try {
      await processRequest(db, doc.id, doc.data(), now, report);
    } catch (err) {
      report.errors++;
      console.error(`Lifecycle failed for request ${doc.id}`, err);
    }
  }
  return report;
}

async function visibleEntryIds(db: Firestore, requestId: string): Promise<string[]> {
  const snap = await db.collection("entries").where("requestId", "==", requestId).get();
  return snap.docs.filter((d) => d.get("moderation") === "ok").map((d) => d.id);
}

async function processRequest(
  db: Firestore,
  requestId: string,
  data: DocumentData,
  now: Date,
  report: Report,
): Promise<void> {
  // A hidden request is left alone until a moderator restores it.
  if (data.moderation !== "ok") return;
  const createdAt = toDate(data.createdAt);
  if (!createdAt) return;

  const finished = data.status === "revealed" || data.status === "closed";
  const entryIds = finished ? [] : await visibleEntryIds(db, requestId);

  const action = decide(
    {
      createdAt,
      status: typeof data.status === "string" ? data.status : undefined,
      revealedAt: toDate(data.revealedAt),
      ballotsDeleted: data.ballotsDeleted === true,
      entryCount: entryIds.length,
    },
    now,
  );

  const requestRef = db.collection("requests").doc(requestId);
  switch (action) {
    case "none":
      return;
    case "mark-voting":
      await requestRef.update({ status: "voting" });
      report.markedVoting++;
      return;
    case "close-empty":
      await requestRef.update({
        status: "closed",
        revealedAt: now,
        ballotCount: 0,
        ballotsDeleted: false,
      });
      report.closed++;
      return;
    case "reveal-single":
      await reveal(db, requestId, buildResults(requestId, entryIds, []), now);
      report.revealed++;
      return;
    case "tally": {
      const ballots = await db.collection("requests").doc(requestId).collection("ballots").get();
      const picks = ballots.docs.map((b) => {
        const p = b.get("picks");
        return Array.isArray(p) ? p.filter((x): x is string => typeof x === "string") : [];
      });
      await reveal(db, requestId, buildResults(requestId, entryIds, picks), now);
      report.revealed++;
      return;
    }
    case "delete-ballots": {
      await deleteBallots(db, requestId);
      await requestRef.update({ ballotsDeleted: true });
      report.ballotsCleared++;
      return;
    }
  }
}

/**
 * Show the authors and store the results. Each entry gets its author, the name
 * they had at this moment, and { picks, rank, favourite, order }. Running it twice
 * gives the same answer, so a failed run can simply be retried.
 */
async function reveal(db: Firestore, requestId: string, results: Results, now: Date): Promise<void> {
  const locks = await db.collection("requests").doc(requestId).collection("answerLocks").get();
  const authorOf = new Map<string, string>();
  for (const lock of locks.docs) {
    const entryId = lock.get("entryId");
    const authorId = lock.get("authorId");
    if (typeof entryId === "string" && typeof authorId === "string") authorOf.set(entryId, authorId);
  }

  const authorIds = [...new Set(authorOf.values())];
  const nameOf = new Map<string, string | null>();
  if (authorIds.length > 0) {
    const profiles = await db.getAll(...authorIds.map((id) => db.collection("users").doc(id)));
    for (const p of profiles) {
      const name = p.get("displayName");
      nameOf.set(p.id, typeof name === "string" ? name : null);
    }
  }

  for (let i = 0; i < results.ranked.length; i += BATCH_SIZE) {
    const batch = db.batch();
    results.ranked.slice(i, i + BATCH_SIZE).forEach((r, j) => {
      const authorId = authorOf.get(r.entryId) ?? null;
      batch.update(db.collection("entries").doc(r.entryId), {
        authorId,
        authorName: authorId ? (nameOf.get(authorId) ?? null) : null,
        result: {
          picks: r.picks,
          rank: r.rank,
          favourite: r.favourite,
          // True when another entry shares this rank ("Joint 2nd").
          tied: r.rank !== null && results.ranked.some((o) => o.entryId !== r.entryId && o.rank === r.rank),
          order: i + j,
        },
        revealedAt: now,
      });
    });
    await batch.commit();
  }

  // Last, so a half-finished reveal is retried on the next run.
  await db.collection("requests").doc(requestId).update({
    status: "revealed",
    revealedAt: now,
    ballotCount: results.ballotCount,
    ballotsDeleted: false,
  });
}

async function deleteBallots(db: Firestore, requestId: string): Promise<void> {
  const ballots = await db.collection("requests").doc(requestId).collection("ballots").get();
  for (let i = 0; i < ballots.docs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    ballots.docs.slice(i, i + BATCH_SIZE).forEach((b) => batch.delete(b.ref));
    await batch.commit();
  }
}
