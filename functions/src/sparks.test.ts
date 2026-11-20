import { test } from "node:test";
import assert from "node:assert/strict";
import { sparksChanged, sparksOf } from "./sparks.ts";

test("sparksOf reads the stored words and ignores anything else", () => {
  assert.deepEqual(sparksOf({ sparksNorm: ["a", "b", "c"] }), ["a", "b", "c"]);
  assert.deepEqual(sparksOf({ sparksNorm: ["a", 3, "", "b"] }), ["a", "b"]);
  assert.deepEqual(sparksOf({}), []);
  assert.deepEqual(sparksOf(undefined), []);
});

test("sparksChanged is true only when the words differ", () => {
  assert.equal(sparksChanged(["a", "b", "c"], ["a", "b", "c"]), false);
  assert.equal(sparksChanged([], []), false);
  assert.equal(sparksChanged([], ["a", "b", "c"]), true);
  assert.equal(sparksChanged(["a", "b", "c"], []), true);
  assert.equal(sparksChanged(["a", "b", "c"], ["a", "b", "d"]), true);
});
