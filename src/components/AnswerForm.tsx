"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { collection, doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { NAME_CHANGE_DAYS, NAME_MAX, NameError } from "@/lib/names";
import {
  ENTRY_CONCEPT_MAX,
  ENTRY_NAME_MAX,
  answerMarkerPath,
  buildEntryFields,
  type EntryItem,
} from "@/lib/entries";
import type { RequestItem } from "@/lib/requests";
import { getCategory } from "@/lib/categories";

function Counter({ used, max }: { used: number; max: number }) {
  return (
    <span className="counter" aria-hidden="true">
      {used} of {max} characters
    </span>
  );
}

export default function AnswerForm({
  request,
  editing,
  onCancel,
  resumeEntryId,
  onSubmitted,
  onSaved,
  onAlreadyAnswered,
  onFailed,
}: {
  /** The request being answered (needed to write a new answer). */
  request?: RequestItem;
  /** Set to edit this existing entry in place instead of writing a new one. */
  editing?: EntryItem;
  /** Called once an edit has been saved. */
  onSaved?: () => void;
  /** Set when an earlier attempt saved the private marker but not the entry. */
  resumeEntryId?: string | null;
  /** Called once the entry has been saved, so the page can confirm it. */
  onSubmitted?: () => void;
  /** Called when the write was refused because this person already answered. */
  onAlreadyAnswered?: () => void;
  /** Called when an attempt failed here, so the page does not repeat the news. */
  onFailed?: () => void;
  /** Shown only when there is something else on the page to go back to. */
  onCancel?: () => void;
}) {
  const { user, displayName, avatar, chooseName } = useAuth();
  const copy = getCategory(editing?.kind ?? request?.kind ?? "npc").answer;
  const idPart = editing?.id ?? "new";

  const [name, setName] = useState(editing?.name ?? "");
  const [concept, setConcept] = useState(editing?.concept ?? "");
  // Traits are not shown or asked for at launch. Keep an edited answer's own traits as they were.
  const keptTraits = editing?.traits ?? [];
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [conceptError, setConceptError] = useState<string | null>(null);
  // After a refused edit, Save stays off until the person changes something.
  const [refused, setRefused] = useState(false);
  const refusals = useRef(0);
  const [busy, setBusy] = useState(false);
  const nameInput = useRef<HTMLInputElement>(null);
  // Someone who has not chosen a name yet picks one here, shown with their answer
  // from the start. (Editing never asks: the name is already set by then.)
  const needsAuthorName = !editing && !displayName;
  const [authorName, setAuthorName] = useState("");
  const [authorNameError, setAuthorNameError] = useState<string | null>(null);
  const authorNameInput = useRef<HTMLInputElement>(null);
  const conceptInput = useRef<HTMLTextAreaElement>(null);

  // When editing in place, start in the first field.
  useEffect(() => {
    if (editing) nameInput.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!user || busy) return;
    setError(null);
    setNameError(null);
    setConceptError(null);

    // Check each field on its own, so the message sits beside the box it is about.
    const missingName = name.trim() === "";
    const missingConcept = concept.trim() === "";
    if (missingName || missingConcept) {
      if (missingName) setNameError(`Give your ${copy.noun} a name.`);
      if (missingConcept) setConceptError("Add a description.");
      (missingName ? nameInput : conceptInput).current?.focus();
      return;
    }

    let fields;
    try {
      fields = buildEntryFields({ name, concept, traits: keptTraits });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Check your answer and try again.");
      return;
    }

    setBusy(true);

    let postAs = displayName;
    if (needsAuthorName) {
      try {
        postAs = await chooseName(authorName);
      } catch (err) {
        setAuthorNameError(
          err instanceof NameError ? err.message : "Couldn't save that name. Try again.",
        );
        authorNameInput.current?.focus();
        setBusy(false);
        return;
      }
    }

    if (editing) {
      try {
        await updateDoc(doc(getDb(), "entries", editing.id), {
          name: fields.name,
          concept: fields.concept,
          editedAt: serverTimestamp(),
        });
        onSaved?.();
      } catch (err) {
        console.error("Could not save changes", err);
        refusals.current += 1;
        setError(
          refusals.current > 1
            ? "This answer is locked. Your text is still here, so you can copy it."
            : "Couldn't save. This answer may be locked. Your text is still here.",
        );
        setRefused(true);
        setBusy(false);
      }
      return;
    }

    if (!request) return;
    const entryId = resumeEntryId ?? doc(collection(getDb(), "entries")).id;
    let step = "";
    try {
      const db = getDb();

      // Two writes, in order. First a private marker that says "this person is
      // answering this request with this entry id" (it stops a second answer).
      // Then the public entry, which carries the author's id and name. Security
      // rules check each against what already exists.
      step = "the private answer marker";
      if (!resumeEntryId) {
        await setDoc(doc(db, ...answerMarkerPath(request.id, user.uid)), {
          authorId: user.uid,
          requestId: request.id,
          entryId,
          createdAt: serverTimestamp(),
        });
      }
      step = "the public entry";
      const entry = {
        requestId: request.id,
        kind: request.kind,
        ...fields,
        sparksNorm: request.sparksNorm,
        sparkKey: request.sparkKey,
        pairKeys: pairKeysFrom(request.sparksNorm),
        moderation: "ok",
        authorId: user.uid,
        authorName: postAs,
        ...(avatar ? { authorAvatar: avatar } : {}),
        upvoteCount: 0,
        createdAt: serverTimestamp(),
      };
      await setDoc(doc(db, "entries", entryId), entry);
      step = "";
      onSubmitted?.();
      // The live listener on the page now shows the new entry as "Your entry".
    } catch (err) {
      console.error(`Could not submit answer (refused at ${step || "an unknown step"})`, err);
      // If a different entry of mine already holds the private marker, this is
      // a second answer (for example from another tab). Retrying would always
      // fail, so hand over to the page instead of offering "try again".
      try {
        const marker = await getDoc(doc(getDb(), ...answerMarkerPath(request.id, user.uid)));
        if (marker.exists() && marker.get("entryId") !== entryId) {
          setBusy(false);
          onAlreadyAnswered?.();
          return;
        }
      } catch {
        // Could not check; fall through to the general message.
      }
      onFailed?.();
      setError(
        "Couldn't submit your answer. Your connection may have dropped. Your text is still here, so you can try again.",
      );
      setBusy(false);
    }
  }

  return (
    <form className="card answer-form" onSubmit={onSubmit} noValidate>
      <h3 className="card-title">{editing ? "Edit your answer" : "Write your answer"}</h3>
      {!editing && request && (
        <p className="form-task">
          Bring all three sparks into your idea:{" "}
          {request.sparks.map((s) => (
            <span className="spark spark-small" key={s}>
              {s}
            </span>
          ))}
        </p>
      )}
      {!editing && (
        <p className="card-lede">
          Make it your own. Tavernfire is for answers written by people. <Link href="/rules">Read the rules</Link>.
        </p>
      )}

      <div className="field">
        <label className="label" htmlFor={`entry-name-${idPart}`}>
          {copy.nameLabel ?? "Name"} <Counter used={name.length} max={ENTRY_NAME_MAX} />
        </label>
        <input
          id={`entry-name-${idPart}`}
          ref={nameInput}
          className={nameError ? "input input-error" : "input"}
          type="text"
          maxLength={ENTRY_NAME_MAX}
          placeholder={copy.namePlaceholder}
          value={name}
          aria-invalid={nameError ? true : undefined}
          aria-describedby={nameError ? `entry-name-error-${idPart}` : undefined}
          onChange={(e) => {
            setName(e.target.value);
            setNameError(null);
            setRefused(false);
          }}
        />
        {nameError && (
          <p className="error field-error" id={`entry-name-error-${idPart}`} role="alert">
            {nameError}
          </p>
        )}
      </div>

      <div className="field">
        <label className="label" htmlFor={`entry-concept-${idPart}`}>
          Description <Counter used={concept.length} max={ENTRY_CONCEPT_MAX} />
        </label>
        <textarea
          id={`entry-concept-${idPart}`}
          ref={conceptInput}
          className={conceptError ? "input textarea input-error" : "input textarea"}
          rows={5}
          maxLength={ENTRY_CONCEPT_MAX}
          placeholder={copy.conceptPlaceholder}
          value={concept}
          aria-invalid={conceptError ? true : undefined}
          aria-describedby={conceptError ? `entry-concept-error-${idPart}` : undefined}
          onChange={(e) => {
            setConcept(e.target.value);
            setConceptError(null);
            setRefused(false);
          }}
        />
        {conceptError && (
          <p className="error field-error" id={`entry-concept-error-${idPart}`} role="alert">
            {conceptError}
          </p>
        )}
      </div>

      {copy.help && <p className="hint">{copy.help}</p>}

      {!editing &&
        (needsAuthorName ? (
          <div className="field">
            <label className="label" htmlFor="answer-display-name">
              Your display name
            </label>
            <input
              id="answer-display-name"
              ref={authorNameInput}
              className={authorNameError ? "input input-error" : "input"}
              type="text"
              maxLength={NAME_MAX}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder="e.g. Marrow"
              value={authorName}
              aria-invalid={authorNameError ? true : undefined}
              aria-describedby={authorNameError ? "answer-name-error answer-name-hint" : "answer-name-hint"}
              onChange={(e) => {
                setAuthorName(e.target.value);
                setAuthorNameError(null);
              }}
            />
            {authorNameError && (
              <p className="error field-error" id="answer-name-error" role="alert">
                {authorNameError}
              </p>
            )}
            <p className="hint" id="answer-name-hint">
              Shown on your answer. Pick something that isn&apos;t your real name;
              you can change it once every {NAME_CHANGE_DAYS} days.
            </p>
          </div>
        ) : null)}

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {!editing && (
        <p className="hint">
          By submitting, you confirm this is your own work. You keep ownership, and you license
          it to everyone under CC BY 4.0. That means anyone can reuse it with credit, and copies already made stay licensed.{" "}
          <Link href="/terms">Read the terms</Link>.
        </p>
      )}

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={busy || refused}>
          {editing
            ? busy
              ? "Saving…"
              : "Save changes"
            : busy
              ? "Submitting…"
              : "Submit answer"}
        </button>
        {onCancel && (
          <button type="button" className="btn btn-outline" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

/** The two-of-three keys, in the same order the request stores them. */
function pairKeysFrom(sparksNorm: string[]): string[] {
  const [a, b, c] = sparksNorm;
  return [`${a}|${b}`, `${a}|${c}`, `${b}|${c}`];
}
