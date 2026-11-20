import { test } from "node:test";
import assert from "node:assert/strict";
import { createNotification, notifyAnswer, notifyStoke, notifyUpvote, sparksText } from "./notify.ts";

type Row = Record<string, unknown>;

/** A tiny stand-in for Firestore: documents by collection, with create() that refuses an existing id. */
export function fakeDb(data: Record<string, Record<string, Row>>) {
  const db = {
    collection: (col: string) => ({
      doc: (id: string) => ({
        get: async () => ({ exists: data[col]?.[id] !== undefined, get: (f: string) => data[col]?.[id]?.[f] }),
        create: async (value: Row) => {
          data[col] ??= {};
          if (data[col][id]) throw Object.assign(new Error("6 ALREADY_EXISTS"), { code: 6 });
          data[col][id] = value;
        },
      }),
    }),
  };
  return { db: db as never, data };
}

const world = () =>
  fakeDb({
    requests: { r1: { requesterId: "lighter", sparks: ["Statue", "Time", "Glowing"] } },
    entries: { e1: { authorId: "author", requestId: "r1", name: "Vhane" } },
  });

test("a stoke tells the lighter, anonymously, and only once", async () => {
  const { db, data } = world();
  assert.equal(await notifyStoke(db, "r1_bob", "r1", "bob"), true);
  const n = data.notifications["stoke_r1_bob"];
  assert.equal(n.recipientId, "lighter");
  assert.equal(n.type, "stoke");
  assert.equal(n.sparks, "Statue, Time, Glowing");
  assert.equal(n.read, false);
  assert.equal("actorName" in n, false);
  // Running again, or stoking again after taking it back, makes no second notification.
  assert.equal(await notifyStoke(db, "r1_bob", "r1", "bob"), false);
  assert.equal(Object.keys(data.notifications).length, 1);
});

test("nobody is told about their own stoke or upvote", async () => {
  const { db, data } = world();
  assert.equal(await notifyStoke(db, "r1_lighter", "r1", "lighter"), false);
  assert.equal(await notifyUpvote(db, "e1_author", "e1", "author"), false);
  assert.equal(data.notifications, undefined);
});

test("an upvote tells the answer's author, naming the answer", async () => {
  const { db, data } = world();
  assert.equal(await notifyUpvote(db, "e1_bob", "e1", "bob"), true);
  assert.deepEqual(
    { to: data.notifications["upvote_e1_bob"].recipientId, name: data.notifications["upvote_e1_bob"].entryName, fire: data.notifications["upvote_e1_bob"].requestId },
    { to: "author", name: "Vhane", fire: "r1" },
  );
});

test("an answer tells the lighter who answered", async () => {
  const { db, data } = world();
  assert.equal(await notifyAnswer(db, "e2", { requestId: "r1", authorId: "bob", authorName: "Marrow" }), true);
  assert.equal(data.notifications["answer_e2"].actorName, "Marrow");
  assert.equal(data.notifications["answer_e2"].recipientId, "lighter");
});

test("things that are gone or incomplete are skipped, not errors", async () => {
  const { db } = world();
  assert.equal(await notifyStoke(db, "x", "missing", "bob"), false);
  assert.equal(await notifyUpvote(db, "x", "missing", "bob"), false);
  assert.equal(await notifyAnswer(db, "x", {}), false);
});

test("other failures are not swallowed", async () => {
  const db = { collection: () => ({ doc: () => ({ create: async () => { throw new Error("boom"); } }) }) } as never;
  await assert.rejects(createNotification(db, "a", { recipientId: "u", type: "levelup", level: 2 }), /boom/);
});

test("sparks are written out as a list", () => {
  assert.equal(sparksText(["A", "B", "C"]), "A, B, C");
  assert.equal(sparksText(undefined), "");
});
