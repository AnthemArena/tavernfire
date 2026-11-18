"use client";

import { useId, type KeyboardEvent } from "react";
import {
  ENTRY_TRAITS_MAX,
  ENTRY_TRAIT_MAX,
  cleanTrait,
} from "@/lib/entries";
import { normaliseSpark } from "@/lib/sparks";

/**
 * Traits as pills. Type a trait and press Enter or comma to add it; each pill
 * has a remove button. The text being typed is owned by the parent, so a trait
 * you typed but didn't confirm can still be included when the form is sent.
 */
export default function TraitInput({
  traits,
  onChange,
  draft,
  onDraftChange,
}: {
  traits: string[];
  onChange: (next: string[]) => void;
  draft: string;
  onDraftChange: (next: string) => void;
}) {
  const id = useId();
  const full = traits.length >= ENTRY_TRAITS_MAX;

  function commit() {
    const trait = cleanTrait(draft);
    if (trait === "") return;
    const norm = normaliseSpark(trait);
    const duplicate = traits.some((t) => normaliseSpark(t) === norm);
    if (!duplicate && norm !== "" && !full) onChange([...traits, trait]);
    onDraftChange("");
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault(); // Enter must not submit the whole form
      commit();
    } else if (event.key === "Backspace" && draft === "" && traits.length > 0) {
      onChange(traits.slice(0, -1));
    }
  }

  return (
    <div className="field">
      <label className="label" htmlFor={id}>
        Traits (optional)
      </label>

      {traits.length > 0 && (
        <ul className="trait-list trait-list-editable" aria-label="Your traits">
          {traits.map((trait) => (
            <li className="trait" key={trait}>
              {trait}
              <button
                type="button"
                className="trait-remove"
                aria-label={`Remove trait ${trait}`}
                onClick={() => onChange(traits.filter((t) => t !== trait))}
              >
                <span aria-hidden="true">×</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <input
        id={id}
        className="input"
        type="text"
        value={draft}
        maxLength={ENTRY_TRAIT_MAX}
        disabled={full}
        placeholder={full ? "That's all five" : "e.g. patient, grieving, cold"}
        onChange={(e) => onDraftChange(e.target.value.replace(",", ""))}
        onKeyDown={onKeyDown}
        onBlur={commit}
        aria-describedby={`${id}-hint`}
      />
      <p className="hint" id={`${id}-hint`}>
        <span aria-live="polite">
          {traits.length} of {ENTRY_TRAITS_MAX} traits.
        </span>{" "}
        Press Enter or comma to add one. Traits describe your entry and help
        people find it; they are separate from the three sparks.
      </p>
    </div>
  );
}
