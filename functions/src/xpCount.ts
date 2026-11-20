// Keeps each member's XP and level (`users/{uid}.xp`, `.level`) in step with what they
// have posted. Like the other counters this recounts from the posts every time, so
// running twice cannot leave it wrong, and hidden posts stop counting. Only this function
// writes these two fields (the rules do not let the app change them).

import type { Firestore } from "firebase-admin/firestore";
import { rankFor, xpFor, type XpCounts } from "./xp.ts";
import { earnedAchievements } from "./achievements.ts";
import { createNotification } from "./notify.ts";

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

export type XpResult = { xp: number; level: number; previousLevel: number; newAchievements: string[] } | null;

/**
 * Recompute a member's XP, level and achievements and save what changed, then tell them
 * about any new rank or achievement. Null if there is no such member.
 */
export async function recomputeXp(db: Firestore, uid: string): Promise<XpResult> {
  const ref = db.collection("users").doc(uid);
  const profile = await ref.get();
  if (!profile.exists) return null;
  const counts = await countFor(db, uid);
  const xp = xpFor(counts);
  const level = rankFor(xp).level;
  const oldXp = typeof profile.get("xp") === "number" ? (profile.get("xp") as number) : null;
  const oldLevel = typeof profile.get("level") === "number" ? (profile.get("level") as number) : 1;

  // Achievements are kept once earned, even if the posts behind them are hidden later.
  const had = profile.get("achievements");
  const kept = Array.isArray(had) ? had.filter((a): a is string => typeof a === "string") : [];
  const newAchievements = earnedAchievements(counts).filter((a) => !kept.includes(a));

  const patch: Record<string, unknown> = {};
  if (oldXp !== xp) patch.xp = xp;
  if (oldLevel !== level || profile.get("level") === undefined) patch.level = level;
  if (newAchievements.length > 0) patch.achievements = [...kept, ...newAchievements];
  if (Object.keys(patch).length > 0) await ref.update(patch);

  // Fixed ids mean a repeat run cannot announce the same thing twice. Going up several
  // ranks at once announces each one.
  for (let l = oldLevel + 1; l <= level; l++) {
    await createNotification(db, `levelup_${uid}_${l}`, { recipientId: uid, type: "levelup", level: l });
  }
  for (const a of newAchievements) {
    await createNotification(db, `achievement_${uid}_${a}`, { recipientId: uid, type: "achievement", achievement: a });
  }
  return { xp, level, previousLevel: oldLevel, newAchievements };
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
