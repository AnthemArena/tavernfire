"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { SparkError, buildSparkFields } from "@/lib/sparks";
import type { RequestKind } from "@/lib/requests";
import { LAUNCHED_CATEGORIES } from "@/lib/categories";

const NOTE_MAX = 300;
// If the server hasn't confirmed the request after this long, say so.
const SLOW_AFTER_MS = 8_000;
const NOTICE_DELAY_MS = 700;

export default function PostRequestForm() {
  const router = useRouter();
  const { user, displayName, loading } = useAuth();

  const [sparks, setSparks] = useState(["", "", ""]);
  const [kind, setKind] = useState<RequestKind>("npc");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  // When the problem is with one spark box, which one, and a suggested fix.
  const [sparkProblem, setSparkProblem] = useState<{ index: number; message: string; fix: string | null } | null>(null);
  const sparkInputs = useRef<(HTMLInputElement | null)[]>([]);
  const [busy, setBusy] = useState(false);
  const [slow, setSlow] = useState(false);
  // The id of the request we just posted, once the server has confirmed it.
  const [postedId, setPostedId] = useState<string | null>(null);
  // The "Request posted" notice only appears if opening the request takes a
  // moment (the first visit to a page can be slow in development), so it never
  // flashes up just before a quick navigation.
  const [showPosted, setShowPosted] = useState(false);

  function setSpark(index: number, value: string) {
    setSparks((current) => current.map((s, i) => (i === index ? value : s)));
    if (sparkProblem?.index === index) setSparkProblem(null);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!user) return;
    setError(null);
    setSparkProblem(null);

    let fields;
    try {
      fields = buildSparkFields(sparks);
    } catch (err) {
      if (err instanceof SparkError && err.index !== null) {
        // Point at the box that is wrong, and move focus to it.
        setSparkProblem({ index: err.index, message: err.message, fix: err.fix });
        sparkInputs.current[err.index]?.focus();
      } else {
        setError(err instanceof Error ? err.message : "Check your sparks and try again.");
      }
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
      setTimeout(() => setShowPosted(true), NOTICE_DELAY_MS);
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
    setShowPosted(false);
    setSparks(["", "", ""]);
    setNote("");
    setBusy(false);
  }

  return (
    <div className="card">
      <h2 className="card-title">Post a request</h2>

      {loading ? (
        <p className="muted">One moment…</p>
      ) : !user ? (
        <>
          <div className="example-sparks">
            <p className="example-label">Example request</p>
            <div className="sparks">
              {["Statue", "Time", "Glowing"].map((word) => (
                <span className="spark" key={word}>
                  {word}
                </span>
              ))}
            </div>
          </div>
          <p className="card-lede">
            Sign in to post a request. It takes a few seconds and you can use
            your Google account.
          </p>
          <Link className="btn btn-primary btn-block" href="/signin">
            Sign in to post
          </Link>
        </>
      ) : postedId && showPosted ? (
        <div className="notice notice-success" role="status">
          <p className="notice-title">Request posted</p>
          <p>Opening your request now.</p>
          <div className="notice-actions">
            <Link className="btn btn-outline" href={`/requests/${postedId}`}>
              Open your request
            </Link>
            <button type="button" className="btn btn-outline" onClick={postAnother}>
              Post another
            </button>
          </div>
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
                  ref={(el) => {
                    sparkInputs.current[index] = el;
                  }}
                  className={
                    sparkProblem?.index === index ? "input input-spark input-error" : "input input-spark"
                  }
                  type="text"
                  maxLength={30}
                  autoComplete="off"
                  placeholder={["Statue", "Time", "Glowing"][index]}
                  value={value}
                  aria-invalid={sparkProblem?.index === index ? true : undefined}
                  aria-describedby={sparkProblem?.index === index ? "spark-problem" : undefined}
                  onChange={(e) => setSpark(index, e.target.value)}
                />
              </div>
            ))}
          </div>
          {sparkProblem && (
            <div className="error spark-problem" id="spark-problem" role="alert">
              <p>{sparkProblem.message}</p>
              {sparkProblem.fix && (
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => {
                    setSpark(sparkProblem.index, sparkProblem.fix ?? "");
                    setSparkProblem(null);
                    sparkInputs.current[sparkProblem.index]?.focus();
                  }}
                >
                  Use {sparkProblem.fix}
                </button>
              )}
            </div>
          )}
          <p className="hint">
            Broad words invite surprises. Narrow words get you closer to what
            you need.
          </p>

          <fieldset className="field kind-picker">
            <legend className="label">What do you need?</legend>
            <div className="kind-options">
              {LAUNCHED_CATEGORIES.map((c) => (
                <label
                  key={c.id}
                  className={kind === c.id ? "kind-option kind-option-selected" : "kind-option"}
                >
                  <input
                    type="radio"
                    name="kind"
                    value={c.id}
                    checked={kind === c.id}
                    onChange={() => setKind(c.id as RequestKind)}
                  />
                  <span className="kind-text">
                    <span className="kind-name">{c.fullLabel}</span>
                    <span className="kind-desc">{c.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

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
