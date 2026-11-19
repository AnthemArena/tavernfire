import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  NAME_MAX,
  RESERVED_FRAGMENTS,
  RESERVED_NAMES,
  NameError,
  nameKey,
  nextNameChange,
  tidyName,
  validateName,
} from "./names.ts";

test("tidyName collapses spaces", () => {
  assert.equal(tidyName("  Dun   Gan "), "Dun Gan");
});

test("nameKey ignores capitals, spaces and punctuation", () => {
  assert.equal(nameKey("Dun Gan_01"), "dungan01");
  assert.equal(nameKey("DUNGAN-01"), "dungan01");
});

test("valid names pass and come back tidy", () => {
  assert.equal(validateName("  Marrow  Fen "), "Marrow Fen");
  assert.equal(validateName("O'Brien"), "O'Brien");
});

test("too short, too long and odd characters are refused", () => {
  assert.throws(() => validateName("ab"), NameError);
  assert.throws(() => validateName("a".repeat(NAME_MAX + 1)), NameError);
  assert.throws(() => validateName("_hidden"), NameError);
  assert.throws(() => validateName("Bob <3"), NameError);
  assert.throws(() => validateName("...."), NameError);
});

test("reserved words are refused whatever the capitals or spacing", () => {
  assert.throws(() => validateName("Admin"), NameError);
  assert.throws(() => validateName("A d m i n"), NameError);
  assert.throws(() => validateName("Tavern Fire Staff"), NameError);
  assert.throws(() => validateName("Moderator Mike"), NameError);
});

test("the change window", () => {
  const changed = new Date("2026-11-01T00:00:00Z");
  assert.equal(nextNameChange(null, new Date()), null);
  assert.ok(nextNameChange(changed, new Date("2026-11-05T00:00:00Z")));
  assert.equal(nextNameChange(changed, new Date("2026-11-09T00:00:00Z")), null);
});

test("firestore.rules uses the same reserved names", () => {
  const rules = readFileSync("firestore.rules", "utf8");
  for (const w of RESERVED_NAMES) assert.ok(rules.includes(`'${w}'`), `rules missing ${w}`);
  for (const w of RESERVED_FRAGMENTS) assert.ok(rules.includes(w), `rules missing ${w}`);
});
