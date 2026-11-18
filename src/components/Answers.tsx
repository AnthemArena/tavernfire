"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { useNow } from "@/lib/use-now";
import { answerMarkerPath, orderForViewer, toEntryItem, type EntryItem } from "@/lib/entries";
import { answersCloseAt, type RequestItem } from "@/lib/requests";
import AnswerForm from "@/components/AnswerForm";
import EntryCard from "@/components/EntryCard";

// The answer form can be switched off with NEXT_PUBLIC_ENABLE_ANSWERS=false
// (for example on a deploy whose rules haven't been published yet).
const ANSWERS_ENABLED = process.env.NEXT_PUBLIC_ENABLE_ANSWERS !== "false";

export default function Answers({ request }: { request: RequestItem }) {
  const { user, loading } = useAuth();
  const now = useNow();
  const uid = user?.uid ?? null;

  const [entries, setEntries] = useState<EntryItem[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [myEntryId, setMyEntryId] = useState<string | null>(null);
  const [reportedIds, setReportedIds] = useState<Set<string>>(new Set());
  const [formOpen, setFormOpen] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);
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
          .map((d) => toEntryItem(d.id, d.data()))
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
  const closed = now.getTime() > 0 && now >= answersCloseAt(request.createdAt);
  const shown = mine
    ? [...list.filter((e) => e.id === mine), ...list.filter((e) => e.id !== mine)]
    : list;

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
    action = justSubmitted ? (
      <p className="notice notice-success" role="status">
        <span className="notice-title">Your answer is in.</span> Entries
        can&apos;t be changed once submitted.
      </p>
    ) : null;
  } else if (unfinished && !closed) {
    showingForm = true;
    action = (
      <>
        <p className="notice notice-warn" role="status">
          Your last answer didn&apos;t finish saving. Please send it again.
        </p>
        <AnswerForm
          request={request}
          resumeEntryId={markedEntryId}
          onSubmitted={() => setJustSubmitted(true)}
        />
      </>
    );
  } else if (closed) {
    action = <p className="notice notice-plain">Answers for this request have closed.</p>;
  } else if (entries !== null && (entries.length === 0 || formOpen)) {
    showingForm = true;
    action = (
      <AnswerForm
        request={request}
        onCancel={entries.length > 0 ? () => setFormOpen(false) : undefined}
        onSubmitted={() => setJustSubmitted(true)}
      />
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
            {entries.length > 1 && ", in random order"}
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
          {entries.length === 0 && !showingForm && !isRequester && (
            <p className="empty">
              No answers yet. Entries written for these three sparks will appear here.
            </p>
          )}
          {shown.length > 0 && (
            <ul className="entry-list">
              {shown.map((e) => (
                <li key={e.id}>
                  <EntryCard entry={e} isMine={e.id === mine} reported={reportedIds.has(e.id)} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
