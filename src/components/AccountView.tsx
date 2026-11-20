"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { useNow } from "@/lib/use-now";
import { NAME_CHANGE_DAYS, NAME_MAX, NameError } from "@/lib/names";
import { kindLabel, toRequestItem, type RequestItem } from "@/lib/requests";
import { toEntryItem, type EntryItem } from "@/lib/entries";
import { answerStatus } from "@/lib/my-answers";
import PhaseLabel from "@/components/PhaseLabel";
import AnswerCount from "@/components/AnswerCount";

/** Your own page: your name, and the requests you have posted. Only you see it. */
export default function AccountView() {
  const { user, displayName, chooseName, nameChangeOn, signOut, loading } = useAuth();

  if (loading) return <p className="muted page-note">Loading…</p>;
  if (!user) {
    return (
      <div className="card">
        <h1 className="card-title">Your account</h1>
        <p className="card-lede">Sign in to see your name and your requests.</p>
        <Link className="btn btn-primary btn-block" href="/signin">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="account">
      <h1 className="page-title">Your account</h1>
      <NameCard
        displayName={displayName}
        chooseName={chooseName}
        waitUntil={displayName ? nameChangeOn() : null}
      />
      <MyRequests uid={user.uid} />
      <MyAnswers uid={user.uid} />
      <button type="button" className="btn btn-outline account-signout" onClick={() => signOut()}>
        Sign out
      </button>
    </div>
  );
}

function NameCard({
  displayName,
  chooseName,
  waitUntil,
}: {
  displayName: string | null;
  chooseName: (name: string) => Promise<string>;
  waitUntil: Date | null;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    setBusy(true);
    try {
      await chooseName(value);
      setValue("");
      setSaved(true);
    } catch (err) {
      setError(err instanceof NameError ? err.message : "Couldn't save that name. Try again.");
      input.current?.focus();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card" aria-labelledby="name-heading">
      <h2 className="card-title" id="name-heading">
        Your name
      </h2>
      <p className="account-name">
        {displayName ? <strong>{displayName}</strong> : <span className="muted">No name yet</span>}
      </p>
      <p className="hint">
        {displayName
          ? "Shown next to your fires and on your answers."
          : "You'll be asked for one when you post your first request. You can also pick it here."}
      </p>

      {waitUntil ? (
        <p className="hint">
          You can change it again on{" "}
          {waitUntil.toLocaleDateString(undefined, { day: "numeric", month: "long" })}.
        </p>
      ) : (
        <form onSubmit={onSubmit} noValidate>
          <div className="field">
            <label className="label" htmlFor="account-name">
              {displayName ? "New name" : "Choose a name"}
            </label>
            <input
              id="account-name"
              ref={input}
              className={error ? "input input-error" : "input"}
              type="text"
              maxLength={NAME_MAX}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder="e.g. Marrow"
              value={value}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "account-name-error account-name-hint" : "account-name-hint"}
              onChange={(e) => {
                setValue(e.target.value);
                setError(null);
                setSaved(false);
              }}
            />
            {error && (
              <p className="error" id="account-name-error" role="alert">
                {error}
              </p>
            )}
            <p className="hint" id="account-name-hint">
              Pick something that isn&apos;t your real name.
              {displayName && ` Changing it starts a new ${NAME_CHANGE_DAYS}-day wait.`}
            </p>
          </div>
          <button type="submit" className="btn btn-primary" disabled={busy || value.trim() === ""}>
            {busy ? "Saving…" : displayName ? "Change name" : "Save name"}
          </button>
        </form>
      )}
      {saved && (
        <p className="notice notice-success" role="status">
          Name saved.
        </p>
      )}
    </section>
  );
}

function MyRequests({ uid }: { uid: string }) {
  const [items, setItems] = useState<RequestItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const now = useNow();

  useEffect(() => {
    const q = query(
      collection(getDb(), "requests"),
      where("requesterId", "==", uid),
      where("moderation", "==", "ok"),
      orderBy("createdAt", "desc"),
    );
    return onSnapshot(
      q,
      (snap) => {
        setItems(
          snap.docs
            .map((d) => toRequestItem(d.id, d.data({ serverTimestamps: "estimate" })))
            .filter((r): r is RequestItem => r !== null),
        );
        setFailed(false);
      },
      (err) => {
        console.error("Could not load your requests", err);
        setFailed(true);
      },
    );
  }, [uid]);

  return (
    <section aria-labelledby="my-requests">
      <h2 className="section-title" id="my-requests">
        Your requests
      </h2>
      {failed ? (
        <p className="empty" role="alert">
          Couldn&apos;t load your requests right now. Please try again in a moment.
        </p>
      ) : items === null ? (
        <p className="empty" role="status">
          Loading…
        </p>
      ) : items.length === 0 ? (
        <p className="empty">
          You haven&apos;t lit a fire yet. <Link href="/fires/new">Light one now.</Link>
        </p>
      ) : (
        <ul className="request-list">
          {items.map((r) => (
            <li key={r.id}>
              <Link href={`/requests/${r.id}`} className="request-card">
                <div className="request-card-top">
                  <div className="sparks">
                    {r.sparks.map((s) => (
                      <span className="spark" key={s}>
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="meta">
                  <span className="badge">{kindLabel(r.kind)}</span>
                  <PhaseLabel request={r} now={now} />
                  <AnswerCount requestId={r.id} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

type AnswerRow = {
  entryId: string;
  request: RequestItem;
  entry: EntryItem | null;
  /** The private marker exists but the entry never finished saving. */
  unfinished: boolean;
  at: number;
};

/** Your answers, across all requests. Only you can see this list. */
function MyAnswers({ uid }: { uid: string }) {
  const [rows, setRows] = useState<AnswerRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const now = useNow();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const db = getDb();
        const markers = await getDocs(
          query(collectionGroup(db, "answerLocks"), where("authorId", "==", uid)),
        );
        const found = await Promise.all(
          markers.docs.map(async (m): Promise<AnswerRow | null> => {
            const requestId = m.get("requestId") as string;
            const entryId = m.get("entryId") as string;
            const requestSnap = await getDoc(doc(db, "requests", requestId)).catch(() => null);
            const request =
              requestSnap && requestSnap.exists()
                ? toRequestItem(requestSnap.id, requestSnap.data() ?? {})
                : null;
            if (!request) return null; // a hidden or removed request
            // A hidden entry is refused to its own author, so treat any failure as "not shown".
            const entrySnap = await getDoc(doc(db, "entries", entryId)).catch(() => null);
            const entry =
              entrySnap && entrySnap.exists() ? toEntryItem(entrySnap.id, entrySnap.data() ?? {}) : null;
            const created = m.get("createdAt") as { toDate?: () => Date } | undefined;
            return {
              entryId,
              request,
              entry,
              unfinished: entrySnap !== null && !entrySnap.exists(),
              at: created?.toDate?.().getTime() ?? 0,
            };
          }),
        );
        if (cancelled) return;
        setRows(found.filter((r): r is AnswerRow => r !== null).sort((a, b) => b.at - a.at));
      } catch (err) {
        console.error("Could not load your answers", err);
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid]);

  return (
    <section aria-labelledby="my-answers">
      <h2 className="section-title" id="my-answers">
        Your answers
      </h2>
      {failed ? (
        <p className="empty" role="alert">
          Couldn&apos;t load your answers right now. Please try again in a moment.
        </p>
      ) : rows === null ? (
        <p className="empty" role="status">
          Loading…
        </p>
      ) : rows.length === 0 ? (
        <p className="empty">
          You haven&apos;t answered any fires yet. <Link href="/">Find a fire to answer.</Link>
        </p>
      ) : (
        <ul className="request-list">
          {rows.map((r) => (
            <li key={r.entryId}>
              <Link href={`/requests/${r.request.id}`} className="request-card">
                <div className="request-card-top">
                  <div className="sparks">
                    {r.request.sparks.map((s) => (
                      <span className="spark" key={s}>
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
                <p className="my-answer-name">
                  {r.entry ? r.entry.name : r.unfinished ? "This answer didn't finish saving" : "Answer not shown"}
                </p>
                <div className="meta">
                  <span className="badge">{kindLabel(r.request.kind)}</span>
                  <span>
                    {r.unfinished ? "Open the request to send it again" : answerStatus(r.entry, now)}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="hint account-note">
        Only you can see this list. Your answers also appear on your public profile.
      </p>
    </section>
  );
}
