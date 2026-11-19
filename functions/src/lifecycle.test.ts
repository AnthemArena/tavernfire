import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { decide, buildResults, type Snapshot } from "./lifecycle.ts";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-12-10T12:00:00Z");
const ago = (days: number) => new Date(now.getTime() - days * DAY);

function snap(over: Partial<Snapshot> = {}): Snapshot {
  return {
    createdAt: ago(1),
    status: "open",
    revealedAt: null,
    ballotsDeleted: false,
    entryCount: 3,
    ...over,
  };
}

describe("decide", () => {
  test("nothing happens while answers are open", () => {
    assert.equal(decide(snap({ createdAt: ago(2.9) }), now), "none");
  });

  test("after 3 days a request with several entries moves to voting once", () => {
    assert.equal(decide(snap({ createdAt: ago(3.1) }), now), "mark-voting");
    assert.equal(decide(snap({ createdAt: ago(3.1), status: "voting" }), now), "none");
    assert.equal(decide(snap({ createdAt: ago(4.9), status: "voting" }), now), "none");
  });

  test("after 5 days the picks are counted", () => {
    assert.equal(decide(snap({ createdAt: ago(5.1), status: "voting" }), now), "tally");
    // Even if the function missed the voting step, it still tallies.
    assert.equal(decide(snap({ createdAt: ago(6), status: "open" }), now), "tally");
  });

  test("no entries closes the request at day 3", () => {
    assert.equal(decide(snap({ createdAt: ago(3.1), entryCount: 0 }), now), "close-empty");
  });

  test("a single entry is revealed at day 3, since there is nothing to vote on", () => {
    assert.equal(decide(snap({ createdAt: ago(3.1), entryCount: 1 }), now), "reveal-single");
  });

  test("ballots are cleared 7 days after the reveal, once", () => {
    const base = { status: "revealed", createdAt: ago(20) };
    assert.equal(decide(snap({ ...base, revealedAt: ago(6.9) }), now), "none");
    assert.equal(decide(snap({ ...base, revealedAt: ago(7.1) }), now), "delete-ballots");
    assert.equal(decide(snap({ ...base, revealedAt: ago(8), ballotsDeleted: true }), now), "none");
    assert.equal(decide(snap({ status: "closed", revealedAt: ago(8) }), now), "delete-ballots");
  });

  test("a finished request is never revealed again", () => {
    assert.equal(decide(snap({ status: "revealed", createdAt: ago(9), revealedAt: ago(1) }), now), "none");
  });
});

describe("buildResults", () => {
  test("counts people who picked something, ignoring empty and invalid ballots", () => {
    const r = buildResults("r1", ["a", "b", "c"], [["a"], [], ["zzz"], ["b", "a"]]);
    assert.equal(r.ballotCount, 2);
    assert.equal(r.ranked.length, 3);
  });

  test("ranks entries by picks once enough people have voted", () => {
    const r = buildResults("r1", ["a", "b", "c"], [["a"], ["a", "b"], ["a", "c"]]);
    assert.equal(r.ranked[0].entryId, "a");
    assert.equal(r.ranked[0].rank, 1);
    assert.equal(r.ranked[0].favourite, true);
  });

  test("a single entry reveals with no ranks", () => {
    const r = buildResults("r1", ["a"], []);
    assert.equal(r.ranked[0].rank, null);
    assert.equal(r.ballotCount, 0);
  });
});

describe("kept in step with the app", () => {
  test("the windows match src/lib/requests.ts", () => {
    const app = readFileSync("src/lib/requests.ts", "utf8");
    const fn = readFileSync("functions/src/lifecycle.ts", "utf8");
    for (const name of ["ANSWER_WINDOW_DAYS", "VOTING_WINDOW_DAYS"]) {
      const a = app.match(new RegExp(`${name} = (\\d+)`))?.[1];
      const f = fn.match(new RegExp(`${name} = (\\d+)`))?.[1];
      assert.ok(a && f, `${name} found in both`);
      assert.equal(f, a, `${name} differs between src/lib/requests.ts and functions/src/lifecycle.ts`);
    }
  });

  test("the ranking copy in functions is identical to src/lib/ranking.ts", () => {
    const a = readFileSync("src/lib/ranking.ts", "utf8");
    const b = readFileSync("functions/src/ranking.ts", "utf8");
    assert.equal(b, a, "run `npm run sync:functions` to copy src/lib/ranking.ts into functions/src");
  });
});
