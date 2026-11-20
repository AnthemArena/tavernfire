import { test } from "node:test";
import assert from "node:assert/strict";
import { isModerationAction } from "./moderation.ts";

test("only the three known actions are accepted", () => {
  assert.equal(isModerationAction("hide"), true);
  assert.equal(isModerationAction("dismiss"), true);
  assert.equal(isModerationAction("restore"), true);
  assert.equal(isModerationAction("delete"), false);
  assert.equal(isModerationAction(undefined), false);
  assert.equal(isModerationAction(3), false);
});
