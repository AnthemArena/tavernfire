// Security rules tests. Run with: npm run test:rules
// (starts the Firestore emulator, runs these, then shuts it down; needs Java.)

import { after, before, beforeEach, describe, test } from "node:test";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  increment,
} from "firebase/firestore";
import { buildSparkFields } from "../src/lib/sparks.ts";
import { buildEntryFields, answerMarkerPath } from "../src/lib/entries.ts";

let env: RulesTestEnvironment;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-tavernfire",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
});

after(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

function newRequest(uid: string, overrides: Record<string, unknown> = {}) {
  return {
    ...buildSparkFields(["Statue", "Time", "Glowing"]),
    kind: "npc",
    note: "A guardian for a ruined temple",
    requesterId: uid,
    requesterName: "Marrow",
    status: "open",
    moderation: "ok",
    answerCount: 0,
    createdAt: serverTimestamp(),
    ...overrides,
  };
}

async function seedRequest(id: string, overrides: Record<string, unknown> = {}) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "requests", id), {
      ...newRequest("seed-user", overrides),
      createdAt: new Date(),
    });
  });
}

describe("requests: create", () => {
  test("a signed-in user can post a valid request", async () => {
    const db = env.authenticatedContext("alice").firestore();
    await assertSucceeds(addDoc(collection(db, "requests"), newRequest("alice")));
  });

  test("a signed-out visitor cannot post", async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertFails(addDoc(collection(db, "requests"), newRequest("alice")));
  });

  test("cannot post as someone else", async () => {
    const db = env.authenticatedContext("alice").firestore();
    await assertFails(addDoc(collection(db, "requests"), newRequest("bob")));
  });

  test("search keys must match the three sparks", async () => {
    const db = env.authenticatedContext("alice").firestore();
    await assertFails(
      addDoc(collection(db, "requests"), newRequest("alice", { sparkKey: "a|b|c" })),
    );
    await assertFails(
      addDoc(collection(db, "requests"), newRequest("alice", { pairKeys: ["x", "y", "z"] })),
    );
  });

  test("cannot set counters, status or moderation", async () => {
    const db = env.authenticatedContext("alice").firestore();
    await assertFails(addDoc(collection(db, "requests"), newRequest("alice", { answerCount: 5 })));
    await assertFails(addDoc(collection(db, "requests"), newRequest("alice", { status: "voting" })));
    await assertFails(addDoc(collection(db, "requests"), newRequest("alice", { moderation: "hidden" })));
  });

  test("createdAt must be the server time, not a client date", async () => {
    const db = env.authenticatedContext("alice").firestore();
    await assertFails(
      addDoc(collection(db, "requests"), newRequest("alice", { createdAt: new Date() })),
    );
  });

  test("rejects extra fields, a bad kind and an over-long note", async () => {
    const db = env.authenticatedContext("alice").firestore();
    await assertFails(addDoc(collection(db, "requests"), newRequest("alice", { extra: true })));
    await assertFails(addDoc(collection(db, "requests"), newRequest("alice", { kind: "dragon" })));
    await assertFails(
      addDoc(collection(db, "requests"), newRequest("alice", { note: "x".repeat(301) })),
    );
  });

  test("rejects repeated sparks", async () => {
    const db = env.authenticatedContext("alice").firestore();
    await assertFails(
      addDoc(
        collection(db, "requests"),
        newRequest("alice", {
          sparksNorm: ["time", "time", "glowing"],
          sparkKey: "time|time|glowing",
          pairKeys: ["time|time", "time|glowing", "time|glowing"],
        }),
      ),
    );
  });
});

describe("requests: read, update, delete", () => {
  test("anyone can read visible requests, including the board query", async () => {
    await seedRequest("r1");
    const db = env.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(db, "requests", "r1")));
    await assertSucceeds(
      getDocs(query(collection(db, "requests"), where("moderation", "==", "ok"))),
    );
  });

  test("an unfiltered list of requests is refused", async () => {
    await seedRequest("r1");
    const db = env.unauthenticatedContext().firestore();
    await assertFails(getDocs(collection(db, "requests")));
  });

  test("hidden requests are readable only by moderators", async () => {
    await seedRequest("hidden1", { moderation: "hidden" });
    const visitor = env.authenticatedContext("alice").firestore();
    const mod = env.authenticatedContext("mod", { role: "moderator" }).firestore();
    await assertFails(getDoc(doc(visitor, "requests", "hidden1")));
    await assertSucceeds(getDoc(doc(mod, "requests", "hidden1")));
  });

  test("nobody can edit or delete a request from the client", async () => {
    await seedRequest("r1");
    const owner = env.authenticatedContext("seed-user").firestore();
    await assertFails(updateDoc(doc(owner, "requests", "r1"), { note: "changed" }));
    await assertFails(deleteDoc(doc(owner, "requests", "r1")));
  });
});

describe("users", () => {
  test("a user can create their own profile", async () => {
    const db = env.authenticatedContext("alice").firestore();
    await assertSucceeds(
      setDoc(doc(db, "users", "alice"), {
        displayName: "Alice",
        avatarUrl: null,
        createdAt: serverTimestamp(),
      }),
    );
  });

  test("cannot create someone else's profile or use a client timestamp", async () => {
    const db = env.authenticatedContext("alice").firestore();
    await assertFails(
      setDoc(doc(db, "users", "bob"), { displayName: "Bob", createdAt: serverTimestamp() }),
    );
    await assertFails(
      setDoc(doc(db, "users", "alice"), { displayName: "Alice", createdAt: new Date() }),
    );
  });

  test("a user can rename themselves but not change createdAt", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "users", "alice"), {
        displayName: "Alice",
        avatarUrl: null,
        createdAt: new Date("2026-01-01"),
      });
    });
    const db = env.authenticatedContext("alice").firestore();
    await assertSucceeds(updateDoc(doc(db, "users", "alice"), { displayName: "Alice B" }));
    await assertFails(updateDoc(doc(db, "users", "alice"), { createdAt: new Date() }));
  });

  test("profiles are public to read", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "users", "alice"), {
        displayName: "Alice",
        createdAt: new Date(),
      });
    });
    const db = env.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(db, "users", "alice")));
  });
});

const DAY = 24 * 60 * 60 * 1000;

/** The spark keys an entry carries (the app does not copy the display words). */
function entrySparkFields(words: string[]) {
  const { sparksNorm, sparkKey, pairKeys } = buildSparkFields(words);
  return { sparksNorm, sparkKey, pairKeys };
}

function newEntryData(requestId: string, overrides: Record<string, unknown> = {}) {
  return {
    requestId,
    kind: "npc",
    ...buildEntryFields({
      name: "Vhane, the Last Hour",
      concept: "A statue-keeper who stopped time in her temple.",
      traits: ["Patient", "Grieving"],
    }),
    ...entrySparkFields(["Statue", "Time", "Glowing"]),
    moderation: "ok",
    createdAt: serverTimestamp(),
    ...overrides,
  };
}

type Db = ReturnType<ReturnType<RulesTestEnvironment["authenticatedContext"]>["firestore"]>;

function lockData(uid: string, requestId: string, entryId: string, overrides: Record<string, unknown> = {}) {
  return {
    authorId: uid,
    requestId,
    entryId,
    createdAt: serverTimestamp(),
    ...overrides,
  };
}

/** Mirrors what the app sends: first the private marker, then the entry. */
async function submitAnswer(
  db: Db,
  uid: string,
  requestId: string,
  entryId: string,
  opts: {
    entry?: Record<string, unknown>;
    lock?: Record<string, unknown>;
    skipLock?: boolean;
  } = {},
) {
  if (!opts.skipLock) {
    await setDoc(
      doc(db, ...answerMarkerPath(requestId, uid)),
      lockData(uid, requestId, entryId, opts.lock),
    );
  }
  await setDoc(doc(db, "entries", entryId), newEntryData(requestId, opts.entry));
}

describe("answers: submitting", () => {
  test("a signed-in user can answer someone else's open request", async () => {
    await seedRequest("r1");
    const db = env.authenticatedContext("bob").firestore();
    await assertSucceeds(submitAnswer(db, "bob", "r1", "e1"));
  });

  test("a signed-out visitor cannot answer", async () => {
    await seedRequest("r1");
    const db = env.unauthenticatedContext().firestore();
    await assertFails(submitAnswer(db, "bob", "r1", "e1"));
  });

  test("the requester cannot answer their own request", async () => {
    await seedRequest("r1");
    const db = env.authenticatedContext("seed-user").firestore();
    await assertFails(submitAnswer(db, "seed-user", "r1", "e1"));
  });

  test("one answer per person per request", async () => {
    await seedRequest("r1");
    const db = env.authenticatedContext("bob").firestore();
    await assertSucceeds(submitAnswer(db, "bob", "r1", "e1"));
    await assertFails(submitAnswer(db, "bob", "r1", "e2"));
    // A different person can still answer.
    const carol = env.authenticatedContext("carol").firestore();
    await assertSucceeds(submitAnswer(carol, "carol", "r1", "e3"));
  });

  test("answers are refused after the 3-day window", async () => {
    await seedRequest("r1");
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), "requests", "r1"), {
        createdAt: new Date(Date.now() - 4 * DAY),
      });
    });
    const db = env.authenticatedContext("bob").firestore();
    await assertFails(submitAnswer(db, "bob", "r1", "e1"));
  });

  test("answers to a hidden request are refused", async () => {
    await seedRequest("hidden", { moderation: "hidden" });
    const db = env.authenticatedContext("bob").firestore();
    await assertFails(submitAnswer(db, "bob", "hidden", "e1"));
  });

  test("the entry must match the request's kind and sparks", async () => {
    await seedRequest("r1");
    const db = env.authenticatedContext("bob").firestore();
    await assertSucceeds(
      setDoc(doc(db, ...answerMarkerPath("r1", "bob")), lockData("bob", "r1", "e1")),
    );
    await assertFails(setDoc(doc(db, "entries", "e1"), newEntryData("r1", { kind: "location" })));
    await assertFails(
      setDoc(doc(db, "entries", "e1"), newEntryData("r1", entrySparkFields(["Dragon", "Cave", "Cold"]))),
    );
    // The correct entry still goes through.
    await assertSucceeds(setDoc(doc(db, "entries", "e1"), newEntryData("r1")));
  });

  test("an entry needs the person's own marker, and the marker must name that entry id", async () => {
    await seedRequest("r1");
    const bob = env.authenticatedContext("bob").firestore();
    // No marker at all.
    await assertFails(submitAnswer(bob, "bob", "r1", "e1", { skipLock: true }));
    // Marker names a different entry id.
    await assertSucceeds(
      setDoc(doc(bob, ...answerMarkerPath("r1", "bob")), lockData("bob", "r1", "other")),
    );
    await assertFails(setDoc(doc(bob, "entries", "e1"), newEntryData("r1")));
    // Someone else cannot use bob's marker.
    const carol = env.authenticatedContext("carol").firestore();
    await assertFails(setDoc(doc(carol, "entries", "other"), newEntryData("r1")));
  });

  test("cannot create a marker for someone else or with the wrong id", async () => {
    await seedRequest("r1");
    const bob = env.authenticatedContext("bob").firestore();
    await assertFails(
      setDoc(doc(bob, ...answerMarkerPath("r1", "bob")), lockData("bob", "r1", "e1", { authorId: "alice" })),
    );
    await assertFails(
      setDoc(doc(bob, ...answerMarkerPath("r1", "alice")), lockData("alice", "r1", "e1")),
    );
    await assertFails(
      setDoc(doc(bob, ...answerMarkerPath("r1", "bob")), lockData("bob", "r1", "e1", { createdAt: new Date() })),
    );
  });

  test("the entry itself cannot carry an author, votes or extra fields", async () => {
    await seedRequest("r1");
    const db = env.authenticatedContext("bob").firestore();
    await assertSucceeds(
      setDoc(doc(db, ...answerMarkerPath("r1", "bob")), lockData("bob", "r1", "e1")),
    );
    await assertFails(setDoc(doc(db, "entries", "e1"), newEntryData("r1", { authorId: "bob" })));
    await assertFails(setDoc(doc(db, "entries", "e1"), newEntryData("r1", { voteCount: 99 })));
    await assertFails(setDoc(doc(db, "entries", "e1"), newEntryData("r1", { hook: "An old field" })));
    await assertFails(setDoc(doc(db, "entries", "e1"), newEntryData("r1", { moderation: "hidden" })));
    await assertFails(setDoc(doc(db, "entries", "e1"), newEntryData("r1", { createdAt: new Date() })));
  });

  test("rejects an empty name, too many traits and over-long text", async () => {
    await seedRequest("r1");
    const db = env.authenticatedContext("bob").firestore();
    await assertSucceeds(
      setDoc(doc(db, ...answerMarkerPath("r1", "bob")), lockData("bob", "r1", "e1")),
    );
    await assertFails(setDoc(doc(db, "entries", "e1"), newEntryData("r1", { name: "" })));
    await assertFails(
      setDoc(
        doc(db, "entries", "e1"),
        newEntryData("r1", { traits: ["a", "b", "c", "d", "e", "f"], traitsNorm: ["a", "b", "c", "d", "e", "f"] }),
      ),
    );
    await assertFails(setDoc(doc(db, "entries", "e1"), newEntryData("r1", { concept: "x".repeat(601) })));
  });

  test("the answer count on a request cannot be changed from the app", async () => {
    await seedRequest("r1");
    const db = env.authenticatedContext("bob").firestore();
    await assertFails(updateDoc(doc(db, "requests", "r1"), { answerCount: increment(1) }));
  });
});

describe("answers: reading", () => {
  async function seedEntry(entryId: string, authorId: string, overrides: Record<string, unknown> = {}) {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, "entries", entryId), {
        ...newEntryData("r1", overrides),
        createdAt: new Date(),
      });
      await setDoc(doc(db, ...answerMarkerPath("r1", authorId)), {
        authorId,
        requestId: "r1",
        entryId,
        createdAt: new Date(),
      });
    });
  }

  test("anyone can read the visible entries for a request", async () => {
    await seedRequest("r1");
    await seedEntry("e1", "bob");
    await seedEntry("e2", "carol", { moderation: "hidden" });
    const db = env.unauthenticatedContext().firestore();
    const snap = await assertSucceeds(
      getDocs(
        query(collection(db, "entries"), where("requestId", "==", "r1"), where("moderation", "==", "ok")),
      ),
    );
    assert(snap.size === 1);
    await assertFails(getDoc(doc(db, "entries", "e2")));
  });

  test("a person can read their own marker, and nobody else's", async () => {
    await seedRequest("r1");
    await seedEntry("e1", "bob");
    await seedEntry("e2", "carol");
    const bob = env.authenticatedContext("bob").firestore();
    const mine = await assertSucceeds(getDoc(doc(bob, ...answerMarkerPath("r1", "bob"))));
    assert(mine.exists());
    // A person who has not answered can check their own (empty) slot.
    const dave = env.authenticatedContext("dave").firestore();
    const none = await assertSucceeds(getDoc(doc(dave, ...answerMarkerPath("r1", "dave"))));
    assert(!none.exists());
    // Nobody can read another person's marker, or list the collection.
    await assertFails(getDoc(doc(bob, ...answerMarkerPath("r1", "carol"))));
    await assertFails(getDocs(collection(bob, "requests", "r1", "answerLocks")));
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), ...answerMarkerPath("r1", "bob"))));
  });

  test("entries and markers cannot be edited or deleted", async () => {
    await seedRequest("r1");
    await seedEntry("e1", "bob");
    const db = env.authenticatedContext("bob").firestore();
    await assertFails(updateDoc(doc(db, "entries", "e1"), { name: "Changed" }));
    await assertFails(deleteDoc(doc(db, "entries", "e1")));
    await assertFails(updateDoc(doc(db, ...answerMarkerPath("r1", "bob")), { entryId: "e9" }));
    await assertFails(deleteDoc(doc(db, ...answerMarkerPath("r1", "bob"))));
  });
});

describe("reports", () => {
  const report = (uid: string, entryId: string, overrides: Record<string, unknown> = {}) => ({
    entryId,
    reporterId: uid,
    reason: "ai_generated",
    details: "Reads like a chatbot.",
    status: "open",
    createdAt: serverTimestamp(),
    ...overrides,
  });

  async function seedPlainEntry() {
    await seedRequest("r1");
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "entries", "e1"), {
        ...newEntryData("r1"),
        createdAt: new Date(),
      });
    });
  }

  test("a signed-in user can report an entry once", async () => {
    await seedPlainEntry();
    const db = env.authenticatedContext("bob").firestore();
    await assertSucceeds(setDoc(doc(db, "reports", "e1_bob"), report("bob", "e1")));
    await assertFails(setDoc(doc(db, "reports", "e1_bob"), report("bob", "e1")));
  });

  test("rules reject signed-out reports, other people's ids, bad reasons and missing entries", async () => {
    await seedPlainEntry();
    const bob = env.authenticatedContext("bob").firestore();
    await assertFails(setDoc(doc(env.unauthenticatedContext().firestore(), "reports", "e1_x"), report("x", "e1")));
    await assertFails(setDoc(doc(bob, "reports", "e1_carol"), report("carol", "e1")));
    await assertFails(setDoc(doc(bob, "reports", "e1_bob"), report("bob", "e1", { reason: "boring" })));
    await assertFails(setDoc(doc(bob, "reports", "nope_bob"), report("bob", "nope")));
    await assertFails(setDoc(doc(bob, "reports", "e1_bob"), report("bob", "e1", { status: "actioned" })));
  });

  test("reporters can read their own reports; others cannot", async () => {
    await seedPlainEntry();
    const bob = env.authenticatedContext("bob").firestore();
    await assertSucceeds(setDoc(doc(bob, "reports", "e1_bob"), report("bob", "e1")));
    const mine = await assertSucceeds(
      getDocs(query(collection(bob, "reports"), where("reporterId", "==", "bob"))),
    );
    assert(mine.size === 1);
    const carol = env.authenticatedContext("carol").firestore();
    await assertFails(getDoc(doc(carol, "reports", "e1_bob")));
    await assertFails(getDocs(query(collection(carol, "reports"), where("reporterId", "==", "bob"))));
  });
});

describe("everything else is locked", () => {
  test("unknown collections are refused", async () => {
    const db = env.authenticatedContext("alice").firestore();
    await assertFails(setDoc(doc(db, "votes", "v1"), { entryId: "e1" }));
    await assertFails(getDoc(doc(db, "votes", "v1")));
    await assertFails(setDoc(doc(db, "sparks", "statue"), { count: 1 }));
  });
});
