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

export default function PostRequestForm() {
  const router = useRouter();
  const { user, displayName, loading } = useAuth();

  const [sparks, setSparks] = useState(["", "", ""]);
  const [kind, setKind] = useState<RequestKind>("npc");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    try {
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
      router.push(`/requests/${ref.id}`);
    } catch (err) {
      console.error("Could not post request", err);
      setError("Couldn't post your request. Check you're signed in and try again.");
      setBusy(false);
    }
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
