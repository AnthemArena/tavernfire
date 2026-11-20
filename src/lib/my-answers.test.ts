import { test } from "node:test";
import assert from "node:assert/strict";
import { answerStatus } from "./my-answers.ts";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-11-17T12:00:00Z");
const ago = (days: number) => new Date(now.getTime() - days * DAY);

test("an answer says when it was posted", () => {
  assert.equal(answerStatus({ createdAt: ago(3) }, now), "Posted 3 days ago");
  assert.equal(answerStatus({ createdAt: ago(1) }, now), "Posted 1 day ago");
  assert.equal(answerStatus({ createdAt: null }, now), "Just posted");
});

test("a removed or hidden answer says so", () => {
  assert.equal(answerStatus(null, now), "This answer is no longer shown.");
});
