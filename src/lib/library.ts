// Library search: find fires by their sparks.
//
// Search one, two or three sparks. Fires that have all of them come first, then fires
// sharing two, then one; within each group the most stoked comes first. A fire carries
// its answer count and its best answer (kept by a Cloud Function), so a result can show
// them without reading the answers. The queries use the keys stored on every fire
// (sparkKey, pairKeys, sparksNorm, see DATA_MODEL.md), so no search service is needed.

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
import { toRequestItem, type RequestItem } from "./requests.ts";

/** Most fires fetched per query. */
export const RESULTS_PER_QUERY = 30;

export type LibraryResult = {
  fire: RequestItem;
  /** How many of the searched sparks this fire has (0 when browsing). */
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
 * most stoked, then newest. Drops duplicates and fires matching none of the sparks.
 */
export function rankResults(results: LibraryResult[]): LibraryResult[] {
  const seen = new Set<string>();
  return results
    .filter((r) => {
      if (r.matched === 0 || seen.has(r.fire.id)) return false;
      seen.add(r.fire.id);
      return true;
    })
    .sort(
      (a, b) =>
        b.matched - a.matched ||
        b.fire.stokeCount - a.fire.stokeCount ||
        b.fire.createdAt.getTime() - a.fire.createdAt.getTime(),
    );
}

/** The heading for a group of results, given how many sparks they share. */
export function matchHeading(matched: number, searched: number): string {
  if (matched >= searched) return searched === 1 ? "Fires with this spark" : "Fires with these sparks";
  if (matched === 2) return "Share two of your sparks";
  return "Share one of your sparks";
}

function toResults(
  docs: { id: string; data: () => Record<string, unknown> }[],
  searched: string[],
): LibraryResult[] {
  const out: LibraryResult[] = [];
  for (const d of docs) {
    const fire = toRequestItem(d.id, d.data());
    if (fire) out.push({ fire, matched: overlap(fire.sparksNorm, searched) });
  }
  return out;
}

/** The most stoked fires overall, newest first among ties. Shown when nothing is searched yet. */
export async function browseLibrary(db: Firestore): Promise<LibraryResult[]> {
  const snap = await getDocs(
    query(
      collection(db, "requests"),
      where("moderation", "==", "ok"),
      orderBy("stokeCount", "desc"),
      orderBy("createdAt", "desc"),
      limit(RESULTS_PER_QUERY),
    ),
  );
  return toResults(snap.docs, []);
}

/** Search the library. Needs the indexes in firestore.indexes.json. */
export async function searchLibrary(db: Firestore, searched: string[]): Promise<LibraryResult[]> {
  if (searched.length === 0) return [];
  const fires = collection(db, "requests");
  const base: QueryConstraint[] = [where("moderation", "==", "ok")];
  const finish: QueryConstraint[] = [orderBy("stokeCount", "desc"), limit(RESULTS_PER_QUERY)];

  const queries: QueryConstraint[][] = [];
  if (searched.length === SPARK_COUNT) {
    queries.push([...base, where("sparkKey", "==", [...searched].sort().join("|")), ...finish]);
  }
  if (searched.length >= 2) {
    queries.push([...base, where("pairKeys", "array-contains-any", pairKeysOf(searched)), ...finish]);
  }
  // Any fire with at least one of the sparks (this also covers the single-spark search).
  queries.push([...base, where("sparksNorm", "array-contains-any", searched), ...finish]);

  const snaps = await Promise.all(queries.map((q) => getDocs(query(fires, ...q))));
  return rankResults(snaps.flatMap((snap) => toResults(snap.docs, searched)));
}
