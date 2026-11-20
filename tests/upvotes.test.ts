// Runs the upvote recount against the Firestore emulator.
// Run with: npm run test:rules (the emulator is started for you; needs Java).

import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { initializeApp, deleteApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { recountUpvotes } from "../functions/src/upvotes.ts";

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
