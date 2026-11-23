"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { collection, doc, getDoc, getDocs, limit, query, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { getCloudFunctions, getDb } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { REPORT_REASON_LABELS, toEntryItem, type EntryItem, type ReportReason } from "@/lib/entries";
import { describeAge, kindLabel } from "@/lib/requests";
import { isCategoryId } from "@/lib/categories";
import { groupReports, type ReportRow } from "@/lib/moderation";

type Item = {
  entry: EntryItem;
  sparks: string[];
  kind: string;
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
  // The answer whose Hide button is waiting for a second tap.
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [now] = useState(() => new Date());

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
          kind: isCategoryId(fire.get("kind")) ? kindLabel(fire.get("kind")) : "",
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
    setConfirmId(null);
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
        <Link className="btn btn-primary btn-block" href="/signin?next=%2Fmoderation">
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
      <h1 className="section-title">Moderation</h1>
      <h2 className="page-title">Reported answers</h2>
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
        <p className="empty">No open reports.</p>
      ) : (
        <ul className="request-list">
          {state.items.map(({ entry, sparks, kind, authorName, reports }) => (
            <li key={entry.id} className="card moderation-item">
              <p className="muted">
                Answer to{" "}
                <Link href={`/fires/${entry.requestId}`}>{sparks.length > 0 ? sparks.join(", ") : "this fire"}</Link>{" "}
                by{" "}
                {entry.author ? <Link href={`/profile/${entry.author.id}`}>{authorName}</Link> : authorName}
                {kind && <> · {kind} fire</>}
                {entry.createdAt && <> · answered {describeAge(entry.createdAt, now)}</>}
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
                    {r.createdMs > 0 && <span className="muted"> ({describeAge(new Date(r.createdMs), now)})</span>}
                  </li>
                ))}
              </ul>
              {confirmId === entry.id ? (
                <div className="form-actions">
                  <p className="hint">Hide this answer from the site? It can&apos;t be restored from this page.</p>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busyId === entry.id}
                    onClick={() => void act(entry.id, "hide")}
                  >
                    Yes, hide it
                  </button>
                  <button type="button" className="btn btn-outline" onClick={() => setConfirmId(null)}>
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="form-actions">
                  <button
                    type="button"
                    className="btn btn-outline"
                    disabled={busyId === entry.id}
                    onClick={() => setConfirmId(entry.id)}
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
              )}
            </li>
          ))}
        </ul>
      )}
      <h2 className="page-title maintenance-title">Maintenance</h2>
      <RecountXp />
    </div>
  );
}

/** One-off tool: recount everyone's XP, ranks and achievements (after the XP functions are first deployed). */
function RecountXp() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const [confirming, setConfirming] = useState(false);

  async function run() {
    setConfirming(false);
    setBusy(true);
    setResult(null);
    try {
      const res = await httpsCallable<unknown, { members: number }>(getCloudFunctions(), "recountAllXp")({});
      setResult(`Counted ${res.data.members} members.`);
    } catch {
      setResult("Couldn't recount just now. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h2 className="card-title">Recount XP</h2>
      <p className="hint">
        Works out everyone&apos;s XP, rank and achievements again from their posts. Run it once after the XP functions are
        first deployed, or after changing the points.
      </p>
      {confirming ? (
        <div className="form-actions">
          <p className="hint">This rewrites everyone&apos;s XP. Go ahead?</p>
          <button type="button" className="btn btn-primary" onClick={() => void run()}>
            Yes, recount
          </button>
          <button type="button" className="btn btn-outline" onClick={() => setConfirming(false)}>
            Cancel
          </button>
        </div>
      ) : (
        <button type="button" className="btn btn-outline" disabled={busy} onClick={() => setConfirming(true)}>
          {busy ? "Counting…" : "Recount XP for everyone"}
        </button>
      )}
      {result && (
        <p className="hint" role="status">
          {result}
        </p>
      )}
    </section>
  );
}
