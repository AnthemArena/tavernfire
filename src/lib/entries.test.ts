import { test } from "node:test";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { ANSWER_WINDOW_DAYS } from "./requests.ts";
import {
  ENTRY_EDIT_WINDOW_HOURS,
  answerMarkerPath,
  describeEditTimeLeft,
  editableUntil,
  buildEntryFields,
  orderForViewer,
  toEntryItem,
} from "./entries.ts";

const base = {
  name: "Vhane, the Last Hour",
  concept: "A statue-keeper who stopped time in her temple.",
  traits: ["Patient", " grieving "],
};

test("builds clean entry fields with normalised traits", () => {
  const f = buildEntryFields(base);
  assert.deepEqual(f.traits, ["Patient", "grieving"]);
  assert.deepEqual(f.traitsNorm, ["patient", "grieving"]);
});

test("drops blank and repeated traits", () => {
  const f = buildEntryFields({ ...base, traits: ["Cold", "cold!", "  ", "Wary"] });
  assert.deepEqual(f.traitsNorm, ["cold", "wary"]);
});

test("requires a name and a description", () => {
  assert.throws(() => buildEntryFields({ ...base, name: " " }), /name/);
  assert.throws(() => buildEntryFields({ ...base, concept: "" }), /Describe/);
});

test("enforces length and trait limits", () => {
  assert.throws(() => buildEntryFields({ ...base, name: "x".repeat(61) }), /60/);
  assert.throws(
    () => buildEntryFields({ ...base, traits: ["a", "b", "c", "d", "e", "f"] }),
    /up to 5/,
  );
  assert.throws(
    () => buildEntryFields({ ...base, traits: ["x".repeat(25)] }),
    /24/,
  );
});

test("toEntryItem rejects malformed data and tolerates missing optional fields", () => {
  assert.equal(toEntryItem("a", { name: "x" }), null);
  const item = toEntryItem("a", { name: "n", concept: "c", requestId: "r" });
  assert.deepEqual(item, {
    id: "a",
    requestId: "r",
    kind: "npc",
    createdAt: null,
    edited: false,
    name: "n",
    concept: "c",
    traits: [],
  });
});

test("the answer marker sits under the request, keyed by the person", () => {
  assert.deepEqual(answerMarkerPath("req1", "uid9"), ["requests", "req1", "answerLocks", "uid9"]);
});

test("viewer order is random but stable across updates", () => {
  const keys = new Map<string, number>();
  const seq = [0.9, 0.1, 0.5];
  let i = 0;
  const random = () => seq[i++ % seq.length];
  const items = [{ id: "a" }, { id: "b" }, { id: "c" }];

  const first = orderForViewer(items, keys, random).map((x) => x.id);
  assert.deepEqual(first, ["b", "c", "a"]);

  // A new entry arrives; the existing cards keep their places.
  const more = [...items, { id: "d" }];
  const second = orderForViewer(more, keys, () => 0.3).map((x) => x.id);
  assert.deepEqual(second, ["b", "d", "c", "a"]);
});

test("your own entry is pinned first", () => {
  const keys = new Map<string, number>([
    ["a", 0.1],
    ["b", 0.2],
  ]);
  const out = orderForViewer([{ id: "a" }, { id: "b" }], keys, Math.random, "b");
  assert.deepEqual(out.map((x) => x.id), ["b", "a"]);
});

test("the edit window is 24 hours from posting, capped by when answers close", () => {
  const posted = new Date("2026-11-18T10:00:00Z");
  const farClose = new Date("2026-11-21T10:00:00Z");
  assert.equal(editableUntil({ createdAt: posted }, farClose)?.toISOString(), "2026-11-19T10:00:00.000Z");
  const soonClose = new Date("2026-11-18T12:00:00Z");
  assert.equal(editableUntil({ createdAt: posted }, soonClose)?.toISOString(), "2026-11-18T12:00:00.000Z");
  assert.equal(editableUntil({ createdAt: null }, farClose), null);
});

test("edit time left reads naturally", () => {
  const now = new Date("2026-11-18T10:00:00Z");
  assert.equal(describeEditTimeLeft(new Date("2026-11-19T09:30:00Z"), now), "23 hours left");
  assert.equal(describeEditTimeLeft(new Date("2026-11-18T11:30:00Z"), now), "1 hour left");
  assert.equal(describeEditTimeLeft(new Date("2026-11-18T10:47:00Z"), now), "47 min left");
  assert.equal(describeEditTimeLeft(new Date("2026-11-18T10:00:00Z"), now), null);
});

// The same numbers appear in firestore.rules, where they cannot import from here.
// A mismatch would fail silently, so these tests keep them in step.
const rules = readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8");

test("the entry edit window in firestore.rules matches ENTRY_EDIT_WINDOW_HOURS", () => {
  const hours = [...rules.matchAll(/duration\.value\((\d+), 'h'\)/g)].map((m) => Number(m[1]));
  assert.ok(hours.length > 0, "no hour window found in firestore.rules");
  for (const h of hours) assert.equal(h, ENTRY_EDIT_WINDOW_HOURS);
});

test("the answer window in firestore.rules matches ANSWER_WINDOW_DAYS", () => {
  const days = [...rules.matchAll(/createdAt \+ duration\.value\((\d+), 'd'\)/g)].map((m) => Number(m[1]));
  assert.ok(days.length > 0, "no day window found in firestore.rules");
  for (const d of days) assert.equal(d, ANSWER_WINDOW_DAYS);
});
