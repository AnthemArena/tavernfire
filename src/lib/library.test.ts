import { test } from "node:test";
import assert from "node:assert/strict";
import { matchHeading, overlap, pairKeysOf, parseSparks, rankResults, type LibraryResult } from "./library.ts";
import type { RequestItem } from "./requests.ts";

test("parseSparks cleans, dedupes and caps at three", () => {
  assert.deepEqual(parseSparks("Statue, time ,glowing"), ["statue", "time", "glowing"]);
  assert.deepEqual(parseSparks("Statue,statue,  ,Time"), ["statue", "time"]);
  assert.deepEqual(parseSparks("a,b,c,d"), ["a", "b", "c"]);
  assert.deepEqual(parseSparks("two words,fine"), ["fine"]);
  assert.deepEqual(parseSparks(["Statue!", "TIME"]), ["statue", "time"]);
  assert.deepEqual(parseSparks(""), []);
});

test("pairKeysOf gives sorted pairs matching the stored pairKeys", () => {
  assert.deepEqual(pairKeysOf(["time", "statue", "glowing"]), [
    "glowing|statue",
    "glowing|time",
    "statue|time",
  ]);
  assert.deepEqual(pairKeysOf(["a", "b"]), ["a|b"]);
  assert.deepEqual(pairKeysOf(["a"]), []);
});

test("overlap counts searched sparks the fire has", () => {
  assert.equal(overlap(["a", "b", "c"], ["a", "c", "z"]), 2);
  assert.equal(overlap(["a", "b", "c"], []), 0);
});

function result(id: string, matched: number, stokes: number, ageDays = 0): LibraryResult {
  const fire = {
    id,
    stokeCount: stokes,
    createdAt: new Date(Date.UTC(2026, 10, 20) - ageDays * 86_400_000),
  } as RequestItem;
  return { fire, matched };
}

test("rankResults: more matching sparks first, then stokes, then newest", () => {
  const ranked = rankResults([
    result("one-spark-popular", 1, 50),
    result("exact-quiet", 3, 0, 5),
    result("exact-new", 3, 0, 1),
    result("two-sparks", 2, 4),
    result("exact-popular", 3, 9),
  ]);
  assert.deepEqual(
    ranked.map((r) => r.fire.id),
    ["exact-popular", "exact-new", "exact-quiet", "two-sparks", "one-spark-popular"],
  );
});

test("rankResults drops duplicates and fires matching nothing", () => {
  const ranked = rankResults([result("a", 2, 1), result("a", 2, 1), result("b", 0, 99)]);
  assert.deepEqual(ranked.map((r) => r.fire.id), ["a"]);
});

test("headings", () => {
  assert.equal(matchHeading(3, 3), "Fires with these sparks");
  assert.equal(matchHeading(2, 3), "Share two of your sparks");
  assert.equal(matchHeading(1, 3), "Share one of your sparks");
  assert.equal(matchHeading(2, 2), "Fires with these sparks");
  assert.equal(matchHeading(1, 2), "Share one of your sparks");
  assert.equal(matchHeading(1, 1), "Fires with this spark");
});
