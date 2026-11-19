import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_PICKS, ballotPath, picksLeft, togglePick } from "./ballots.ts";

test("ballotPath", () => {
  assert.equal(ballotPath("r1", "u1"), "requests/r1/ballots/u1");
});

test("picking adds, picking again removes", () => {
  assert.deepEqual(togglePick([], "a"), ["a"]);
  assert.deepEqual(togglePick(["a", "b"], "a"), ["b"]);
});

test("a fourth pick is refused, but un-picking at the cap works", () => {
  const full = ["a", "b", "c"];
  assert.equal(full.length, MAX_PICKS);
  assert.equal(togglePick(full, "d"), null);
  assert.deepEqual(togglePick(full, "b"), ["a", "c"]);
});

test("picksLeft", () => {
  assert.equal(picksLeft([]), 3);
  assert.equal(picksLeft(["a", "b", "c"]), 0);
});
