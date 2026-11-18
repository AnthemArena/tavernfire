// Shared types and helpers for entries (the answers to a request).
//
// An entry never carries its author. Who wrote it lives in a separate,
// server-guarded collection (`entryAuthors`) until the reveal. See DATA_MODEL.md.

import { normaliseSpark } from "./sparks.ts";

export const ENTRY_NAME_MAX = 60;
export const ENTRY_CONCEPT_MAX = 600;
export const ENTRY_TRAITS_MAX = 5;
export const ENTRY_TRAIT_MAX = 24;

export const REPORT_REASONS = [
  "ai_generated",
  "plagiarism",
  "spam",
  "abuse",
  "other",
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  ai_generated: "Looks AI-generated",
  plagiarism: "Copied from someone else",
  spam: "Spam",
  abuse: "Abusive or hateful",
  other: "Something else",
};

export type EntryItem = {
  id: string;
  requestId: string;
  name: string;
  concept: string;
  traits: string[];
};

export type EntryFields = {
  name: string;
  concept: string;
  traits: string[];
  traitsNorm: string[];
};

/** Tidy a trait for display: trim and collapse spaces. Returns "" if nothing is left. */
export function cleanTrait(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

/**
 * Check an answer and build the fields stored on an entry.
 * Throws an Error with a message that is safe to show to the person typing.
 */
export function buildEntryFields(input: {
  name: string;
  concept: string;
  traits: string[];
}): EntryFields {
  const name = input.name.trim();
  const concept = input.concept.trim();

  if (name === "") throw new Error("Give your entry a name.");
  if (name.length > ENTRY_NAME_MAX) {
    throw new Error(`The name can be up to ${ENTRY_NAME_MAX} characters.`);
  }
  if (concept === "") throw new Error("Describe your entry.");
  if (concept.length > ENTRY_CONCEPT_MAX) {
    throw new Error(`The description can be up to ${ENTRY_CONCEPT_MAX} characters.`);
  }

  const traits: string[] = [];
  const traitsNorm: string[] = [];
  for (const raw of input.traits) {
    const trait = cleanTrait(raw);
    const norm = normaliseSpark(trait);
    if (norm === "") continue;
    if (trait.length > ENTRY_TRAIT_MAX) {
      throw new Error(`A trait can be up to ${ENTRY_TRAIT_MAX} characters.`);
    }
    if (traitsNorm.includes(norm)) continue; // same trait twice
    traits.push(trait);
    traitsNorm.push(norm);
  }
  if (traits.length > ENTRY_TRAITS_MAX) {
    throw new Error(`Choose up to ${ENTRY_TRAITS_MAX} traits.`);
  }

  return { name, concept, traits, traitsNorm };
}

/** Convert a Firestore document into an EntryItem, or null if it is malformed. */
export function toEntryItem(
  id: string,
  data: Record<string, unknown>,
): EntryItem | null {
  if (
    typeof data.name !== "string" ||
    typeof data.concept !== "string" ||
    typeof data.requestId !== "string"
  ) {
    return null;
  }
  return {
    id,
    requestId: data.requestId,
    name: data.name,
    concept: data.concept,
    traits: Array.isArray(data.traits)
      ? (data.traits as unknown[]).filter((t): t is string => typeof t === "string")
      : [],
  };
}

/**
 * Where the private "I'm answering this request" marker lives: a document keyed
 * by the person, under the request. Use as doc(db, ...answerMarkerPath(r, uid)).
 */
export function answerMarkerPath(
  requestId: string,
  uid: string,
): [string, string, string, string] {
  return ["requests", requestId, "answerLocks", uid];
}

/**
 * Put entries in a random order that stays the same for this viewer.
 * `keys` remembers a random number per entry, so the cards don't reshuffle
 * when a live update arrives; new entries slot in at a random position.
 */
export function orderForViewer<T extends { id: string }>(
  items: T[],
  keys: Map<string, number>,
  random: () => number = Math.random,
  pinnedId?: string | null,
): T[] {
  for (const item of items) {
    if (!keys.has(item.id)) keys.set(item.id, random());
  }
  return [...items].sort((a, b) => {
    if (a.id === pinnedId) return -1;
    if (b.id === pinnedId) return 1;
    return (keys.get(a.id) ?? 0) - (keys.get(b.id) ?? 0);
  });
}
