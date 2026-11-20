import { test } from "node:test";
import assert from "node:assert/strict";
import { bumpTrend, TREND_HALF_LIFE_DAYS } from "./trending.ts";

const DAY = 24 * 60 * 60 * 1000;
const t0 = Date.UTC(2026, 10, 20);

test("the first activity gives a score equal to its weight", () => {
  const t = bumpTrend(null, 2, t0);
  assert.equal(t.score, 2);
  assert.equal(t.at, t0);
});

test("a score halves after the half-life, then the new weight is added", () => {
  const first = bumpTrend(null, 4, t0);
  const later = bumpTrend(first, 1, t0 + TREND_HALF_LIFE_DAYS * DAY);
  assert.ok(Math.abs(later.score - 3) < 1e-9, `expected 3, got ${later.score}`);
});

test("recent activity outranks the same activity a week ago", () => {
  const old = bumpTrend(null, 5, t0);
  const fresh = bumpTrend(null, 5, t0 + 7 * DAY);
  assert.ok(fresh.rank > old.rank);
});

test("rank order matches the order of the faded scores at any later moment", () => {
  // A: big burst long ago. B: small burst now. Compare both ways.
  const a = bumpTrend(null, 10, t0);
  const b = bumpTrend(null, 2, t0 + 6 * DAY);
  const at = t0 + 6 * DAY;
  const fadedA = a.score * Math.exp(-(at - a.at) / ((TREND_HALF_LIFE_DAYS * DAY) / Math.LN2));
  assert.equal(b.rank > a.rank, b.score > fadedA);
});

test("activity never moves a score backwards in time", () => {
  const first = bumpTrend(null, 3, t0);
  const skewed = bumpTrend(first, 1, t0 - DAY); // a clock slightly behind
  assert.ok(skewed.score >= 4 - 1e-9);
});
