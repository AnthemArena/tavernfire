// Security rules tests. Run with: npm run test:rules
// (starts the Firestore emulator, runs these, then shuts it down; needs Java.)

import { after, before, beforeEach, describe, test } from "node:test";
import { readFileSync } from "node:fs";
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
} from "firebase/firestore";
import { buildSparkFields } from "../src/lib/sparks.ts";

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

describe("everything else is locked", () => {
  test("unknown collections are refused", async () => {
    const db = env.authenticatedContext("alice").firestore();
    await assertFails(getDoc(doc(db, "entries", "e1")));
    await assertFails(setDoc(doc(db, "entries", "e1"), { name: "x" }));
    await assertFails(setDoc(doc(db, "votes", "v1"), { entryId: "e1" }));
  });
});
