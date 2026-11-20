import { test } from "node:test";
import assert from "node:assert/strict";
import { describePhase, describeTimeLeft, describeUntil, displayPhase, isClosingSoon, toRequestItem } from "./requests.ts";

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

test("never shows more than the full window when createdAt is ahead of the clock", () => {
  const now = new Date("2026-11-18T10:00:00Z");
  const ahead = new Date(now.getTime() + 5_000); // created 5 seconds "in the future"
  assert.equal(describeTimeLeft(ahead, now), "3 days left");
});

import { requestPhase, votingClosesAt, answersCloseAt } from "./requests.ts";

test("a request moves from answering to voting to ended", () => {
  const made = new Date("2026-11-01T12:00:00Z");
  const at = (days: number) => new Date(made.getTime() + days * 24 * 60 * 60 * 1000);
  assert.equal(requestPhase(made, at(0)), "answering");
  assert.equal(requestPhase(made, at(2.9)), "answering");
  assert.equal(requestPhase(made, at(3)), "voting");
  assert.equal(requestPhase(made, at(4.9)), "voting");
  assert.equal(requestPhase(made, at(5)), "ended");
  assert.equal(votingClosesAt(made).getTime() - answersCloseAt(made).getTime(), 2 * 24 * 60 * 60 * 1000);
});

const ago = (ms: number) => new Date(now.getTime() - ms);

test("displayPhase follows the clock until the function writes a final status", () => {
  assert.equal(displayPhase({ status: "open", createdAt: ago(1 * DAY) }, now), "answering");
  assert.equal(displayPhase({ status: "open", createdAt: ago(3.5 * DAY) }, now), "voting");
  assert.equal(displayPhase({ status: "voting", createdAt: ago(4 * DAY) }, now), "voting");
  assert.equal(displayPhase({ status: "open", createdAt: ago(5.5 * DAY) }, now), "counting");
  assert.equal(displayPhase({ status: "revealed", createdAt: ago(3.2 * DAY) }, now), "revealed");
  assert.equal(displayPhase({ status: "closed", createdAt: ago(9 * DAY) }, now), "closed");
});

test("describeUntil and describePhase give short labels", () => {
  assert.equal(describeUntil(new Date(now.getTime() + 1.5 * DAY), now), "2 days");
  assert.equal(describeUntil(new Date(now.getTime() + 20 * HOUR), now), "20 hours");
  assert.equal(describeUntil(new Date(now.getTime() + 20 * 60 * 1000), now), "under an hour");
  assert.equal(describePhase({ status: "open", createdAt: ago(1.5 * DAY) }, now), "Open for answers · 2 days left");
  assert.equal(describePhase({ status: "open", createdAt: ago(3.5 * DAY) }, now), "Voting · ends in 2 days");
  assert.equal(describePhase({ status: "open", createdAt: ago(6 * DAY) }, now), "Counting votes");
  assert.equal(describePhase({ status: "revealed", createdAt: ago(6 * DAY) }, now), "Results are in");
});

test("toRequestItem reads status and ballot count, defaulting safely", () => {
  const base = {
    sparks: ["a", "b", "c"],
    kind: "npc",
    createdAt: { toDate: () => now },
  };
  assert.equal(toRequestItem("r", base)?.status, "open");
  assert.equal(toRequestItem("r", base)?.ballotCount, null);
  const done = toRequestItem("r", { ...base, status: "revealed", ballotCount: 7 });
  assert.equal(done?.status, "revealed");
  assert.equal(done?.ballotCount, 7);
  assert.equal(toRequestItem("r", { ...base, status: "weird" })?.status, "open");
});

import { describeAge } from "./requests.ts";

test("describeAge says how long ago something was posted", () => {
  const now = new Date("2026-11-20T12:00:00Z");
  const ago = (ms: number) => new Date(now.getTime() - ms);
  const H = 3600_000;
  assert.equal(describeAge(ago(10 * 60_000), now), "just now");
  assert.equal(describeAge(ago(1 * H), now), "1 hour ago");
  assert.equal(describeAge(ago(5 * H), now), "5 hours ago");
  assert.equal(describeAge(ago(24 * H), now), "1 day ago");
  assert.equal(describeAge(ago(72 * H), now), "3 days ago");
  assert.equal(describeAge(ago(90 * 24 * H), now), "3 months ago");
  // A clock a little behind the server's never gives a negative age.
  assert.equal(describeAge(new Date(now.getTime() + H), now), "just now");
});
