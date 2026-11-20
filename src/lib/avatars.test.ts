import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { AVATAR_CHANGE_HOURS, AVATARS, describeWhen, PACKS, avatarSrc, isAvatarId, nextAvatarChange } from "./avatars.ts";

const rules = readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8");

test("only listed avatar ids are accepted", () => {
  assert.equal(isAvatarId("demon-1"), true);
  assert.equal(isAvatarId("undead-50"), true);
  assert.equal(isAvatarId("demon-51"), false);
  assert.equal(isAvatarId("demon-0"), false);
  assert.equal(isAvatarId("dragon-1"), false);
  assert.equal(isAvatarId(undefined), false);
  assert.equal(isAvatarId("https://example.com/x.png"), false);
});

test("every avatar has a picture file", () => {
  for (const a of AVATARS) {
    assert.ok(existsSync(new URL(`../../public${avatarSrc(a.id)}`, import.meta.url)), `missing file for ${a.id}`);
  }
});

test("the avatar ids in the code and in the security rules are the same", () => {
  const m = rules.match(/function validAvatar\(a\) \{\s*return a is string && a\.matches\('([^']+)'\);/);
  assert.ok(m, "validAvatar not found in firestore.rules");
  const pattern = new RegExp(`^(?:${m[1]})$`); // Firestore matches the whole string
  for (const a of AVATARS) assert.ok(pattern.test(a.id), `${a.id} is not allowed by the rules`);
  // And the rules allow nothing the code lacks: probe each pack just past its end, and unknown packs.
  for (const p of PACKS) assert.equal(pattern.test(`${p.id}-${p.count + 1}`), false);
  assert.equal(pattern.test("dragon-1"), false);
  assert.equal(pattern.test("demon-01"), false);
  assert.equal(pattern.test("demon-1x"), false);
  // Every pack named in the rules exists in the code.
  const inRules = m[1].match(/\(([a-z|]+)\)/)?.[1].split("|") ?? [];
  assert.deepEqual(inRules.sort(), PACKS.map((p) => p.id).sort());
});

test("the avatar wait in the security rules matches AVATAR_CHANGE_HOURS", () => {
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

test("a later time today is given as a time, another day as a date", () => {
  const now = new Date("2026-11-20T10:00:00");
  assert.equal(describeWhen(new Date("2026-11-20T15:15:00"), now), "at 3:15 pm");
  assert.equal(describeWhen(new Date("2026-11-21T09:00:00"), now), "on 21 November");
});
