import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AVATAR_CHANGE_HOURS, AVATARS, isAvatarId, nextAvatarChange } from "./avatars.ts";

test("only listed avatar ids are accepted", () => {
  assert.equal(isAvatarId("lantern"), true);
  assert.equal(isAvatarId("dragon"), false);
  assert.equal(isAvatarId(undefined), false);
  assert.equal(isAvatarId("https://example.com/x.png"), false);
});

test("the ids in the code and in the security rules are the same", () => {
  const rules = readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8");
  const match = rules.match(/function validAvatar\(a\) \{[^}]*?\[([^\]]+)\]/);
  assert.ok(match, "validAvatar not found in firestore.rules");
  const inRules = match[1].split(",").map((s) => s.trim().replace(/'/g, "")).sort();
  assert.deepEqual(inRules, AVATARS.map((a) => a.id).sort());
});

test("the avatar wait in the security rules matches AVATAR_CHANGE_HOURS", () => {
  const rules = readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8");
  const m = rules.match(/avatarChangedAt \+ duration\.value\((\d+), 'm'\)/);
  assert.ok(m, "avatar wait not found in firestore.rules");
  assert.equal(Number(m[1]), AVATAR_CHANGE_HOURS * 60);
});

test("an avatar can be changed again an hour later", () => {
  const changed = new Date("2026-11-20T10:00:00Z");
  assert.equal(nextAvatarChange(null, changed), null);
  assert.equal(nextAvatarChange(changed, new Date("2026-11-20T10:30:00Z"))?.toISOString(), "2026-11-20T11:00:00.000Z");
  assert.equal(nextAvatarChange(changed, new Date("2026-11-20T11:00:01Z")), null);
});
