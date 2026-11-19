import { test } from "node:test";
import assert from "node:assert/strict";
import { answerStatus } from "./my-answers.ts";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-11-17T12:00:00Z");
const ago = (days: number) => new Date(now.getTime() - days * DAY);
const reveal = (over = {}) => ({
  reveal: { authorName: "Ann", picks: 5, rank: 2, favourite: false, tied: true, order: 1, ...over },
});

test("before the reveal it only says when results come, never anything about votes", () => {
  assert.equal(answerStatus({ status: "open", createdAt: ago(1) }, { reveal: null }, now), "Results after 21 November");
  assert.equal(answerStatus({ status: "voting", createdAt: ago(4) }, { reveal: null }, now), "Results after 18 November");
  assert.equal(answerStatus({ status: "open", createdAt: ago(5.5) }, { reveal: null }, now), "Counting votes");
});

test("after the reveal it gives rank, favourite and picks", () => {
  const r = { status: "revealed" as const, createdAt: ago(6) };
  assert.equal(answerStatus(r, reveal(), now), "Joint 2nd · 5 picks");
  assert.equal(answerStatus(r, reveal({ rank: 1, tied: false, favourite: true, picks: 9 }), now), "Community favourite · 1st · 9 picks");
  assert.equal(answerStatus(r, reveal({ rank: null, picks: 1 }), now), "1 pick");
  assert.equal(answerStatus(r, reveal({ rank: null, picks: 0 }), now), "Results are in");
});

test("a removed or hidden answer says so", () => {
  assert.equal(answerStatus({ status: "open", createdAt: ago(1) }, null, now), "This answer is no longer shown.");
});
