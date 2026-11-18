import { test } from "node:test";
import assert from "node:assert/strict";
import { describeTimeLeft, isClosingSoon, toRequestItem } from "./requests.ts";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const now = new Date("2026-11-17T12:00:00Z");

test("describeTimeLeft counts down across the 3 day window", () => {
  assert.equal(describeTimeLeft(new Date(now.getTime() - 1 * HOUR), now), "3 days left");
  assert.equal(describeTimeLeft(new Date(now.getTime() - 1.5 * DAY), now), "2 days left");
  assert.equal(describeTimeLeft(new Date(now.getTime() - 2 * DAY), now), "1 day left");
  assert.equal(describeTimeLeft(new Date(now.getTime() - 2.5 * DAY), now), "12 hours left");
  assert.equal(describeTimeLeft(new Date(now.getTime() - (3 * DAY - 5 * HOUR)), now), "5 hours left");
  assert.equal(describeTimeLeft(new Date(now.getTime() - (3 * DAY - 10 * 60 * 1000)), now), "Closing soon");
  assert.equal(describeTimeLeft(new Date(now.getTime() - 3 * DAY), now), "Answers closed");
});

test("isClosingSoon is true only in the last 24 hours before closing", () => {
  assert.equal(isClosingSoon(new Date(now.getTime() - 1 * DAY), now), false);
  assert.equal(isClosingSoon(new Date(now.getTime() - 2.5 * DAY), now), true);
  assert.equal(isClosingSoon(new Date(now.getTime() - (3 * DAY - 1 * HOUR)), now), true);
  assert.equal(isClosingSoon(new Date(now.getTime() - 3 * DAY), now), false);
  assert.equal(isClosingSoon(new Date(now.getTime() - 4 * DAY), now), false);
});

test("toRequestItem maps good data and rejects bad data", () => {
  const good = {
    sparks: ["Statue", "Time", "Glowing"],
    sparksNorm: ["glowing", "statue", "time"],
    sparkKey: "glowing|statue|time",
    kind: "npc",
    note: "A guardian",
    requesterId: "u1",
    requesterName: "Marrow",
    answerCount: 2,
    createdAt: { toDate: () => now },
  };
  const item = toRequestItem("r1", good);
  assert.equal(item?.id, "r1");
  assert.equal(item?.requesterName, "Marrow");
  assert.equal(item?.createdAt.getTime(), now.getTime());

  assert.equal(toRequestItem("r2", { ...good, kind: "dragon" }), null);
  assert.equal(toRequestItem("r3", { ...good, sparks: ["only", "two"] }), null);
  assert.equal(toRequestItem("r4", { ...good, createdAt: null }), null);
});
