import { test } from "node:test";
import assert from "node:assert/strict";
import { ACHIEVEMENTS, achievementById, earnedAchievements } from "./achievements.ts";

const none = { fires: 0, answers: 0, upvotes: 0, stokes: 0 };

test("a new member has earned nothing", () => {
  assert.deepEqual(earnedAchievements(none), []);
});

test("each achievement unlocks on its own condition", () => {
  assert.deepEqual(earnedAchievements({ ...none, fires: 1 }), ["first_fire"]);
  assert.deepEqual(earnedAchievements({ ...none, answers: 1 }), ["first_answer"]);
  assert.deepEqual(earnedAchievements({ ...none, stokes: 1 }), ["first_stoke"]);
  assert.deepEqual(earnedAchievements({ ...none, upvotes: 1 }), ["first_upvote"]);
  assert.deepEqual(earnedAchievements({ ...none, upvotes: 9 }), ["first_upvote"]);
  assert.deepEqual(earnedAchievements({ ...none, upvotes: 10 }), ["first_upvote", "ten_upvotes"]);
});

test("ids are unique and each has a name and description", () => {
  assert.equal(new Set(ACHIEVEMENTS.map((a) => a.id)).size, ACHIEVEMENTS.length);
  for (const a of ACHIEVEMENTS) assert.ok(a.name && a.description);
  assert.equal(achievementById("first_fire")?.name, "First fire");
  assert.equal(achievementById("nope"), undefined);
});
