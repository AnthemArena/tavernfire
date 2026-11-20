"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { collection, doc, getDoc, getDocs, limit, query, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { getCloudFunctions, getDb } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { REPORT_REASON_LABELS, toEntryItem, type EntryItem, type ReportReason } from "@/lib/entries";
import { groupReports, type ReportRow } from "@/lib/moderation";

type Item = {
  entry: EntryItem;
  sparks: string[];
  authorName: string;
  reports: ReportRow[];
};

type State =
  | { status: "loading" }
  | { status: "denied" }
  | { status: "error" }
  | { status: "ready"; items: Item[] };

const MAX_REPORTS = 200;

/** The review queue: answers people have reported, with the reasons, and what a moderator can do. */
export default function ModerationView() {
  const { user, loading } = useAuth();
  const [state, setState] = useState<State>({ status: "loading" });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const token = await user.getIdTokenResult();
      if (token.claims.role !== "moderator") {
        setState({ status: "denied" });
        return;
      }
      const db = getDb();
      const snap = await getDocs(
        query(collection(db, "reports"), where("status", "==", "open"), limit(MAX_REPORTS)),
      );
      const rows: ReportRow[] = snap.docs.map((d) => ({
        id: d.id,
        entryId: String(d.get("entryId")),
        reason: String(d.get("reason")),
        details: typeof d.get("details") === "string" ? d.get("details") : "",
        createdMs: d.get("createdAt")?.toMillis?.() ?? 0,
      }));
      const groups = groupReports(rows);
      const items: Item[] = [];
      for (const group of groups) {
        const entrySnap = await getDoc(doc(db, "entries", group.entryId));
        if (!entrySnap.exists()) continue;
        const entry = toEntryItem(entrySnap.id, entrySnap.data());
        if (!entry) continue;
        const fire = await getDoc(doc(db, "requests", entry.requestId));
        const sparks = Array.isArray(fire.get("sparks")) ? (fire.get("sparks") as string[]) : [];
        items.push({
          entry,
          sparks,
          authorName: entry.author?.name ?? "Unknown author",
          reports: group.reports,
        });
      }
      setState({ status: "ready", items });
    } catch (err) {
      console.error("Could not load reports", err);
      setState({ status: "error" });
    }
  }, [user]);

  useEffect(() => {
    // Loading the queue is the point of this effect; the state it sets is the queue.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function act(entryId: string, action: "hide" | "dismiss") {
    setBusyId(entryId);
    setActionError(null);
    try {
      await httpsCallable(getCloudFunctions(), "moderateAnswer")({ entryId, action });
      setState((cur) =>
        cur.status === "ready" ? { status: "ready", items: cur.items.filter((i) => i.entry.id !== entryId) } : cur,
      );
    } catch (err) {
      console.error("Moderation action failed", err);
      setActionError("That didn't go through. Try again in a moment.");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <p className="muted page-note">Loading…</p>;
  if (!user) {
    return (
      <div className="card">
        <h1 className="card-title">Moderation</h1>
        <p className="card-lede">Sign in to continue.</p>
        <Link className="btn btn-primary btn-block" href="/signin">
          Sign in
        </Link>
      </div>
    );
  }
  if (state.status === "loading") return <p className="muted page-note">Loading…</p>;
  if (state.status === "denied") {
    return (
      <div className="page-note">
        <h1 className="section-title">Not available</h1>
        <p className="muted">
          This page is for moderators. <Link href="/">Back to Fires</Link>
        </p>
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <p className="empty page-note" role="alert">
        Couldn&apos;t load the reports right now. Please try again in a moment.
      </p>
    );
  }

  return (
    <div className="moderation">
      <h1 className="page-title">Reported answers</h1>
      <p className="hint">
        <strong>Hide</strong> removes the answer from the site. <strong>Dismiss</strong> clears the reports and lets
        the author edit again. Nothing is deleted, and an author is never penalised automatically.
      </p>
      {actionError && (
        <p className="error" role="alert">
          {actionError}
        </p>
      )}
      {state.items.length === 0 ? (
        <p className="empty">Nothing to review. No open reports.</p>
      ) : (
        <ul className="request-list">
          {state.items.map(({ entry, sparks, authorName, reports }) => (
            <li key={entry.id} className="card moderation-item">
              <p className="muted">
                Answer to{" "}
                <Link href={`/fires/${entry.requestId}`}>{sparks.length > 0 ? sparks.join(", ") : "this fire"}</Link>{" "}
                by{" "}
                {entry.author ? <Link href={`/profile/${entry.author.id}`}>{authorName}</Link> : authorName}
              </p>
              <h2 className="my-answer-name">{entry.name}</h2>
              <p className="entry-concept">{entry.concept}</p>
              <p className="moderation-reports-title">
                {reports.length} {reports.length === 1 ? "report" : "reports"}
              </p>
              <ul className="moderation-reports">
                {reports.map((r) => (
                  <li key={r.id}>
                    <strong>{REPORT_REASON_LABELS[r.reason as ReportReason] ?? r.reason}</strong>
                    {r.details && <span>: {r.details}</span>}
                  </li>
                ))}
              </ul>
              <div className="form-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busyId === entry.id}
                  onClick={() => void act(entry.id, "hide")}
                >
                  Hide answer
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={busyId === entry.id}
                  onClick={() => void act(entry.id, "dismiss")}
                >
                  Dismiss reports
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
