"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { collection, doc, onSnapshot, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { useNow } from "@/lib/use-now";
import {
  answerMarkerPath,
  ENTRY_EDIT_WINDOW_HOURS,
  editableUntil,
  orderForViewer,
  orderRevealed,
  rankLabel,
  toEntryItem,
  type EntryItem,
} from "@/lib/entries";
import { answersCloseAt, requestPhase, votingClosesAt, type RequestItem } from "@/lib/requests";
import { MAX_PICKS, ballotPath, togglePick } from "@/lib/ballots";
import AnswerForm from "@/components/AnswerForm";
import EntryCard from "@/components/EntryCard";

// The answer form can be switched off with NEXT_PUBLIC_ENABLE_ANSWERS=false
// (for example on a deploy whose rules haven't been published yet).
const ANSWERS_ENABLED = process.env.NEXT_PUBLIC_ENABLE_ANSWERS !== "false";
// Picking favourites can be switched off the same way
// (NEXT_PUBLIC_ENABLE_VOTING=false). Keep it off on a live deploy until the
// results and reveal ship.
const VOTING_ENABLED = process.env.NEXT_PUBLIC_ENABLE_VOTING !== "false";

export default function Answers({ request }: { request: RequestItem }) {
  const { user, loading, emailVerified, resendVerification, refreshVerification } = useAuth();
  const now = useNow();
  const uid = user?.uid ?? null;

  const [entries, setEntries] = useState<EntryItem[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [myEntryId, setMyEntryId] = useState<string | null>(null);
  const [reportedIds, setReportedIds] = useState<Set<string>>(new Set());
  // My picks for this request (null until the first read), and the state of saving them.
  const [picks, setPicks] = useState<string[] | null>(null);
  const [pickBusy, setPickBusy] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [verifyNote, setVerifyNote] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [alreadyAnswered, setAlreadyAnswered] = useState(false);
  // True once an attempt has failed on this page, so the "didn't finish" notice
  // (meant for a returning visitor) does not repeat the form's own message.
  const [failedHere, setFailedHere] = useState(false);
  // Random order that stays fixed for this viewer while the page is open.
  const orderKeys = useRef(new Map<string, number>());

  useEffect(() => {
    return onSnapshot(
      query(
        collection(getDb(), "entries"),
        where("requestId", "==", request.id),
        where("moderation", "==", "ok"),
      ),
      (snap) => {
        const items = snap.docs
          .map((d) => toEntryItem(d.id, d.data({ serverTimestamps: "estimate" })))
          .filter((e): e is EntryItem => e !== null);
        setEntries(orderForViewer(items, orderKeys.current));
        setLoadError(false);
      },
      (err) => {
        console.error("Could not load entries", err);
        setLoadError(true);
      },
    );
  }, [request.id]);

  // My private answer marker, if any. Only I can read it, so nobody else's
  // authorship shows. It names my entry id.
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      doc(getDb(), ...answerMarkerPath(request.id, uid)),
      (snap) => setMyEntryId(snap.exists() ? (snap.get("entryId") as string) : null),
      (err) => console.error("Could not check your entry", err),
    );
  }, [request.id, uid]);

  // My private ballot, if any. Only I can read it.
  useEffect(() => {
    if (!uid || !VOTING_ENABLED) return;
    return onSnapshot(
      doc(getDb(), ballotPath(request.id, uid)),
      (snap) => {
        const stored = snap.get("picks");
        setPicks(Array.isArray(stored) ? stored.filter((p): p is string => typeof p === "string") : []);
      },
      (err) => console.error("Could not load your picks", err),
    );
  }, [request.id, uid]);

  // Entries I have already reported.
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      query(collection(getDb(), "reports"), where("reporterId", "==", uid)),
      (snap) => setReportedIds(new Set(snap.docs.map((d) => d.get("entryId") as string))),
      (err) => console.error("Could not load your reports", err),
    );
  }, [uid]);

  const signedInUid = loading ? null : uid;
  const markedEntryId = signedInUid ? myEntryId : null;
  const list = entries ?? [];
  // My entry exists once it shows up in the list; the marker alone means an
  // earlier attempt saved the marker but not the entry.
  const mine = markedEntryId && list.some((e) => e.id === markedEntryId) ? markedEntryId : null;
  const unfinished = markedEntryId !== null && mine === null && entries !== null;
  const isRequester = signedInUid !== null && signedInUid === request.requesterId;
  const closeAt = answersCloseAt(request.createdAt);
  const closed = now.getTime() > 0 && now >= closeAt;
  const phase = now.getTime() > 0 ? requestPhase(request.createdAt, now) : "answering";
  const ended = phase === "ended";
  // Voting needs at least two entries; with one, the author is simply revealed at day 3.
  const revealed = request.status === "revealed";
  const votingOpen = VOTING_ENABLED && !ended && !revealed && list.length >= 2;
  const validPicks = (picks ?? []).filter((id) => list.some((e) => e.id === id));
  const canPick = votingOpen && signedInUid !== null && emailVerified && picks !== null;

  async function toggle(entryId: string) {
    if (!signedInUid) return;
    const next = togglePick(validPicks, entryId);
    if (!next) return;
    setPickBusy(true);
    setPickError(null);
    try {
      await setDoc(doc(getDb(), ballotPath(request.id, signedInUid)), {
        voterId: signedInUid,
        requestId: request.id,
        picks: next,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error("Could not save picks", err);
      setPickError("Couldn't save your pick. Check your connection and try again.");
    } finally {
      setPickBusy(false);
    }
  }

  async function checkVerified() {
    setVerifyBusy(true);
    setVerifyNote(null);
    try {
      const ok = await refreshVerification();
      if (!ok) setVerifyNote("We can't see that it's verified yet. Open the link in the email, then try again.");
    } catch {
      setVerifyNote("Couldn't check just now. Try again in a moment.");
    } finally {
      setVerifyBusy(false);
    }
  }

  async function resend() {
    setVerifyBusy(true);
    setVerifyNote(null);
    try {
      await resendVerification();
      setVerifyNote("Sent. Check your inbox and spam folder.");
    } catch {
      setVerifyNote("Couldn't send it just now. Wait a minute and try again.");
    } finally {
      setVerifyBusy(false);
    }
  }
  // After the reveal, entries follow the order the results function stored.
  // Before it, yours first and the rest in a random order.
  const shown = revealed
    ? orderRevealed(list)
    : mine
      ? [...list.filter((e) => e.id === mine), ...list.filter((e) => e.id !== mine)]
      : list;
  const rankedResults = revealed && list.some((e) => e.reveal?.rank != null);
  // How many entries share each rank, so ties read "Joint 2nd".
  const sharedRanks = new Map<number, number>();
  for (const e of list) {
    const rank = e.reveal?.rank;
    if (rank != null) sharedRanks.set(rank, (sharedRanks.get(rank) ?? 0) + 1);
  }
  const voters = request.ballotCount ?? 0;
  const resultsNote =
    list.length === 1
      ? "This request had one answer, so there was nothing to vote on."
      : rankedResults
        ? `Voting has ended. ${voters} ${voters === 1 ? "person" : "people"} picked favourites.`
        : voters === 0
          ? "Voting has ended. Nobody picked favourites, so the answers stay in a random order."
          : `Voting has ended. Only ${voters} ${voters === 1 ? "person" : "people"} picked favourites, too few to rank the answers, so they stay in a random order.`;

  // What sits above the entries: the form, a prompt to write, or a reason there is none.
  let action;
  let showingForm = false;
  if (!ANSWERS_ENABLED) {
    action = null;
  } else if (loading) {
    action = null;
  } else if (revealed) {
    action = (
      <p className="notice notice-plain" role="status">
        {resultsNote}
      </p>
    );
  } else if (closed) {
    action = (
      <p className="notice notice-plain">
        {entries !== null && entries.length === 0
          ? "This request closed without any answers."
          : ended && VOTING_ENABLED
            ? "Voting has ended. Results are being counted."
            : VOTING_ENABLED && list.length >= 2
              ? `Answers have closed. Voting is open until ${votingClosesAt(request.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "long" })}.`
              : "Answers for this request have closed. Voting is coming soon."}
      </p>
    );
  } else if (!user) {
    action = (
      <p className="answers-prompt">
        <Link className="btn btn-primary" href="/signin">
          Sign in to answer
        </Link>
      </p>
    );
  } else if (isRequester) {
    action = (
      <p className="notice notice-plain">
        This is your request, so you can&apos;t answer it.
        {list.length === 0 && " Answers will appear here."}
      </p>
    );
  } else if (mine) {
    // Their entry is pinned at the top, marked "Your entry".
    action = alreadyAnswered ? (
      <p className="notice notice-plain" role="status">
        You&apos;ve already answered this request. Your entry is below.
      </p>
    ) : justSubmitted ? (
      <p className="notice notice-success" role="status">
        <span className="notice-title">Your answer is in.</span> You can edit
        it for up to {ENTRY_EDIT_WINDOW_HOURS} hours, or until answers close.
      </p>
    ) : null;
  } else if (entries !== null && (unfinished || entries.length === 0 || formOpen)) {
    // One form in one place, so what the person typed survives a failed attempt
    // (a failed second write makes the private marker appear, which would
    // otherwise swap the form for a new, empty one).
    showingForm = true;
    action = (
      <>
        {unfinished && !failedHere && (
          <p className="notice notice-warn" role="status">
            Your last answer didn&apos;t finish saving. Please send it again.
          </p>
        )}
        <AnswerForm
          key="new-answer"
          request={request}
          resumeEntryId={markedEntryId}
          onCancel={entries.length > 0 && !unfinished ? () => setFormOpen(false) : undefined}
          onSubmitted={() => setJustSubmitted(true)}
          onAlreadyAnswered={() => setAlreadyAnswered(true)}
          onFailed={() => setFailedHere(true)}
        />
      </>
    );
  } else if (entries !== null) {
    action = (
      <p className="answers-prompt">
        <button type="button" className="btn btn-primary" onClick={() => setFormOpen(true)}>
          Write an answer
        </button>
      </p>
    );
  }

  return (
    <section className="answers" aria-labelledby="answers-title">
      <div className="answers-head">
        <h2 id="answers-title" className="section-title">
          Answers
        </h2>
        {entries !== null && entries.length > 0 && (
          <p className="muted answers-count" role="status">
            {entries.length} {entries.length === 1 ? "answer" : "answers"}
            {entries.length > 1 &&
              (revealed
                ? rankedResults
                  ? ", ranked by favourites"
                  : ", in random order"
                : mine
                  ? ", yours first, the rest in random order"
                  : ", in random order")}
          </p>
        )}
      </div>

      {loadError ? (
        <p className="empty" role="alert">
          Couldn&apos;t load the answers. Check your connection and refresh.
        </p>
      ) : entries === null ? (
        <p className="muted" role="status">
          Loading answers…
        </p>
      ) : (
        <>
          {action}
          {entries.length === 0 && !showingForm && !isRequester && !closed && (
            <p className="empty">
              No answers yet. Entries written for these three sparks will appear here.
            </p>
          )}
          {votingOpen && !loading && (
            <div className="voting-bar">
              {!user ? (
                <p className="notice notice-plain">
                  <Link href="/signin">Sign in</Link> to pick up to {MAX_PICKS} favourites.
                </p>
              ) : !emailVerified ? (
                <div className="notice notice-warn" role="status">
                  <p className="notice-title">Verify your email to pick favourites</p>
                  <p>
                    We sent a link to {user.email ?? "your email"}. Open it, then come back here.
                  </p>
                  <div className="notice-actions">
                    <button type="button" className="btn btn-outline" onClick={checkVerified} disabled={verifyBusy}>
                      I&apos;ve verified it
                    </button>
                    <button type="button" className="btn btn-outline" onClick={resend} disabled={verifyBusy}>
                      Send the link again
                    </button>
                  </div>
                  {verifyNote && <p role="status">{verifyNote}</p>}
                </div>
              ) : (
                <p className="notice notice-plain" role="status">
                  Your picks: {validPicks.length} of {MAX_PICKS}. Pick up to {MAX_PICKS} favourites; nobody
                  sees them until voting ends.
                </p>
              )}
              {pickError && (
                <p className="error" role="alert">
                  {pickError}
                </p>
              )}
            </div>
          )}
          {shown.length > 0 && (
            <ul className="entry-list">
              {shown.map((e) => (
                <li key={e.id}>
                  <EntryCard
                    entry={e}
                    isMine={e.id === mine}
                    reported={reportedIds.has(e.id)}
                    now={now}
                    editUntil={e.id === mine ? editableUntil(e, closeAt) : null}
                    answersClosed={closed}
                    result={
                      revealed && e.reveal
                        ? {
                            rankText:
                              e.reveal.rank != null
                                ? rankLabel(e.reveal.rank, (sharedRanks.get(e.reveal.rank) ?? 1) > 1)
                                : null,
                            picks: e.reveal.picks,
                            favourite: e.reveal.favourite,
                            authorName: e.reveal.authorName,
                          }
                        : undefined
                    }
                    voting={
                      canPick
                        ? {
                            picked: validPicks.includes(e.id),
                            atCap: validPicks.length >= MAX_PICKS,
                            busy: pickBusy,
                            onToggle: () => void toggle(e.id),
                          }
                        : undefined
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
