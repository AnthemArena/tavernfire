import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanBallot, rankEntries, stableOrder } from "./ranking.ts";

const ids = ["a", "b", "c", "d"];

test("stable order is the same every time and for any input order", () => {
  assert.deepEqual(stableOrder("r1", ids), stableOrder("r1", [...ids].reverse()));
});

test("different requests shuffle differently", () => {
  const orders = new Set(["r1", "r2", "r3", "r4", "r5", "r6"].map((r) => stableOrder(r, ids).join()));
  assert.ok(orders.size > 1);
});

test("cleanBallot drops unknown entries and repeats and caps at three", () => {
  assert.deepEqual(cleanBallot(["a", "a", "zzz", "b", "c", "d"], new Set(ids)), ["a", "b", "c"]);
});

test("fewer than 3 ballots: picks shown, no ranks, no favourite, random order", () => {
  const out = rankEntries("r1", ids, [["a", "b"], ["a"]]);
  assert.deepEqual(out.map((e) => e.entryId), stableOrder("r1", ids));
  assert.ok(out.every((e) => e.rank === null && !e.favourite));
  assert.equal(out.find((e) => e.entryId === "a")?.picks, 2);
});

test("empty ballots do not count towards the 3", () => {
  const out = rankEntries("r1", ids, [["a"], ["a"], []]);
  assert.ok(out.every((e) => e.rank === null));
});

test("from 3 ballots: ordered by picks, ties share a rank", () => {
  const out = rankEntries("r1", ids, [["a", "b"], ["a", "c"], ["a", "b"]]);
  assert.deepEqual(out.map((e) => [e.picks, e.rank]), [[3, 1], [2, 2], [1, 3], [0, 4]]);
  assert.equal(out[0].entryId, "a");
  assert.equal(out[1].entryId, "b");
});

test("tied entries share a rank and the next rank skips", () => {
  const out = rankEntries("r1", ids, [["a", "b"], ["a", "b"], ["c"]]);
  assert.deepEqual(out.map((e) => e.rank), [1, 1, 3, 4]);
  assert.ok(!out.some((e) => e.favourite)); // a and b tie at the top
});

test("ties keep the stable pseudo-random order", () => {
  const out = rankEntries("r1", ids, [["a", "b"], ["a", "b"], ["c"]]);
  const tied = out.filter((e) => e.rank === 1).map((e) => e.entryId);
  assert.deepEqual(tied, stableOrder("r1", ["a", "b"]));
});

test("community favourite needs 3 picks and a strict lead", () => {
  const strong = rankEntries("r1", ids, [["a"], ["a"], ["a", "b"]]);
  assert.equal(strong[0].entryId, "a");
  assert.ok(strong[0].favourite);

  const weak = rankEntries("r1", ids, [["a"], ["a"], ["b"]]); // top has only 2 picks
  assert.ok(!weak[0].favourite);
});

test("one entry with enough ballots can be the favourite", () => {
  const out = rankEntries("r1", ["a"], [["a"], ["a"], ["a"]]);
  assert.ok(out[0].favourite);
});

test("no entries gives an empty result", () => {
  assert.deepEqual(rankEntries("r1", [], [["a"]]), []);
});
