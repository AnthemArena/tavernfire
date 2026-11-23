import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { RANKS, XP_FOR, rankFor, rankProgress, xpFor } from "./xp.ts";

test("XP: posting earns a little, being upvoted or stoked earns the most", () => {
  assert.equal(xpFor({ fires: 0, answers: 0, upvotes: 0, stokes: 0 }), 0);
  assert.equal(xpFor({ fires: 1, answers: 1, upvotes: 0, stokes: 0 }), XP_FOR.fire + XP_FOR.answer);
  assert.equal(xpFor({ fires: 2, answers: 3, upvotes: 4, stokes: 5 }), 10 + 15 + 40 + 50);
  assert.ok(XP_FOR.upvote > XP_FOR.answer && XP_FOR.stoke > XP_FOR.fire);
});

test("ranks run in order from Cinderling to Phoenix Ascendant", () => {
  assert.deepEqual(RANKS.map((r) => r.name), ["Cinderling", "Flamebearer", "Pyromancer", "Blazewalker", "Phoenix Ascendant"]);
  RANKS.forEach((r, i) => {
    assert.equal(r.level, i + 1);
    if (i > 0) assert.ok(r.minXp > RANKS[i - 1].minXp);
  });
});

test("the rank follows XP, with a new rank starting exactly at its threshold", () => {
  assert.equal(rankFor(0).name, "Cinderling");
  assert.equal(rankFor(49).name, "Cinderling");
  assert.equal(rankFor(50).name, "Flamebearer");
  assert.equal(rankFor(999).name, "Blazewalker");
  assert.equal(rankFor(1000).name, "Phoenix Ascendant");
  assert.equal(rankFor(1e9).name, "Phoenix Ascendant");
});

test("progress to the next rank", () => {
  const p = rankProgress(100); // Flamebearer (50) to Pyromancer (150)
  assert.equal(p.rank.name, "Flamebearer");
  assert.equal(p.next?.name, "Pyromancer");
  assert.equal(p.fraction, 0.5);
  assert.equal(p.toNext, 50);
  const top = rankProgress(5000);
  assert.equal(top.next, null);
  assert.equal(top.fraction, 1);
});

test("the copy in functions is identical to src/lib/xp.ts", () => {
  const a = readFileSync(new URL("./xp.ts", import.meta.url), "utf8");
  const b = readFileSync(new URL("../../functions/src/xp.ts", import.meta.url), "utf8");
  assert.equal(b, a, "run `npm run sync:functions` to copy src/lib/xp.ts into functions/src");
});

test("the achievements copy in functions is identical too", () => {
  const a = readFileSync(new URL("./achievements.ts", import.meta.url), "utf8");
  const b = readFileSync(new URL("../../functions/src/achievements.ts", import.meta.url), "utf8");
  assert.equal(b, a, "run `npm run sync:functions` to copy src/lib/achievements.ts into functions/src");
});
