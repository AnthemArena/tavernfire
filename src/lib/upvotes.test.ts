import { test } from "node:test";
import assert from "node:assert/strict";
import { shownUpvotes, sortAnswers, upvoteId } from "./upvotes.ts";

test("the upvote id is the answer and the person", () => {
  assert.equal(upvoteId("e1", "u9"), "e1_u9");
});

test("your own change shows at once, then the server's total takes over", () => {
  assert.equal(shownUpvotes(4, undefined), 4);
  assert.equal(shownUpvotes(4, { delta: 1, base: 4 }), 5);
  assert.equal(shownUpvotes(4, { delta: -1, base: 4 }), 3);
  // The server has moved on (it counted the change, or someone else voted): trust it.
  assert.equal(shownUpvotes(5, { delta: 1, base: 4 }), 5);
  assert.equal(shownUpvotes(0, { delta: -1, base: 0 }), 0);
});

test("top sorts by upvotes then newest; newest sorts by time", () => {
  const d = (n: number) => new Date(2026, 10, n);
  const items = [
    { id: "a", upvoteCount: 2, createdAt: d(1) },
    { id: "b", upvoteCount: 5, createdAt: d(2) },
    { id: "c", upvoteCount: 2, createdAt: d(3) },
    { id: "d", upvoteCount: 0, createdAt: null },
  ];
  assert.deepEqual(sortAnswers(items, "top").map((x) => x.id), ["b", "c", "a", "d"]);
  assert.deepEqual(sortAnswers(items, "newest").map((x) => x.id), ["c", "b", "a", "d"]);
  // A custom count (the screen's own optimistic one) is respected.
  assert.deepEqual(sortAnswers(items, "top", (x) => (x.id === "a" ? 9 : x.upvoteCount)).map((x) => x.id)[0], "a");
});
