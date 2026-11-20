import { test } from "node:test";
import assert from "node:assert/strict";
import { cloudSize, displayWord, fireCount, rankSuggestions } from "./spark-suggestions.ts";

test("most-used first, then alphabetical, capped", () => {
  const found = [
    { word: "river", count: 2 },
    { word: "statue", count: 9 },
    { word: "stone", count: 2 },
    { word: "storm", count: 1 },
  ];
  assert.deepEqual(rankSuggestions(found, [], 3).map((s) => s.word), ["statue", "river", "stone"]);
});

test("words already chosen are left out, whatever case they were typed in", () => {
  const found = [
    { word: "statue", count: 9 },
    { word: "storm", count: 1 },
  ];
  assert.deepEqual(rankSuggestions(found, ["Statue", ""]).map((s) => s.word), ["storm"]);
});

test("malformed entries are ignored", () => {
  const found = [
    { word: 5, count: 3 },
    { word: "ok", count: "3" },
    { word: "gone", count: 0 },
    { word: "fine", count: 1 },
  ];
  assert.deepEqual(rankSuggestions(found, []).map((s) => s.word), ["fine"]);
});

test("labels", () => {
  assert.equal(displayWord("statue"), "Statue");
  assert.equal(displayWord(""), "");
  assert.equal(fireCount(1), "1 fire");
  assert.equal(fireCount(14), "14 fires");
});

test("cloud sizes follow how popular a spark is", () => {
  assert.equal(cloudSize(10, 10), 2);
  assert.equal(cloudSize(5, 10), 1);
  assert.equal(cloudSize(1, 10), 0);
  assert.equal(cloudSize(1, 1), 0); // everything used once: all the same size
});
