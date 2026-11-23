// XP and ranks. This file has no imports because a copy is kept in functions/src
// (run `npm run sync:functions` after changing it; a test fails if the copies differ).
//
// XP is worked out from what a member has posted and what the community did with it,
// never stored as a running total that could drift: the xp function recounts it.
// Quality counts for more than volume: posting earns a little, being upvoted or stoked
// earns the most. Hidden posts (moderation) do not count.

export const XP_FOR = {
  fire: 5, // each fire lit
  answer: 5, // each answer posted
  upvote: 10, // each upvote on one of your answers
  stoke: 10, // each stoke on one of your fires
} as const;

export type XpCounts = { fires: number; answers: number; upvotes: number; stokes: number };

export function xpFor(c: XpCounts): number {
  return c.fires * XP_FOR.fire + c.answers * XP_FOR.answer + c.upvotes * XP_FOR.upvote + c.stokes * XP_FOR.stoke;
}

export type Rank = {
  level: number;
  name: string;
  /** XP needed to reach this level. */
  minXp: number;
};

export const RANKS: readonly Rank[] = [
  { level: 1, name: "Cinderling", minXp: 0 },
  { level: 2, name: "Flamebearer", minXp: 50 },
  { level: 3, name: "Pyromancer", minXp: 150 },
  { level: 4, name: "Blazewalker", minXp: 400 },
  { level: 5, name: "Phoenix Ascendant", minXp: 1000 },
];

/** The rank someone with this much XP holds. */
export function rankFor(xp: number): Rank {
  let held = RANKS[0];
  for (const r of RANKS) if (xp >= r.minXp) held = r;
  return held;
}

export function rankByLevel(level: number): Rank {
  return RANKS.find((r) => r.level === level) ?? RANKS[0];
}

/** How far through the current rank someone is, and what comes next (null at the top). */
export function rankProgress(xp: number): { rank: Rank; next: Rank | null; fraction: number; toNext: number } {
  const rank = rankFor(xp);
  const next = RANKS.find((r) => r.level === rank.level + 1) ?? null;
  if (!next) return { rank, next: null, fraction: 1, toNext: 0 };
  return {
    rank,
    next,
    fraction: (xp - rank.minXp) / (next.minXp - rank.minXp),
    toNext: next.minXp - xp,
  };
}
