// Keeps the list of sparks in use (`sparks/{word}`) in step with the fires.
//
// Each document is one normalised spark with how many fires use it. The lit-fire
// form reads this list to suggest words that already exist. Like the vote counts,
// this recounts instead of adding one, so a trigger that runs twice cannot leave
// a total wrong. Nobody but this function can write the list.

import type { Firestore } from "firebase-admin/firestore";

/** The sparks a fire carries, as stored (`sparksNorm`). Anything else gives an empty list. */
export function sparksOf(data: { sparksNorm?: unknown } | undefined): string[] {
  const norm = data?.sparksNorm;
  if (!Array.isArray(norm)) return [];
  return norm.filter((s): s is string => typeof s === "string" && s !== "");
}

/** True when the two fires' sparks differ, i.e. the list could need updating. */
export function sparksChanged(before: string[], after: string[]): boolean {
  return before.length !== after.length || before.some((s, i) => s !== after[i]);
}

/** Recount each spark across all fires. A spark no fire uses any more is removed from the list. */
export async function recountSparks(db: Firestore, norms: string[]): Promise<Record<string, number>> {
  const totals: Record<string, number> = {};
  for (const norm of new Set(norms)) {
    const snap = await db.collection("requests").where("sparksNorm", "array-contains", norm).count().get();
    const count = snap.data().count;
    totals[norm] = count;
    const ref = db.collection("sparks").doc(norm);
    if (count === 0) await ref.delete();
    else await ref.set({ word: norm, count });
  }
  return totals;
}
