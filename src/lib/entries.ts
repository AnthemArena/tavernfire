// Shared types and helpers for entries (the answers to a request).
//
// An entry never carries its author. Who wrote it lives in a separate,
// server-guarded collection (`entryAuthors`) until the reveal. See DATA_MODEL.md.

import { normaliseSpark } from "./sparks.ts";
import { isCategoryId } from "./categories.ts";
import type { RequestKind } from "./requests.ts";

export const ENTRY_NAME_MAX = 60;
export const ENTRY_CONCEPT_MAX = 600;
export const ENTRY_TRAITS_MAX = 5;
export const ENTRY_TRAIT_MAX = 24;

/** How long after posting the author can edit. Keep in step with firestore.rules (validEntryEdit). */
export const ENTRY_EDIT_WINDOW_HOURS = 24;

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

/** What the lifecycle function adds to an entry at the reveal. */
export type EntryReveal = {
  /** The author's chosen name at the time, or null if they never chose one. */
  authorName: string | null;
  picks: number;
  /** 1-based, ties share a rank; null when too few people voted to rank. */
  rank: number | null;
  favourite: boolean;
  /** Position to show, 0 first. */
  order: number;
};

export type EntryItem = {
  id: string;
  requestId: string;
  kind: RequestKind;
  /** When it was posted. A local estimate until the server confirms it. */
  createdAt: Date | null;
  /** True once the author has edited it. */
  edited: boolean;
  name: string;
  concept: string;
  traits: string[];
  /** Null until the results are revealed. Author and vote data only ever come from here. */
  reveal: EntryReveal | null;
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

function toReveal(data: Record<string, unknown>): EntryReveal | null {
  const result = data.result;
  if (data.revealedAt == null || typeof result !== "object" || result === null) return null;
  const r = result as Record<string, unknown>;
  return {
    authorName: typeof data.authorName === "string" && data.authorName !== "" ? data.authorName : null,
    picks: typeof r.picks === "number" ? r.picks : 0,
    rank: typeof r.rank === "number" ? r.rank : null,
    favourite: r.favourite === true,
    order: typeof r.order === "number" ? r.order : 0,
  };
}

/** "1st", "2nd", "3rd", "11th"; "Joint 2nd" when others share the rank. */
export function rankLabel(rank: number, tied: boolean): string {
  const lastTwo = rank % 100;
  const lastOne = rank % 10;
  const suffix =
    lastTwo >= 11 && lastTwo <= 13 ? "th" : lastOne === 1 ? "st" : lastOne === 2 ? "nd" : lastOne === 3 ? "rd" : "th";
  const base = `${rank}${suffix}`;
  return tied ? `Joint ${base}` : base;
}

/** Revealed entries in the order the function stored; any without results go last. */
export function orderRevealed<T extends { reveal: EntryReveal | null }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => (a.reveal?.order ?? Number.MAX_SAFE_INTEGER) - (b.reveal?.order ?? Number.MAX_SAFE_INTEGER),
  );
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
  const created = data.createdAt as { toDate?: () => Date } | null | undefined;
  return {
    id,
    requestId: data.requestId,
    kind: isCategoryId(data.kind) ? data.kind : "npc",
    createdAt: typeof created?.toDate === "function" ? created.toDate() : null,
    edited: data.editedAt != null,
    name: data.name,
    concept: data.concept,
    traits: Array.isArray(data.traits)
      ? (data.traits as unknown[]).filter((t): t is string => typeof t === "string")
      : [],
    reveal: toReveal(data),
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

/**
 * The moment the author's edit window ends: 24 hours after posting, but never
 * later than when the request stops accepting answers. Null if the posting time
 * is not known yet.
 */
export function editableUntil(entry: Pick<EntryItem, "createdAt">, answersCloseAt: Date): Date | null {
  if (!entry.createdAt) return null;
  const windowEnd = entry.createdAt.getTime() + ENTRY_EDIT_WINDOW_HOURS * 60 * 60 * 1000;
  return new Date(Math.min(windowEnd, answersCloseAt.getTime()));
}

/** "23 hours left", "45 min left", or null when the window is over. */
export function describeEditTimeLeft(until: Date, now: Date): string | null {
  const ms = until.getTime() - now.getTime();
  if (ms <= 0) return null;
  const hour = 60 * 60 * 1000;
  if (ms >= hour) {
    const hours = Math.floor(ms / hour);
    return hours === 1 ? "1 hour left" : `${hours} hours left`;
  }
  return `${Math.max(1, Math.floor(ms / 60_000))} min left`;
}
