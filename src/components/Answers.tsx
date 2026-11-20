"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signInHref } from "@/lib/next-path";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { useNow } from "@/lib/use-now";
import {
  answerMarkerPath,
  ENTRY_EDIT_WINDOW_HOURS,
  editableUntil,
  toEntryItem,
  type EntryItem,
} from "@/lib/entries";
import type { RequestItem } from "@/lib/requests";
import { shownUpvotes, sortAnswers, upvoteId, type AnswerSort, type PendingUpvote } from "@/lib/upvotes";
import VerifyEmailNotice from "@/components/VerifyEmailNotice";
import AnswerForm from "@/components/AnswerForm";
import EntryCard from "@/components/EntryCard";

// The answer form can be switched off with NEXT_PUBLIC_ENABLE_ANSWERS=false
// (for example on a deploy whose rules haven't been published yet).
const ANSWERS_ENABLED = process.env.NEXT_PUBLIC_ENABLE_ANSWERS !== "false";

/** The answers to a fire. Fires stay open, so anyone signed in can answer at any time. */
export default function Answers({ request }: { request: RequestItem }) {
  const { user, loading, emailVerified } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const now = useNow();
  const uid = user?.uid ?? null;

  const [entries, setEntries] = useState<EntryItem[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [myEntryId, setMyEntryId] = useState<string | null>(null);
  const [reportedIds, setReportedIds] = useState<Set<string>>(new Set());
  const [formOpen, setFormOpen] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [alreadyAnswered, setAlreadyAnswered] = useState(false);
  // True once an attempt has failed on this page, so the "didn't finish" notice
  // (meant for a returning visitor) does not repeat the form's own message.
  const [failedHere, setFailedHere] = useState(false);
  const [sort, setSort] = useState<AnswerSort>("top");
  // The answers this person has upvoted on this fire, and changes still saving.
  const [myUpvotes, setMyUpvotes] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Record<string, PendingUpvote>>({});
  const [needVerify, setNeedVerify] = useState(false);
  const [upvoteError, setUpvoteError] = useState<string | null>(null);

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
        setEntries(items);
        setLoadError(false);
      },
      (err) => {
        console.error("Could not load entries", err);
        setLoadError(true);
      },
    );
  }, [request.id]);

  // My private answer marker, if any. Only I can read it. It names my entry id.
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      doc(getDb(), ...answerMarkerPath(request.id, uid)),
      (snap) => setMyEntryId(snap.exists() ? (snap.get("entryId") as string) : null),
      (err) => console.error("Could not check your entry", err),
    );
  }, [request.id, uid]);

  // The answers I have upvoted on this fire. Only I can read these.
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      query(
        collection(getDb(), "upvotes"),
        where("voterId", "==", uid),
        where("requestId", "==", request.id),
      ),
      (snap) => setMyUpvotes(new Set(snap.docs.map((d) => d.get("entryId") as string))),
      (err) => console.error("Could not load your upvotes", err),
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

  const countOf = (e: EntryItem) => shownUpvotes(e.upvoteCount, pending[e.id]);
  const shown = sortAnswers(list, sort, countOf);

  async function toggleUpvote(entry: EntryItem) {
    if (!user) {
      router.push(signInHref(pathname));
      return;
    }
    if (!emailVerified) {
      setNeedVerify(true);
      return;
    }
    const has = myUpvotes.has(entry.id);
    setUpvoteError(null);
    setPending((p) => ({ ...p, [entry.id]: { delta: has ? -1 : 1, base: entry.upvoteCount } }));
    try {
      const ref = doc(getDb(), "upvotes", upvoteId(entry.id, user.uid));
      if (has) {
        await deleteDoc(ref);
      } else {
        await setDoc(ref, {
          entryId: entry.id,
          requestId: request.id,
          voterId: user.uid,
          createdAt: serverTimestamp(),
        });
      }
    } catch (err) {
      console.error("Could not save upvote", err);
      setPending((p) => {
        const rest = { ...p };
        delete rest[entry.id];
        return rest;
      });
      setUpvoteError("Couldn't save your upvote. Check your connection and try again.");
    }
  }

  // What sits above the entries: the form, a prompt to write, or a reason there is none.
  let action;
  let showingForm = false;
  if (!ANSWERS_ENABLED) {
    action = null;
  } else if (loading) {
    action = null;
  } else if (!user) {
    action = (
      <p className="answers-prompt">
        <Link className="btn btn-primary" href={signInHref(pathname)}>
          Sign in to answer
        </Link>
        <span className="answers-prompt-note">You can also stoke fires and upvote answers once you are signed in.</span>
      </p>
    );
  } else if (isRequester) {
    action = (
      <p className="notice notice-plain">
        {list.length === 0 && "No answers yet. "}This is your fire, so you can&apos;t answer it.
      </p>
    );
  } else if (mine) {
    // Their entry is pinned at the top, marked "Your answer".
    action = alreadyAnswered ? (
      <p className="notice notice-plain" role="status">
        You&apos;ve already answered this fire. Your answer is below.
      </p>
    ) : justSubmitted ? (
      <p className="notice notice-success" role="status">
        <span className="notice-title">Your answer is in.</span> You can edit
        it for up to {ENTRY_EDIT_WINDOW_HOURS} hours.
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
          </p>
        )}
      </div>
      {entries !== null && entries.length > 1 && (
        <div className="tabs" role="group" aria-label="Sort answers">
          <button type="button" className="tab" aria-pressed={sort === "top"} onClick={() => setSort("top")}>
            Top
          </button>
          <button type="button" className="tab" aria-pressed={sort === "newest"} onClick={() => setSort("newest")}>
            Newest
          </button>
        </div>
      )}

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
          {entries.length === 0 && !showingForm && !isRequester && (
            <p className="empty">
              No answers yet. Be the first to answer.
            </p>
          )}
          {needVerify && !emailVerified && <VerifyEmailNotice action="upvote answers" />}
          {upvoteError && (
            <p className="error" role="alert">
              {upvoteError}
            </p>
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
                    editUntil={e.id === mine ? editableUntil(e) : null}
                    upvote={{
                      count: countOf(e),
                      mine: myUpvotes.has(e.id),
                      onToggle: e.id === mine || (uid !== null && e.author?.id === uid) ? undefined : () => void toggleUpvote(e),
                    }}
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
