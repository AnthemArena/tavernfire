import { test } from "node:test";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { VOTING_WINDOW_DAYS } from "./requests.ts";
import {
  ENTRY_EDIT_WINDOW_HOURS,
  answerMarkerPath,
  describeEditTimeLeft,
  editableUntil,
  buildEntryFields,
  orderForViewer,
  toEntryItem,
  rankLabel,
  orderRevealed,
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
    upvoteCount: 0,
    author: null,
    reveal: null,
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

test("the edit window is 24 hours from posting", () => {
  const posted = new Date("2026-11-18T10:00:00Z");
  assert.equal(editableUntil({ createdAt: posted })?.toISOString(), "2026-11-19T10:00:00.000Z");
  assert.equal(editableUntil({ createdAt: null }), null);
});

test("toEntryItem reads the author when an entry carries one", () => {
  const item = toEntryItem("a", {
    name: "n", concept: "c", requestId: "r", authorId: "u1", authorName: "Marrow Fen",
  });
  assert.deepEqual(item?.author, { id: "u1", name: "Marrow Fen", avatar: null });
  assert.equal(toEntryItem("a", { name: "n", concept: "c", requestId: "r", authorId: "u1" })?.author, null);
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

// Fires are open, so answers have no deadline in the rules. Only the ballot rule
// (kept for duels) still has a day window.
test("the voting window in firestore.rules matches requests.ts, and answers have no deadline", () => {
  const days = [...rules.matchAll(/createdAt \+ duration\.value\((\d+), 'd'\)/g)].map((m) => Number(m[1]));
  assert.deepEqual([...new Set(days)], [VOTING_WINDOW_DAYS]);
});

test("rankLabel gives ordinals and marks shared ranks", () => {
  assert.equal(rankLabel(1, false), "1st");
  assert.equal(rankLabel(2, true), "Joint 2nd");
  assert.equal(rankLabel(3, false), "3rd");
  assert.equal(rankLabel(4, false), "4th");
  assert.equal(rankLabel(11, false), "11th");
  assert.equal(rankLabel(12, false), "12th");
  assert.equal(rankLabel(21, false), "21st");
  assert.equal(rankLabel(102, false), "102nd");
});

test("author and results appear only once the reveal fields are present", () => {
  const base = { name: "n", concept: "c", requestId: "r" };
  assert.equal(toEntryItem("a", base)?.reveal, null);
  // An author id alone (without revealedAt and a result) shows nothing.
  assert.equal(toEntryItem("a", { ...base, authorId: "u1", authorName: "Ann" })?.reveal, null);
  const revealed = toEntryItem("a", {
    ...base,
    authorId: "u1",
    authorName: "Ann",
    revealedAt: new Date(),
    result: { picks: 3, rank: 1, favourite: true, order: 0 },
  });
  assert.deepEqual(revealed?.reveal, { authorName: "Ann", picks: 3, rank: 1, favourite: true, tied: false, order: 0 });
  const noName = toEntryItem("a", { ...base, revealedAt: new Date(), authorName: null, result: { picks: 0, rank: null, favourite: false, order: 2 } });
  assert.equal(noName?.reveal?.authorName, null);
  assert.equal(noName?.reveal?.rank, null);
});

test("orderRevealed follows the stored order, with unrevealed entries last", () => {
  const mk = (id: string, order: number | null) => ({
    id,
    reveal: order === null ? null : { authorName: null, picks: 0, rank: null, favourite: false, tied: false, order },
  });
  assert.deepEqual(orderRevealed([mk("c", 2), mk("x", null), mk("a", 0), mk("b", 1)]).map((e) => e.id), ["a", "b", "c", "x"]);
});
