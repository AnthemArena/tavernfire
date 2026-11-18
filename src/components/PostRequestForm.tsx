"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { buildSparkFields } from "@/lib/sparks";
import { KIND_LABELS, REQUEST_KINDS, type RequestKind } from "@/lib/requests";

const NOTE_MAX = 300;
// If the server hasn't confirmed the request after this long, say so.
const SLOW_AFTER_MS = 8_000;

export default function PostRequestForm() {
  const router = useRouter();
  const { user, displayName, loading } = useAuth();

  const [sparks, setSparks] = useState(["", "", ""]);
  const [kind, setKind] = useState<RequestKind>("npc");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [slow, setSlow] = useState(false);
  // The id of the request we just posted, once the server has confirmed it.
  const [postedId, setPostedId] = useState<string | null>(null);

  function setSpark(index: number, value: string) {
    setSparks((current) => current.map((s, i) => (i === index ? value : s)));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!user) return;
    setError(null);

    let fields;
    try {
      fields = buildSparkFields(sparks);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Check your sparks and try again.");
      return;
    }

    setBusy(true);
    setSlow(false);
    const slowTimer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);

    try {
      // addDoc only finishes once the server has accepted the request.
      const ref = await addDoc(collection(getDb(), "requests"), {
        ...fields,
        kind,
        note: note.trim(),
        requesterId: user.uid,
        requesterName: displayName ?? "Adventurer",
        status: "open",
        moderation: "ok",
        answerCount: 0,
        createdAt: serverTimestamp(),
      });
      clearTimeout(slowTimer);
      setSlow(false);
      setPostedId(ref.id);
      setSparks(["", "", ""]);
      setNote("");
      router.push(`/requests/${ref.id}`);
    } catch (err) {
      clearTimeout(slowTimer);
      console.error("Could not post request", err);
      setError("Couldn't post your request. Check you're signed in and try again.");
      setSlow(false);
      setBusy(false);
    }
  }

  function postAnother() {
    setPostedId(null);
    setBusy(false);
  }

  return (
    <div className="card">
      <h2 className="card-title">Post a request</h2>

      {loading ? (
        <p className="muted">One moment…</p>
      ) : !user ? (
        <>
          <p className="card-lede">
            Sign in to post a request. It takes a few seconds and you can use
            your Google account.
          </p>
          <Link className="btn btn-primary btn-block" href="/signin">
            Sign in to post
          </Link>
        </>
      ) : postedId ? (
        <div className="notice notice-success" role="status">
          <p className="notice-title">Request posted</p>
          <p>Opening your request now.</p>
          <p>
            <Link href={`/requests/${postedId}`}>Open your request</Link>
            {" or "}
            <button type="button" className="btn-link" onClick={postAnother}>
              post another
            </button>
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate>
          <div className="form-row">
            {sparks.map((value, index) => (
              <div className="field field-spark" key={index}>
                <label className="label" htmlFor={`spark-${index}`}>
                  {["Spark one", "Spark two", "Spark three"][index]}
                </label>
                <input
                  id={`spark-${index}`}
                  className="input input-spark"
                  type="text"
                  maxLength={30}
                  autoComplete="off"
                  placeholder={["Statue", "Time", "Glowing"][index]}
                  value={value}
                  onChange={(e) => setSpark(index, e.target.value)}
                />
              </div>
            ))}
          </div>
          <p className="hint">
            Broad words invite surprises. Narrow words get you closer to what
            you need.
          </p>

          <div className="field">
            <label className="label" htmlFor="kind">
              I need a
            </label>
            <select
              id="kind"
              className="input"
              value={kind}
              onChange={(e) => setKind(e.target.value as RequestKind)}
            >
              {REQUEST_KINDS.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABELS[k]}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label className="label" htmlFor="note">
              Anything the table should know (optional)
            </label>
            <textarea
              id="note"
              className="input textarea"
              rows={3}
              maxLength={NOTE_MAX}
              placeholder="Party level, tone, what the scene needs"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}

          {slow && (
            <p className="notice notice-warn" role="status">
              This is taking longer than usual, so your request may not have
              reached the server yet. If you&apos;re running the site locally,
              check that the Firebase emulators are still running.
            </p>
          )}

          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? "Posting…" : "Post request"}
          </button>
          <p className="hint">
            Answers stay open for 3 days. Write your own work; no AI-generated
            entries.
          </p>
        </form>
      )}
    </div>
  );
}
