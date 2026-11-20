import { test } from "node:test";
import assert from "node:assert/strict";
import { shownStokes, stokeId } from "./stokes.ts";
import { toRequestItem } from "./requests.ts";

test("the stoke id is the fire and the person", () => {
  assert.equal(stokeId("r1", "u9"), "r1_u9");
});

test("your own stoke shows at once, then the server's total takes over", () => {
  assert.equal(shownStokes(3, { delta: 1, base: 3 }), 4);
  assert.equal(shownStokes(4, { delta: 1, base: 3 }), 4);
});

test("a request carries its stoke count, defaulting to zero", () => {
  const base = {
    sparks: ["a", "b", "c"],
    kind: "npc",
    createdAt: { toDate: () => new Date("2026-11-20T10:00:00Z") },
  };
  assert.equal(toRequestItem("r", base)?.stokeCount, 0);
  assert.equal(toRequestItem("r", { ...base, stokeCount: 6 })?.stokeCount, 6);
  assert.equal(toRequestItem("r", { ...base, stokeCount: -2 })?.stokeCount, 0);
});
