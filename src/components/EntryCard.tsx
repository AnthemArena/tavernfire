"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import Avatar from "@/components/Avatar";
import { describeAge } from "@/lib/requests";
import {
  describeEditTimeLeft,
  ENTRY_EDIT_WINDOW_HOURS,
  REPORT_REASONS,
  REPORT_REASON_LABELS,
  type EntryItem,
  type ReportReason,
} from "@/lib/entries";
import AnswerForm from "@/components/AnswerForm";
import UpArrow from "@/components/UpArrow";

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
      // Lock the entry against edits now that someone has reported it. If another
      // report already did, this write is refused, which is fine.
      try {
        await setDoc(doc(getDb(), "entryFlags", entryId), {
          entryId,
          reportId: `${entryId}_${user.uid}`,
          createdAt: serverTimestamp(),
        });
      } catch {
        // already flagged by an earlier report
      }
      // The page's live listener marks the card as reported.
      onClose();
    } catch (err) {
      console.error("Could not send report", err);
      setError("Couldn't send your report. You may have reported this answer already.");
      setBusy(false);
    }
  }

  return (
    <form className="report-form" onSubmit={onSubmit}>
      <div className="field">
        <label className="label" htmlFor={`reason-${entryId}`}>
          What&apos;s wrong with this answer?
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
  now,
  editUntil,
  upvote,
}: {
  entry: EntryItem;
  isMine: boolean;
  reported: boolean;
  now: Date;
  /** When the author's edit window ends; null if it is not known yet. */
  editUntil: Date | null;
  /** The upvote button. `onToggle` is absent for your own answer, which shows the count only. */
  upvote: { count: number; mine: boolean; onToggle?: () => void };
}) {
  const { user } = useAuth();
  const [reporting, setReporting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);

  // "Saved" is only a short confirmation; "Edited" stays.
  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), 4000);
    return () => clearTimeout(timer);
  }, [saved]);

  const editButton = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);

  // After saving or cancelling an edit, put keyboard focus back on the Edit link.
  useEffect(() => {
    if (!editing && restoreFocus.current) {
      restoreFocus.current = false;
      editButton.current?.focus();
    }
  }, [editing]);

  const timeLeft = editUntil ? describeEditTimeLeft(editUntil, now) : null;

  if (isMine && editing) {
    return (
      <AnswerForm
        editing={entry}
        onCancel={() => {
          restoreFocus.current = true;
          setEditing(false);
        }}
        onSaved={() => {
          restoreFocus.current = true;
          setEditing(false);
          setSaved(true);
        }}
      />
    );
  }

  return (
    <article className="card entry-card entry-card-row" aria-labelledby={`entry-${entry.id}`}>
      <div className="entry-vote">
        {upvote.onToggle ? (
          <button
            type="button"
            className={upvote.mine ? "vote-btn vote-btn-on" : "vote-btn"}
            aria-pressed={upvote.mine}
            title="A good answer."
            aria-label={`Upvote this answer, ${upvote.count} ${upvote.count === 1 ? "upvote" : "upvotes"}`}
            onClick={upvote.onToggle}
          >
            <UpArrow />
            <span>{upvote.count}</span>
          </button>
        ) : (
          <span
            className="vote-static"
            role="img"
            title={isMine ? "You can't upvote your own answer" : undefined}
            aria-label={`${upvote.count} ${upvote.count === 1 ? "upvote" : "upvotes"}${isMine ? ". You can't upvote your own answer" : ""}`}
          >
            <UpArrow />
            <span>{upvote.count}</span>
          </span>
        )}
      </div>
      <div className="entry-body">
      <div className="entry-head">
        <h3 id={`entry-${entry.id}`} className="entry-name">
          {entry.name}
        </h3>
        {isMine && <span className="badge badge-mine">Your answer</span>}
      </div>

      <p className="entry-concept">{entry.concept}</p>

      <div className="entry-foot">
        <span className="entry-anon">
          {entry.author && !isMine && (
            <span className="by-line">
              <Avatar id={entry.author.avatar} name={entry.author.name} size="sm" />
              by <Link href={`/profile/${entry.author.id}`}>&nbsp;{entry.author.name}</Link>
              {entry.createdAt && <>, {describeAge(entry.createdAt, now)}</>}
            </span>
          )}
          {entry.edited && (
            <span className="entry-edited">{isMine || !entry.author ? "Edited" : " · Edited"}</span>
          )}
          {isMine && (
            <span className="entry-saved" role="status">
              {saved ? (entry.edited ? " · Saved" : "Saved") : ""}
            </span>
          )}
        </span>

        {isMine &&
          (timeLeft ? (
            <button
              ref={editButton}
              type="button"
              className="btn-link btn-link-action"
              onClick={() => {
                setSaved(false);
                setEditing(true);
              }}
            >
              Edit · {timeLeft}
            </button>
          ) : (
            <span className="entry-anon">
              {`Editing closed. Answers lock ${ENTRY_EDIT_WINDOW_HOURS} hours after posting.`}
            </span>
          ))}

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
                Report answer
              </button>
            )
          ))}
      </div>

      {reporting && !reported && (
        <ReportForm entryId={entry.id} onClose={() => setReporting(false)} />
      )}
      </div>
    </article>
  );
}
