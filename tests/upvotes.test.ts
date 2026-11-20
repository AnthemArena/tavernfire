// Runs the upvote recount against the Firestore emulator.
// Run with: npm run test:rules (the emulator is started for you; needs Java).

import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { initializeApp, deleteApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { recountUpvotes } from "../functions/src/upvotes.ts";
import { recountSparks } from "../functions/src/sparks.ts";
import { addTrend, recountStokes } from "../functions/src/trending.ts";

let app: App;
let db: Firestore;

before(async () => {
  assert.ok(process.env.FIRESTORE_EMULATOR_HOST, "run this through npm run test:rules");
  app = initializeApp({ projectId: "demo-tavernfire-upvotes" }, "upvotes-test");
  db = getFirestore(app);
});

after(async () => {
  await deleteApp(app);
});

async function upvote(entryId: string, uid: string) {
  await db.collection("upvotes").doc(`${entryId}_${uid}`).set({ entryId, requestId: "r1", voterId: uid });
}

test("the total on an answer follows its upvotes, and recounting twice changes nothing", async () => {
  await db.collection("entries").doc("e1").set({ requestId: "r1", name: "A" });
  await db.collection("entries").doc("e2").set({ requestId: "r1", name: "B" });
  await upvote("e1", "ann");
  await upvote("e1", "bob");
  await upvote("e2", "ann");

  assert.equal(await recountUpvotes(db, "e1"), 2);
  assert.equal(await recountUpvotes(db, "e1"), 2);
  assert.equal((await db.collection("entries").doc("e1").get()).get("upvoteCount"), 2);
  assert.equal((await db.collection("entries").doc("e2").get()).get("upvoteCount") ?? 0, 0); // not counted yet

  await db.collection("upvotes").doc("e1_bob").delete();
  assert.equal(await recountUpvotes(db, "e1"), 1);
  await db.collection("upvotes").doc("e1_ann").delete();
  assert.equal(await recountUpvotes(db, "e1"), 0);
  assert.equal((await db.collection("entries").doc("e1").get()).get("upvoteCount"), 0);
});

test("an answer that no longer exists is skipped without an error", async () => {
  await upvote("gone", "ann");
  assert.equal(await recountUpvotes(db, "gone"), null);
});

test("the total on a fire follows its stokes", async () => {
  await db.collection("requests").doc("r1").set({ moderation: "ok" });
  await db.collection("stokes").doc("r1_ann").set({ requestId: "r1", voterId: "ann" });
  await db.collection("stokes").doc("r1_bob").set({ requestId: "r1", voterId: "bob" });
  assert.equal(await recountStokes(db, "r1"), 2);
  assert.equal(await recountStokes(db, "r1"), 2);
  assert.equal((await db.collection("requests").doc("r1").get()).get("stokeCount"), 2);
  await db.collection("stokes").doc("r1_bob").delete();
  assert.equal(await recountStokes(db, "r1"), 1);
  assert.equal(await recountStokes(db, "missing"), null);
});

test("activity warms a fire up: fresher and bigger activity ranks higher", async () => {
  const day = 24 * 60 * 60 * 1000;
  const t = Date.UTC(2026, 10, 20);
  await db.collection("requests").doc("old").set({ moderation: "ok" });
  await db.collection("requests").doc("new").set({ moderation: "ok" });
  await addTrend(db, "old", 2, t);
  await addTrend(db, "new", 2, t + 5 * day);
  const old = (await db.collection("requests").doc("old").get()).data();
  const fresh = (await db.collection("requests").doc("new").get()).data();
  assert.equal(old?.trendScore, 2);
  assert.ok(fresh?.trendRank > old?.trendRank);
  // A second bump adds to the faded score.
  await addTrend(db, "old", 2, t);
  assert.equal((await db.collection("requests").doc("old").get()).get("trendScore"), 4);
  await addTrend(db, "missing", 2, t); // no error for a fire that is gone
});

test("the list of sparks follows the fires that use them", async () => {
  const fire = (id: string, norms: string[]) =>
    db.collection("requests").doc(id).set({ sparksNorm: norms });
  await fire("s1", ["glowing", "statue", "time"]);
  await fire("s2", ["glowing", "river", "statue"]);

  assert.deepEqual(await recountSparks(db, ["statue", "glowing", "time", "river"]), {
    statue: 2,
    glowing: 2,
    time: 1,
    river: 1,
  });
  // Recounting twice changes nothing.
  await recountSparks(db, ["statue"]);
  assert.equal((await db.collection("sparks").doc("statue").get()).get("count"), 2);
  assert.equal((await db.collection("sparks").doc("statue").get()).get("word"), "statue");

  // A spark no fire uses any more leaves the list.
  await db.collection("requests").doc("s1").delete();
  await recountSparks(db, ["time", "statue"]);
  assert.equal((await db.collection("sparks").doc("time").get()).exists, false);
  assert.equal((await db.collection("sparks").doc("statue").get()).get("count"), 1);
});
