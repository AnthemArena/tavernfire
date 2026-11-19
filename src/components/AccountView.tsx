"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { useNow } from "@/lib/use-now";
import { NAME_CHANGE_DAYS, NAME_MAX, NameError } from "@/lib/names";
import { kindLabel, toRequestItem, type RequestItem } from "@/lib/requests";
import TimeLeft from "@/components/TimeLeft";
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
          ? "Shown next to your requests."
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
          You haven&apos;t posted a request yet. <Link href="/">Post one from the board.</Link>
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
                  <TimeLeft createdAt={r.createdAt} now={now} />
                  <AnswerCount requestId={r.id} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="hint account-note">
        Answers you write stay hidden from everyone else. A list of your own answers, visible only to
        you, is planned for a later update.
      </p>
    </section>
  );
}
