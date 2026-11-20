import { test } from "node:test";
import assert from "node:assert/strict";
import { countFor, recomputeXp, xpMayChange } from "./xpCount.ts";

type Row = Record<string, unknown>;
function fakeDb(data: Record<string, Record<string, Row>>) {
  const updates: Array<{ path: string; patch: Row }> = [];
  const created: Row[] = [];
  const db = {
    collection: (col: string) => ({
      where: (f1: string, _o: string, v1: unknown) => ({
        where: (f2: string, _o2: string, v2: unknown) => ({
          get: async () => {
            const docs = Object.values(data[col] ?? {}).filter((d) => d[f1] === v1 && d[f2] === v2);
            return { size: docs.length, docs: docs.map((d) => ({ get: (f: string) => d[f] })) };
          },
        }),
      }),
      doc: (id: string) => ({
        get: async () => ({ exists: data[col]?.[id] !== undefined, get: (f: string) => data[col]?.[id]?.[f] }),
        update: async (patch: Row) => void updates.push({ path: `${col}/${id}`, patch }),
        create: async (value: Row) => {
          if (col === "notifications") {
            if (created.some((c) => c.__id === id)) throw Object.assign(new Error("ALREADY_EXISTS"), { code: 6 });
            created.push({ __id: id, ...value });
          }
        },
      }),
    }),
  };
  return { db: db as never, updates, created };
}

const world = () =>
  fakeDb({
    users: { me: { displayName: "Me" }, ghost: {} },
    requests: {
      f1: { requesterId: "me", moderation: "ok", stokeCount: 3 },
      f2: { requesterId: "me", moderation: "hidden", stokeCount: 9 }, // hidden: ignored
      f3: { requesterId: "other", moderation: "ok", stokeCount: 4 },
    },
    entries: {
      a1: { authorId: "me", moderation: "ok", upvoteCount: 2 },
      a2: { authorId: "me", moderation: "ok" }, // no count yet
      a3: { authorId: "other", moderation: "ok", upvoteCount: 7 },
    },
  });

test("counts a member's visible posts and what they received", async () => {
  const { db } = world();
  assert.deepEqual(await countFor(db, "me"), { fires: 1, answers: 2, stokes: 3, upvotes: 2 });
});

test("saves XP, level and achievements: 1 fire, 2 answers, 3 stokes, 2 upvotes = 5+10+30+20", async () => {
  const { db, updates } = world();
  const r = await recomputeXp(db, "me");
  assert.deepEqual(r, {
    xp: 65,
    level: 2,
    previousLevel: 1,
    newAchievements: ["first_fire", "first_answer", "first_stoke", "first_upvote"],
  });
  assert.deepEqual(updates, [
    {
      path: "users/me",
      patch: { xp: 65, level: 2, achievements: ["first_fire", "first_answer", "first_stoke", "first_upvote"] },
    },
  ]);
});

test("a new rank and each new achievement are announced, once", async () => {
  const { db, created } = world();
  await recomputeXp(db, "me");
  assert.deepEqual(
    created.map((c) => c.__id).sort(),
    ["achievement_me_first_answer", "achievement_me_first_fire", "achievement_me_first_stoke", "achievement_me_first_upvote", "levelup_me_2"],
  );
  assert.equal(created.find((c) => c.__id === "levelup_me_2")?.level, 2);
  // Repeating the run (the profile in this fake did not change) makes no duplicates.
  await recomputeXp(db, "me");
  assert.equal(created.length, 5);
});

test("achievements already earned are kept and not announced again", async () => {
  const { db, updates, created } = fakeDb({
    users: { me: { xp: 0, level: 1, achievements: ["first_fire", "old_one"] } },
    requests: { f1: { requesterId: "me", moderation: "ok" } },
    entries: {},
  });
  const r = await recomputeXp(db, "me");
  assert.deepEqual(r?.newAchievements, []);
  assert.equal(created.length, 0);
  assert.deepEqual(updates, [{ path: "users/me", patch: { xp: 5 } }]);
});

test("going up several ranks at once announces each", async () => {
  const entries: Record<string, Row> = {};
  for (let i = 0; i < 30; i++) entries[`a${i}`] = { authorId: "me", moderation: "ok", upvoteCount: 5 }; // 30*(5+50)=1650 XP
  const { db, created } = fakeDb({ users: { me: { xp: 0, level: 1 } }, requests: {}, entries });
  const r = await recomputeXp(db, "me");
  assert.equal(r?.level, 5);
  assert.deepEqual(created.filter((c) => String(c.__id).startsWith("levelup")).map((c) => c.level), [2, 3, 4, 5]);
});

test("nothing is written when XP and level are unchanged", async () => {
  const { db, updates } = fakeDb({ users: { me: { xp: 0, level: 1 } } });
  assert.deepEqual(await recomputeXp(db, "me"), { xp: 0, level: 1, previousLevel: 1, newAchievements: [] });
  assert.equal(updates.length, 0);
});

test("no profile, no XP", async () => {
  const { db } = world();
  assert.equal(await recomputeXp(db, "nobody"), null);
});

test("only changes that can move XP are picked up", () => {
  const base = { requesterId: "me", moderation: "ok", stokeCount: 1, answerCount: 0 };
  assert.equal(xpMayChange(undefined, base, "requesterId", "stokeCount"), true); // created
  assert.equal(xpMayChange(base, undefined, "requesterId", "stokeCount"), true); // deleted
  assert.equal(xpMayChange(base, { ...base, stokeCount: 2 }, "requesterId", "stokeCount"), true);
  assert.equal(xpMayChange(base, { ...base, moderation: "hidden" }, "requesterId", "stokeCount"), true);
  assert.equal(xpMayChange(base, { ...base, answerCount: 5 }, "requesterId", "stokeCount"), false);
});
