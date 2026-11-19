// Runs the voting lifecycle against the Firestore emulator.
// Run with: npm run test:rules (the emulator is started for you; needs Java).

import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { initializeApp, deleteApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { runLifecycle } from "../functions/src/lifecycle.ts";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-12-10T12:00:00Z");
const ago = (days: number) => new Date(now.getTime() - days * DAY);

let app: App;
let db: Firestore;

before(async () => {
  // Uses the emulator started by `firebase emulators:exec` (FIRESTORE_EMULATOR_HOST).
  assert.ok(process.env.FIRESTORE_EMULATOR_HOST, "run this through npm run test:rules");
  app = initializeApp({ projectId: "demo-tavernfire-lifecycle" }, "lifecycle-test");
  db = getFirestore(app);
});

after(async () => {
  await deleteApp(app);
});

async function clear() {
  for (const col of ["requests", "entries", "users"]) {
    await db.recursiveDelete(db.collection(col));
  }
}

async function seedRequest(id: string, createdDaysAgo: number, extra: Record<string, unknown> = {}) {
  await db.collection("requests").doc(id).set({
    sparks: ["Marsh", "Bell", "Quiet"],
    kind: "location",
    requesterId: "owner",
    requesterName: "Owner",
    status: "open",
    moderation: "ok",
    answerCount: 0,
    createdAt: ago(createdDaysAgo),
    ...extra,
  });
}

/** An entry plus the private marker that records who wrote it. */
async function seedEntry(requestId: string, entryId: string, authorId: string, name: string | null) {
  await db.collection("entries").doc(entryId).set({
    requestId,
    kind: "location",
    name: `Entry ${entryId}`,
    concept: "Something.",
    moderation: "ok",
    createdAt: ago(4),
  });
  await db.collection("requests").doc(requestId).collection("answerLocks").doc(authorId).set({
    authorId,
    requestId,
    entryId,
    createdAt: ago(4),
  });
  await db.collection("users").doc(authorId).set({ displayName: name, createdAt: ago(30) });
}

async function seedBallot(requestId: string, voter: string, picks: string[]) {
  await db.collection("requests").doc(requestId).collection("ballots").doc(voter).set({
    voterId: voter,
    requestId,
    picks,
    updatedAt: ago(1),
  });
}

const get = async (path: string) => (await db.doc(path).get()).data() ?? {};

describe("runLifecycle (emulator)", () => {
  test("a young request is left alone", async () => {
    await clear();
    await seedRequest("young", 1);
    const report = await runLifecycle(db, now);
    assert.equal(report.errors, 0);
    assert.equal((await get("requests/young")).status, "open");
  });

  test("after 3 days a request with several entries moves to voting", async () => {
    await clear();
    await seedRequest("r", 4);
    await seedEntry("r", "e1", "a1", "Ann");
    await seedEntry("r", "e2", "a2", "Bo");
    const report = await runLifecycle(db, now);
    assert.equal(report.markedVoting, 1);
    assert.equal((await get("requests/r")).status, "voting");
    // Authors stay hidden during voting.
    assert.equal((await get("entries/e1")).authorId, undefined);
  });

  test("after 5 days the picks are counted and the authors are shown", async () => {
    await clear();
    await seedRequest("r", 6, { status: "voting" });
    await seedEntry("r", "e1", "a1", "Ann");
    await seedEntry("r", "e2", "a2", "Bo");
    await seedEntry("r", "e3", "a3", null);
    await seedBallot("r", "v1", ["e1"]);
    await seedBallot("r", "v2", ["e1", "e2"]);
    await seedBallot("r", "v3", ["e1", "e3"]);
    await seedBallot("r", "v4", []);

    const report = await runLifecycle(db, now);
    assert.equal(report.errors, 0);
    assert.equal(report.revealed, 1);

    const request = await get("requests/r");
    assert.equal(request.status, "revealed");
    assert.equal(request.ballotCount, 3);
    assert.equal(request.ballotsDeleted, false);

    const e1 = await get("entries/e1");
    assert.equal(e1.authorId, "a1");
    assert.equal(e1.authorName, "Ann");
    assert.deepEqual(
      { picks: e1.result.picks, rank: e1.result.rank, favourite: e1.result.favourite, order: e1.result.order },
      { picks: 3, rank: 1, favourite: true, order: 0 },
    );
    const e2 = await get("entries/e2");
    assert.equal(e2.result.picks, 1);
    assert.equal(e2.result.rank, 2);
    // e2 and e3 share second place; e1 stands alone.
    assert.equal(e2.result.tied, true);
    assert.equal(e1.result.tied, false);
    assert.equal((await get("entries/e3")).authorName, null);
  });

  test("a single entry is revealed at day 3 without ranks", async () => {
    await clear();
    await seedRequest("r", 3.5);
    await seedEntry("r", "e1", "a1", "Ann");
    const report = await runLifecycle(db, now);
    assert.equal(report.revealed, 1);
    assert.equal((await get("requests/r")).status, "revealed");
    const e1 = await get("entries/e1");
    assert.equal(e1.authorName, "Ann");
    assert.equal(e1.result.rank, null);
  });

  test("a request with no entries is closed", async () => {
    await clear();
    await seedRequest("r", 3.5);
    const report = await runLifecycle(db, now);
    assert.equal(report.closed, 1);
    assert.equal((await get("requests/r")).status, "closed");
  });

  test("a hidden request is not touched", async () => {
    await clear();
    await seedRequest("r", 6, { moderation: "hidden" });
    await seedEntry("r", "e1", "a1", "Ann");
    await seedEntry("r", "e2", "a2", "Bo");
    await runLifecycle(db, now);
    assert.equal((await get("requests/r")).status, "open");
  });

  test("ballots are deleted 7 days after the reveal, and running again changes nothing", async () => {
    await clear();
    await seedRequest("old", 14, { status: "revealed", revealedAt: ago(8), ballotsDeleted: false });
    await seedRequest("fresh", 9, { status: "revealed", revealedAt: ago(2), ballotsDeleted: false });
    await seedBallot("old", "v1", ["x"]);
    await seedBallot("fresh", "v1", ["x"]);

    const report = await runLifecycle(db, now);
    assert.equal(report.ballotsCleared, 1);
    assert.equal((await db.collection("requests/old/ballots").get()).size, 0);
    assert.equal((await get("requests/old")).ballotsDeleted, true);
    assert.equal((await db.collection("requests/fresh/ballots").get()).size, 1);

    const again = await runLifecycle(db, now);
    assert.equal(again.ballotsCleared, 0);
  });
});
