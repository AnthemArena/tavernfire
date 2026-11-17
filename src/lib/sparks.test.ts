import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSparkFields, normaliseSpark } from "./sparks.ts";

test("normaliseSpark lowercases, trims and strips punctuation", () => {
  assert.equal(normaliseSpark("  Glowing! "), "glowing");
  assert.equal(normaliseSpark("STATUE."), "statue");
  assert.equal(normaliseSpark("Half-Elf"), "half-elf");
  assert.equal(normaliseSpark("---"), "");
  assert.equal(normaliseSpark("  "), "");
});

test("buildSparkFields sorts the sparks and builds the keys", () => {
  const f = buildSparkFields(["Statue", "Time", "Glowing"]);
  assert.deepEqual(f.sparks, ["Statue", "Time", "Glowing"]);
  assert.deepEqual(f.sparksNorm, ["glowing", "statue", "time"]);
  assert.equal(f.sparkKey, "glowing|statue|time");
  assert.deepEqual(f.pairKeys, [
    "glowing|statue",
    "glowing|time",
    "statue|time",
  ]);
});

test("the same three sparks in any order give the same keys", () => {
  const a = buildSparkFields(["Statue", "Time", "Glowing"]);
  const b = buildSparkFields(["glowing", "STATUE", "time"]);
  assert.equal(a.sparkKey, b.sparkKey);
  assert.deepEqual(a.pairKeys, b.pairKeys);
});

test("rejects empty, duplicate, multi-word and over-long sparks", () => {
  assert.throws(() => buildSparkFields(["a", "b", ""]), /needs a word/);
  assert.throws(() => buildSparkFields(["Time", "time", "Glowing"]), /different/);
  assert.throws(() => buildSparkFields(["ice cream", "b", "c"]), /single word/);
  assert.throws(() => buildSparkFields(["a".repeat(31), "b", "c"]), /30 characters/);
  assert.throws(() => buildSparkFields(["a", "b"]), /three sparks/);
});
