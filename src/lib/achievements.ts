// Achievements. A copy of this file is kept in functions/src (run `npm run sync:functions`
// after changing it; a test fails if the copies differ). The xp function checks them each
// time it recounts a member and saves the ones unlocked on `users/{uid}.achievements`.
// Once unlocked, an achievement is kept even if the posts behind it are later hidden.
// Reaching a new rank is announced as a level-up rather than an achievement.

import type { XpCounts } from "./xp.ts";

export type Achievement = {
  id: string;
  name: string;
  description: string;
  earned: (c: XpCounts) => boolean;
};

export const ACHIEVEMENTS: readonly Achievement[] = [
  { id: "first_fire", name: "First fire", description: "Lit your first fire.", earned: (c) => c.fires >= 1 },
  { id: "first_answer", name: "First answer", description: "Answered a fire.", earned: (c) => c.answers >= 1 },
  { id: "first_stoke", name: "Good fire", description: "Had a fire stoked for the first time.", earned: (c) => c.stokes >= 1 },
  { id: "first_upvote", name: "Well said", description: "Got your first upvote on an answer.", earned: (c) => c.upvotes >= 1 },
  { id: "ten_upvotes", name: "Crowd favourite", description: "Got ten upvotes on your answers.", earned: (c) => c.upvotes >= 10 },
];

/** The ids of the achievements these counts have earned. */
export function earnedAchievements(counts: XpCounts): string[] {
  return ACHIEVEMENTS.filter((a) => a.earned(counts)).map((a) => a.id);
}

export function achievementById(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}
