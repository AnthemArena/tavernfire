// Library search: find answers by the sparks of the fire they answered.
//
// Search one, two or three sparks. Answers whose fire has all of them come first,
// then answers sharing two, then one; within each group the most upvoted comes first.
// The queries use the keys stored on every answer (sparkKey, pairKeys, sparksNorm,
// see DATA_MODEL.md), so no search service is needed.

import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
  type Firestore,
  type QueryConstraint,
} from "firebase/firestore";
import { SPARK_COUNT, SPARK_MAX_LENGTH, normaliseSpark } from "./sparks.ts";
import { toEntryItem, type EntryItem } from "./entries.ts";

/** Most answers fetched per query. */
export const RESULTS_PER_QUERY = 30;

export type LibraryResult = {
  entry: EntryItem;
  /** The three normalised sparks of the fire this answer belongs to. */
  sparks: string[];
  /** How many of the searched sparks that fire has. */
  matched: number;
};

/** Turn "Statue, time ,glowing" (or the ?s= value) into up to three clean, distinct sparks. */
export function parseSparks(raw: string | string[]): string[] {
  const parts = Array.isArray(raw) ? raw : raw.split(",");
  const out: string[] = [];
  for (const part of parts) {
    const norm = normaliseSpark(part).slice(0, SPARK_MAX_LENGTH);
    // A spark is one word; anything with a space is not searchable as one.
    if (norm === "" || norm.includes(" ") || out.includes(norm)) continue;
    out.push(norm);
    if (out.length === SPARK_COUNT) break;
  }
  return out;
}

/** How many of the searched sparks a fire has. */
export function overlap(fireSparks: string[], searched: string[]): number {
  return searched.filter((s) => fireSparks.includes(s)).length;
}

/** Sorted "a|b" keys for every pair of the searched sparks. */
export function pairKeysOf(sparks: string[]): string[] {
  const sorted = [...sparks].sort();
  const keys: string[] = [];
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) keys.push(`${sorted[i]}|${sorted[j]}`);
  }
  return keys;
}

/**
 * Put results in the order people should see them: most matching sparks first, then
 * most upvoted, then newest. Drops duplicates and anything matching none of the sparks.
 */
export function rankResults(results: LibraryResult[]): LibraryResult[] {
  const seen = new Set<string>();
  return results
    .filter((r) => {
      if (r.matched === 0 || seen.has(r.entry.id)) return false;
      seen.add(r.entry.id);
      return true;
    })
    .sort(
      (a, b) =>
        b.matched - a.matched ||
        b.entry.upvoteCount - a.entry.upvoteCount ||
        (b.entry.createdAt?.getTime() ?? 0) - (a.entry.createdAt?.getTime() ?? 0),
    );
}

/** The heading for a group of results, given how many sparks they share. */
export function matchHeading(matched: number, searched: number): string {
  if (matched >= searched) return searched === 1 ? "Answers for this spark" : "Exact matches";
  if (matched === 2) return "Share two of your sparks";
  return "Share one of your sparks";
}

/** Search the library. Needs the indexes in firestore.indexes.json. */
export async function searchLibrary(db: Firestore, searched: string[]): Promise<LibraryResult[]> {
  if (searched.length === 0) return [];
  const entries = collection(db, "entries");
  const base: QueryConstraint[] = [
    where("moderation", "==", "ok"),
  ];
  const finish: QueryConstraint[] = [orderBy("upvoteCount", "desc"), limit(RESULTS_PER_QUERY)];

  const queries: QueryConstraint[][] = [];
  if (searched.length === SPARK_COUNT) {
    queries.push([...base, where("sparkKey", "==", [...searched].sort().join("|")), ...finish]);
  }
  if (searched.length >= 2) {
    const pairs = pairKeysOf(searched);
    queries.push([...base, where("pairKeys", "array-contains-any", pairs), ...finish]);
  }
  // Any answer with at least one of the sparks (this also covers the single-spark search).
  queries.push([...base, where("sparksNorm", "array-contains-any", searched), ...finish]);

  const snaps = await Promise.all(queries.map((q) => getDocs(query(entries, ...q))));
  const found: LibraryResult[] = [];
  for (const snap of snaps) {
    for (const d of snap.docs) {
      const data = d.data();
      const entry = toEntryItem(d.id, data);
      if (!entry) continue;
      const sparks = Array.isArray(data.sparksNorm)
        ? (data.sparksNorm as unknown[]).filter((s): s is string => typeof s === "string")
        : [];
      found.push({ entry, sparks, matched: overlap(sparks, searched) });
    }
  }
  return rankResults(found);
}
