"use client";

import { useState, type FormEvent } from "react";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import {
  REPORT_REASONS,
  REPORT_REASON_LABELS,
  type EntryItem,
  type ReportReason,
} from "@/lib/entries";

// Note for the voting step: while a request is open or in voting, this card must
// never receive or render an author name, an author id or a vote total, not even
// in hidden text or aria-labels. Those arrive only after the reveal.

function ReportForm({ entryId, onClose }: { entryId: string; onClose: () => void }) {
  const { user } = useAuth();
  const [reason, setReason] = useState<ReportReason>("ai_generated");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!user || busy) return;
    setBusy(true);
    setError(null);
    try {
      await setDoc(doc(getDb(), "reports", `${entryId}_${user.uid}`), {
        entryId,
        reporterId: user.uid,
        reason,
        details: details.trim().slice(0, 500),
        status: "open",
        createdAt: serverTimestamp(),
      });
      // The page's live listener marks the card as reported.
      onClose();
    } catch (err) {
      console.error("Could not send report", err);
      setError("Couldn't send your report. You may have reported this entry already.");
      setBusy(false);
    }
  }

  return (
    <form className="report-form" onSubmit={onSubmit}>
      <div className="field">
        <label className="label" htmlFor={`reason-${entryId}`}>
          What&apos;s wrong with this entry?
        </label>
        <select
          id={`reason-${entryId}`}
          className="input"
          value={reason}
          onChange={(e) => setReason(e.target.value as ReportReason)}
        >
          {REPORT_REASONS.map((r) => (
            <option key={r} value={r}>
              {REPORT_REASON_LABELS[r]}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label className="label" htmlFor={`details-${entryId}`}>
          Anything we should know (optional)
        </label>
        <textarea
          id={`details-${entryId}`}
          className="input textarea"
          rows={2}
          maxLength={500}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
        />
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button type="submit" className="btn btn-outline" disabled={busy}>
          {busy ? "Sending…" : "Send report"}
        </button>
        <button type="button" className="btn-link btn-link-action" onClick={onClose} disabled={busy}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function EntryCard({
  entry,
  isMine,
  reported,
}: {
  entry: EntryItem;
  isMine: boolean;
  reported: boolean;
}) {
  const { user } = useAuth();
  const [reporting, setReporting] = useState(false);

  return (
    <article className="card entry-card" aria-labelledby={`entry-${entry.id}`}>
      <div className="entry-head">
        <h3 id={`entry-${entry.id}`} className="entry-name">
          {entry.name}
        </h3>
        {isMine && <span className="badge badge-mine">Your entry</span>}
      </div>

      <p className="entry-concept">{entry.concept}</p>

      {entry.traits.length > 0 && (
        <ul className="trait-list" aria-label="Traits">
          {entry.traits.map((t) => (
            <li className="trait" key={t}>
              {t}
            </li>
          ))}
        </ul>
      )}

      {entry.hook && (
        <div className="at-your-table">
          <p className="at-your-table-kicker">At your table</p>
          <p>{entry.hook}</p>
        </div>
      )}

      <div className="entry-foot">
        <span className="entry-anon">Author revealed after voting</span>

        {!isMine &&
          user &&
          (reported ? (
            <span className="entry-reported" role="status">
              Reported. A moderator will take a look.
            </span>
          ) : (
            !reporting && (
              <button
                type="button"
                className="btn-link btn-link-action"
                onClick={() => setReporting(true)}
              >
                Report entry
              </button>
            )
          ))}
      </div>

      {reporting && !reported && (
        <ReportForm entryId={entry.id} onClose={() => setReporting(false)} />
      )}
    </article>
  );
}
