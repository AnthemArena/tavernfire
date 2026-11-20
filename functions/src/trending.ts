// Stokes on fires, and the "trending" rank.
//
// Trending uses one stored number per fire, `trendRank`, so the app can sort on it with
// an ordinary index and no scheduled job. Each stoke or upvote adds weight to the fire's
// score, and the score fades with a half-life (a fire needs fresh activity to stay up).
// A score that fades by e^(-t/tau) ranks the same as log(score) + time/tau, so we store
// that second number, which never has to be rewritten as time passes.

import type { Firestore } from "firebase-admin/firestore";

const DAY = 24 * 60 * 60 * 1000;
export const TREND_HALF_LIFE_DAYS = 3;
const TAU_MS = (TREND_HALF_LIFE_DAYS * DAY) / Math.LN2;

/** A stoke says "good fire"; an upvote on one of its answers says "good answer". */
export const STOKE_WEIGHT = 2;
export const UPVOTE_WEIGHT = 1;

export type Trend = { score: number; at: number };

/** Fade the old score to now, add the new weight, and work out the rank to sort by. */
export function bumpTrend(
  prev: Trend | null,
  weight: number,
  nowMs: number,
): Trend & { rank: number } {
  const faded = prev ? prev.score * Math.exp(-Math.max(0, nowMs - prev.at) / TAU_MS) : 0;
  const score = faded + weight;
  return { score, at: nowMs, rank: Math.log(score) + nowMs / TAU_MS };
}

/** Add weight to a fire's trend. Skips a fire that no longer exists. */
export async function addTrend(
  db: Firestore,
  requestId: string,
  weight: number,
  nowMs: number,
): Promise<void> {
  const ref = db.collection("requests").doc(requestId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const score = snap.get("trendScore");
    const at = snap.get("trendAt");
    const prev = typeof score === "number" && typeof at === "number" ? { score, at } : null;
    const next = bumpTrend(prev, weight, nowMs);
    tx.update(ref, { trendScore: next.score, trendAt: next.at, trendRank: next.rank });
  });
}

/** Count the stokes for a fire and store the total on it. Returns the total. */
export async function recountStokes(db: Firestore, requestId: string): Promise<number | null> {
  const ref = db.collection("requests").doc(requestId);
  if (!(await ref.get()).exists) return null;
  const snap = await db.collection("stokes").where("requestId", "==", requestId).count().get();
  const total = snap.data().count;
  await ref.update({ stokeCount: total });
  return total;
}
