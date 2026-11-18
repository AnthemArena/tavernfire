"use client";

import { useState, type FormEvent } from "react";
import { collection, doc, increment, serverTimestamp, writeBatch } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import {
  ENTRY_CONCEPT_MAX,
  ENTRY_HOOK_MAX,
  ENTRY_NAME_MAX,
  answerLockId,
  buildEntryFields,
  cleanTrait,
} from "@/lib/entries";
import type { RequestItem } from "@/lib/requests";
import TraitInput from "@/components/TraitInput";

const COPY = {
  npc: {
    name: "e.g. Vhane, the Last Hour",
    concept: "Who are they? What do they look like, and what do they want?",
    hook: "e.g. Offers the party one frozen minute, at a price.",
  },
  location: {
    name: "e.g. The Hollow Observatory",
    concept: "What is this place like? What is hidden here?",
    hook: "e.g. A safe place to hide from pursuers, if the party can bear the silence.",
  },
} as const;

function Counter({ used, max }: { used: number; max: number }) {
  return (
    <span className="counter" aria-hidden="true">
      {used} of {max}
    </span>
  );
}

export default function AnswerForm({
  request,
  onCancel,
}: {
  request: RequestItem;
  /** Shown only when there is something else on the page to go back to. */
  onCancel?: () => void;
}) {
  const { user } = useAuth();
  const copy = COPY[request.kind];

  const [name, setName] = useState("");
  const [concept, setConcept] = useState("");
  const [hook, setHook] = useState("");
  const [traits, setTraits] = useState<string[]>([]);
  const [traitDraft, setTraitDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!user || busy) return;
    setError(null);

    // Include a trait that was typed but not yet confirmed with Enter.
    const pending = cleanTrait(traitDraft);
    const allTraits = pending ? [...traits, pending] : traits;

    let fields;
    try {
      fields = buildEntryFields({ name, concept, hook, traits: allTraits });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Check your answer and try again.");
      return;
    }

    setBusy(true);
    try {
      const db = getDb();
      const entryRef = doc(collection(db, "entries"));
      // One batch: the entry (no author on it), a private author row, a private
      // "already answered" marker, and the request's answer count. Security
      // rules only accept the four together.
      const batch = writeBatch(db);
      batch.set(entryRef, {
        requestId: request.id,
        kind: request.kind,
        ...fields,
        sparksNorm: request.sparksNorm,
        sparkKey: request.sparkKey,
        pairKeys: pairKeysFrom(request.sparksNorm),
        moderation: "ok",
        createdAt: serverTimestamp(),
      });
      batch.set(doc(db, "entryAuthors", entryRef.id), {
        authorId: user.uid,
        requestId: request.id,
        createdAt: serverTimestamp(),
      });
      batch.set(doc(db, "answerLocks", answerLockId(request.id, user.uid)), {
        authorId: user.uid,
        requestId: request.id,
        entryId: entryRef.id,
        createdAt: serverTimestamp(),
      });
      batch.update(doc(db, "requests", request.id), { answerCount: increment(1) });
      await batch.commit();
      // The live listener on the page now shows the new entry as "Your entry".
    } catch (err) {
      console.error("Could not submit answer", err);
      setError(
        "Couldn't submit your answer. Answers may have just closed, or you may already have answered this request. Check your connection and try again.",
      );
      setBusy(false);
    }
  }

  return (
    <form className="card answer-form" onSubmit={onSubmit} noValidate>
      <h3 className="card-title">Write your answer</h3>
      <p className="card-lede">
        Write it yourself. Entries are anonymous until voting ends, and they
        stay in the library afterwards.
      </p>

      <div className="field">
        <label className="label" htmlFor="entry-name">
          Name <Counter used={name.length} max={ENTRY_NAME_MAX} />
        </label>
        <input
          id="entry-name"
          className="input"
          type="text"
          maxLength={ENTRY_NAME_MAX}
          placeholder={copy.name}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="field">
        <label className="label" htmlFor="entry-concept">
          Description <Counter used={concept.length} max={ENTRY_CONCEPT_MAX} />
        </label>
        <textarea
          id="entry-concept"
          className="input textarea"
          rows={5}
          maxLength={ENTRY_CONCEPT_MAX}
          placeholder={copy.concept}
          value={concept}
          onChange={(e) => setConcept(e.target.value)}
        />
      </div>

      <TraitInput
        traits={traits}
        onChange={setTraits}
        draft={traitDraft}
        onDraftChange={setTraitDraft}
      />

      <div className="field">
        <label className="label" htmlFor="entry-hook">
          How a GM could use it <Counter used={hook.length} max={ENTRY_HOOK_MAX} />
        </label>
        <textarea
          id="entry-hook"
          className="input textarea"
          rows={2}
          maxLength={ENTRY_HOOK_MAX}
          placeholder={copy.hook}
          value={hook}
          onChange={(e) => setHook(e.target.value)}
        />
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Submitting…" : "Submit answer"}
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
