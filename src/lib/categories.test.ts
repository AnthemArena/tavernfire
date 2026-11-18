import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CATEGORIES, LAUNCHED_CATEGORIES, getCategory, isCategoryId } from "./categories.ts";
import { kindLabel, toRequestItem } from "./requests.ts";

test("category ids are unique, lowercase and stable-looking", () => {
  const ids = CATEGORIES.map((c) => c.id as string);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /^[a-z]+$/);
});

test("every category has all its wording filled in", () => {
  for (const c of CATEGORIES) {
    for (const text of [
      c.label,
      c.fullLabel,
      c.filterLabel,
      c.answer.namePlaceholder,
      c.answer.conceptPlaceholder,
      c.answer.tagsLabel,
      c.answer.tagsPlaceholder,
    ]) {
      assert.ok(text.trim().length > 0, `${c.id} has an empty wording field`);
    }
  }
});

test("only launched categories are offered to people", () => {
  assert.ok(LAUNCHED_CATEGORIES.length > 0);
  for (const c of LAUNCHED_CATEGORIES) assert.equal(c.launched, true);
});

test("isCategoryId and getCategory agree", () => {
  assert.equal(isCategoryId("npc"), true);
  assert.equal(isCategoryId("dragon"), false);
  assert.equal(isCategoryId(undefined), false);
  assert.equal(getCategory("location").label, "Location");
  assert.equal(kindLabel("npc"), "NPC");
});

test("a request with an unknown type is skipped, not shown", () => {
  const base = {
    sparks: ["a", "b", "c"],
    createdAt: { toDate: () => new Date() },
  };
  assert.ok(toRequestItem("r1", { ...base, kind: "npc" }));
  assert.equal(toRequestItem("r2", { ...base, kind: "dragon" }), null);
});

// firestore.rules cannot import this list, so the accepted types are written out
// there too. This keeps the two copies identical: a category that is launched in
// code but not allowed by the rules (or the reverse) fails here, not in production.
test("the types allowed by firestore.rules are exactly the launched categories", () => {
  const rules = readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8");
  const matches = [...rules.matchAll(/d\.kind in \[([^\]]*)\]/g)];
  assert.ok(matches.length > 0, "no list of request types found in firestore.rules");
  const expected = LAUNCHED_CATEGORIES.map((c) => c.id as string).sort();
  for (const m of matches) {
    const ids = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]).sort();
    assert.deepEqual(ids, expected);
  }
});
