// Keeps each member's XP and level (`users/{uid}.xp`, `.level`) in step with what they
// have posted. Like the other counters this recounts from the posts every time, so
// running twice cannot leave it wrong, and hidden posts stop counting. Only this function
// writes these two fields (the rules do not let the app change them).

import type { Firestore } from "firebase-admin/firestore";
import { rankFor, xpFor, type XpCounts } from "./xp.ts";

/** Count what a member has posted and received. Hidden posts are left out. */
export async function countFor(db: Firestore, uid: string): Promise<XpCounts> {
  const [fires, answers] = await Promise.all([
    db.collection("requests").where("requesterId", "==", uid).where("moderation", "==", "ok").get(),
    db.collection("entries").where("authorId", "==", uid).where("moderation", "==", "ok").get(),
  ]);
  const sum = (docs: { get: (f: string) => unknown }[], field: string) =>
    docs.reduce((n, d) => {
      const v = d.get(field);
      return n + (typeof v === "number" && v > 0 ? v : 0);
    }, 0);
  return {
    fires: fires.size,
    answers: answers.size,
    stokes: sum(fires.docs, "stokeCount"),
    upvotes: sum(answers.docs, "upvoteCount"),
  };
}

export type XpResult = { xp: number; level: number; previousLevel: number } | null;

/** Recompute a member's XP and level and save them if they changed. Null if there is no such member. */
export async function recomputeXp(db: Firestore, uid: string): Promise<XpResult> {
  const ref = db.collection("users").doc(uid);
  const profile = await ref.get();
  if (!profile.exists) return null;
  const xp = xpFor(await countFor(db, uid));
  const level = rankFor(xp).level;
  const oldXp = typeof profile.get("xp") === "number" ? (profile.get("xp") as number) : null;
  const oldLevel = typeof profile.get("level") === "number" ? (profile.get("level") as number) : 1;
  if (oldXp !== xp || oldLevel !== level) await ref.update({ xp, level });
  return { xp, level, previousLevel: oldLevel };
}

type Doc = Record<string, unknown> | undefined;

/**
 * Whether a change to a post could change its owner's XP: the post appeared or went away,
 * was hidden or restored, changed hands, or its count (upvotes / stokes) moved.
 * Other edits (the answer count and top answer written by another function, say) are ignored.
 */
export function xpMayChange(before: Doc, after: Doc, ownerField: string, countField: string): boolean {
  if (!before || !after) return true;
  return (
    before[ownerField] !== after[ownerField] ||
    before.moderation !== after.moderation ||
    before[countField] !== after[countField]
  );
}
