import { test } from "node:test";
import assert from "node:assert/strict";
import { avatarOf, chunk, syncAvatar } from "./avatars.ts";

test("the avatar is read from a profile, or null", () => {
  assert.equal(avatarOf({ avatar: "demon-3" }), "demon-3");
  assert.equal(avatarOf({ avatar: 5 }), null);
  assert.equal(avatarOf({}), null);
  assert.equal(avatarOf(undefined), null);
});

test("long lists are split into batches", () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(chunk([], 2), []);
  assert.equal(chunk(new Array(1001).fill(0)).length, 3);
});

// A tiny stand-in for Firestore: collections of plain documents.
function fakeDb(data: Record<string, Record<string, Record<string, unknown>>>) {
  const writes: Array<{ path: string; patch: Record<string, unknown> }> = [];
  const db = {
    collection: (name: string) => ({
      where: (field: string, _op: string, value: unknown) => ({
        get: async () => ({
          docs: Object.entries(data[name] ?? {})
            .filter(([, doc]) => doc[field] === value)
            .map(([id, doc]) => ({
              ref: { path: `${name}/${id}` },
              get: (f: string) => doc[f],
            })),
        }),
      }),
    }),
    batch: () => {
      const pending: Array<{ path: string; patch: Record<string, unknown> }> = [];
      return {
        update: (ref: { path: string }, patch: Record<string, unknown>) => pending.push({ path: ref.path, patch }),
        commit: async () => void writes.push(...pending),
      };
    },
  };
  return { db: db as never, writes };
}

test("a new avatar is copied to the member's fires and answers, and nobody else's", async () => {
  const { db, writes } = fakeDb({
    requests: {
      f1: { requesterId: "me", requesterAvatar: "demon-1" },
      f2: { requesterId: "me" },
      f3: { requesterId: "other" },
    },
    entries: {
      a1: { authorId: "me", authorAvatar: "undead-7" },
      a2: { authorId: "other" },
    },
  });
  const changed = await syncAvatar(db, "me", "undead-7");
  assert.equal(changed, 2); // f1 and f2; a1 already shows moon
  assert.deepEqual(
    writes.map((w) => w.path).sort(),
    ["requests/f1", "requests/f2"],
  );
  assert.deepEqual(writes[0].patch, { requesterAvatar: "undead-7" });
});

test("running it again changes nothing", async () => {
  const { db, writes } = fakeDb({
    requests: { f1: { requesterId: "me", requesterAvatar: "undead-7" } },
    entries: { a1: { authorId: "me", authorAvatar: "undead-7" } },
  });
  assert.equal(await syncAvatar(db, "me", "undead-7"), 0);
  assert.equal(writes.length, 0);
});
