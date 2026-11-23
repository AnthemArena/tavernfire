import { test } from "node:test";
import assert from "node:assert/strict";
import { pickTop, snippetOf } from "./answers.ts";

test("short text is kept whole, long text is cut at a word", () => {
  assert.equal(snippetOf("  A statue\nthat  waits. "), "A statue that waits.");
  const long = "word ".repeat(60);
  const cut = snippetOf(long, 40);
  assert.ok(cut.endsWith("…"));
  assert.ok(cut.length <= 41);
  assert.ok(!cut.slice(0, -1).endsWith(" "));
});

test("the most upvoted answer is the top one, the oldest wins a tie", () => {
  const rows = [
    { name: "Old", concept: "a", upvoteCount: 2, createdMs: 1 },
    { name: "Popular", concept: "b", upvoteCount: 5, createdMs: 3 },
    { name: "Tied, newer", concept: "c", upvoteCount: 5, createdMs: 4 },
  ];
  assert.equal(pickTop(rows)?.name, "Popular");
  assert.equal(pickTop([{ name: "A", concept: "x", upvoteCount: 0, createdMs: 9 }, { name: "B", concept: "y", createdMs: 2 }])?.name, "B");
});

test("no answers, or unusable ones, give no top answer", () => {
  assert.equal(pickTop([]), null);
  assert.equal(pickTop([{ name: 3, concept: "x", upvoteCount: 1, createdMs: 1 }]), null);
});

test("the top answer carries its author, or null when there is none", () => {
  assert.equal(pickTop([{ name: "A", concept: "x", upvoteCount: 1, createdMs: 1, authorName: "LightReign" }])?.author, "LightReign");
  assert.equal(pickTop([{ name: "A", concept: "x", upvoteCount: 1, createdMs: 1 }])?.author, null);
});

test("a cut snippet never has punctuation before the ellipsis", () => {
  const cut = snippetOf("A long note about testing. And then it goes on and on past the limit", 26);
  assert.ok(cut.endsWith("…"));
  assert.ok(!/[.,;:!?]…$/.test(cut));
});
