"use client";

import { useState, type FormEvent } from "react";
import { collection, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import {
  ENTRY_CONCEPT_MAX,
  ENTRY_NAME_MAX,
  answerMarkerPath,
  buildEntryFields,
  cleanTrait,
} from "@/lib/entries";
import type { RequestItem } from "@/lib/requests";
import TraitInput from "@/components/TraitInput";

const COPY = {
  npc: {
    name: "e.g. Vhane, the Last Hour",
    concept: "Who are they? What do they look like, and what do they want?",
  },
  location: {
    name: "e.g. The Hollow Observatory",
    concept: "What is this place like? What is hidden here?",
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
  resumeEntryId,
  onSubmitted,
}: {
  request: RequestItem;
  /** Set when an earlier attempt saved the private marker but not the entry. */
  resumeEntryId?: string | null;
  /** Called once the entry has been saved, so the page can confirm it. */
  onSubmitted?: () => void;
  /** Shown only when there is something else on the page to go back to. */
  onCancel?: () => void;
}) {
  const { user } = useAuth();
  const copy = COPY[request.kind];

  const [name, setName] = useState("");
  const [concept, setConcept] = useState("");
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
      fields = buildEntryFields({ name, concept, traits: allTraits });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Check your answer and try again.");
      return;
    }

    setBusy(true);
    try {
      const db = getDb();
      const entryId = resumeEntryId ?? doc(collection(db, "entries")).id;

      // Two writes, in order. First a private marker that says "this person is
      // answering this request with this entry id" (it also records the hidden
      // author, and stops a second answer). Then the public entry, which carries
      // no author. Security rules check each against what already exists.
      if (!resumeEntryId) {
        await setDoc(doc(db, ...answerMarkerPath(request.id, user.uid)), {
          authorId: user.uid,
          requestId: request.id,
          entryId,
          createdAt: serverTimestamp(),
        });
      }
      await setDoc(doc(db, "entries", entryId), {
        requestId: request.id,
        kind: request.kind,
        ...fields,
        sparksNorm: request.sparksNorm,
        sparkKey: request.sparkKey,
        pairKeys: pairKeysFrom(request.sparksNorm),
        moderation: "ok",
        createdAt: serverTimestamp(),
      });
      onSubmitted?.();
      // The live listener on the page now shows the new entry as "Your entry".
    } catch (err) {
      console.error("Could not submit answer", err);
      setError(
        "Couldn't submit your answer. Answers may have just closed, or you may already have answered this request. If your connection dropped, try again: nothing is lost on this page.",
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
