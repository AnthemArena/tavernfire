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
  // Everyone below has already chosen the name "Marrow" (so they can post
  // requests); the display-name tests start people from scratch themselves.
  await env.withSecurityRulesDisabled(async (ctx) => {
    for (const uid of ["alice", "bob", "carol", "dave", "mod", "seed-user"]) {
      await setDoc(doc(ctx.firestore(), "users", uid), {
        displayName: "Marrow",
        nameKey: "marrow",
        nameChangedAt: new Date("2026-01-01"),
        createdAt: new Date("2026-01-01"),
      });
    }
  });
});

test("every launched request type can be posted", async () => {
  const db = env.authenticatedContext("alice").firestore();
  for (const kind of ["npc", "location", "item", "creature"]) {
    await assertSucceeds(addDoc(collection(db, "requests"), newRequest("alice", { kind })));
  }
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
    // Drafted but not launched yet, so the rules refuse it.
    await assertFails(addDoc(collection(db, "requests"), newRequest("alice", { kind: "culture" })));
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

async function seedNameless(uid: string, extra: Record<string, unknown> = {}) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "users", uid), {
      displayName: null,
      createdAt: new Date("2026-01-01"),
      ...extra,
    });
  });
}

/** Claim a name the way the app does: the lookup first, then the profile. */
async function claim(db: ReturnType<ReturnType<RulesTestEnvironment["authenticatedContext"]>["firestore"]>, uid: string, name: string, key: string) {
  await setDoc(doc(db, "displayNames", key), { uid, displayName: name, createdAt: serverTimestamp() });
  await updateDoc(doc(db, "users", uid), { displayName: name, nameKey: key, nameChangedAt: serverTimestamp() });
}

describe("users", () => {
  test("a profile starts with no name", async () => {
    const db = env.authenticatedContext("eve").firestore();
    await assertSucceeds(setDoc(doc(db, "users", "eve"), { displayName: null, createdAt: serverTimestamp() }));
  });

  test("a profile cannot start with a name, a photo, or someone else's id, or a client timestamp", async () => {
    const db = env.authenticatedContext("eve").firestore();
    await assertFails(setDoc(doc(db, "users", "eve"), { displayName: "Eve", createdAt: serverTimestamp() }));
    await assertFails(
      setDoc(doc(db, "users", "eve"), { displayName: null, avatarUrl: "http://x", createdAt: serverTimestamp() }),
    );
    await assertFails(setDoc(doc(db, "users", "bobby"), { displayName: null, createdAt: serverTimestamp() }));
    await assertFails(setDoc(doc(db, "users", "eve"), { displayName: null, createdAt: new Date() }));
  });

  test("profiles are public to read", async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(db, "users", "alice")));
  });

  test("choosing a first name works, and shows on a request", async () => {
    await seedNameless("eve");
    const db = env.authenticatedContext("eve").firestore();
    await assertSucceeds(claim(db, "eve", "Dun Gan", "dungan"));
    await assertSucceeds(
      addDoc(collection(db, "requests"), newRequest("eve", { requesterName: "Dun Gan" })),
    );
  });

  test("the profile cannot take a name that has no claim, or someone else's claim", async () => {
    await seedNameless("eve");
    const db = env.authenticatedContext("eve").firestore();
    await assertFails(
      updateDoc(doc(db, "users", "eve"), { displayName: "Dun Gan", nameKey: "dungan", nameChangedAt: serverTimestamp() }),
    );
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "displayNames", "dungan"), {
        uid: "bob",
        displayName: "Dun Gan",
        createdAt: new Date(),
      });
    });
    await assertFails(
      updateDoc(doc(db, "users", "eve"), { displayName: "Dun Gan", nameKey: "dungan", nameChangedAt: serverTimestamp() }),
    );
  });

  test("two people cannot hold names that differ only by capitals or punctuation", async () => {
    await seedNameless("eve");
    await seedNameless("fay");
    await assertSucceeds(claim(env.authenticatedContext("eve").firestore(), "eve", "Dun Gan", "dungan"));
    const fay = env.authenticatedContext("fay").firestore();
    await assertFails(
      setDoc(doc(fay, "displayNames", "dungan"), { uid: "fay", displayName: "DUNGAN", createdAt: serverTimestamp() }),
    );
    await assertFails(
      setDoc(doc(fay, "displayNames", "dungan"), { uid: "fay", displayName: "Dun_Gan", createdAt: serverTimestamp() }),
    );
  });

  test("a claim must match its own key, be valid, and belong to the person", async () => {
    await seedNameless("eve");
    const db = env.authenticatedContext("eve").firestore();
    const lookup = (key: string, data: Record<string, unknown>) =>
      setDoc(doc(db, "displayNames", key), { createdAt: serverTimestamp(), ...data });
    await assertFails(lookup("other", { uid: "eve", displayName: "Dun Gan" })); // key does not match
    await assertFails(lookup("dungan", { uid: "bob", displayName: "Dun Gan" })); // someone else's
    await assertFails(lookup("ab", { uid: "eve", displayName: "ab" })); // too short
    await assertFails(lookup("x".repeat(21), { uid: "eve", displayName: "x".repeat(21) })); // too long
    await assertFails(lookup("badname", { uid: "eve", displayName: "Bad<Name" })); // odd character
    await assertFails(lookup("dungan", { uid: "eve", displayName: "Dun  Gan" })); // double space
    await assertFails(
      setDoc(doc(db, "displayNames", "dungan"), { uid: "eve", displayName: "Dun Gan", createdAt: new Date() }),
    ); // client time
  });

  test("reserved names are refused", async () => {
    await seedNameless("eve");
    const db = env.authenticatedContext("eve").firestore();
    for (const name of ["Admin", "A d m i n", "Moderator Mike", "Tavern Fire", "Adventurer"]) {
      const key = name.toLowerCase().replace(/[ _.'-]/g, "");
      await assertFails(
        setDoc(doc(db, "displayNames", key), { uid: "eve", displayName: name, createdAt: serverTimestamp() }),
      );
    }
  });

  test("names can be looked up one at a time by signed-in people, never listed", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "displayNames", "marrow"), {
        uid: "alice",
        displayName: "Marrow",
        createdAt: new Date(),
      });
    });
    await assertSucceeds(getDoc(doc(env.authenticatedContext("bob").firestore(), "displayNames", "marrow")));
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), "displayNames", "marrow")));
    await assertFails(getDocs(collection(env.authenticatedContext("bob").firestore(), "displayNames")));
  });

  test("a name can be changed only after 7 days", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "users", "eve"), {
        displayName: "Old Name",
        nameKey: "oldname",
        nameChangedAt: new Date(Date.now() - 2 * DAY),
        createdAt: new Date("2026-01-01"),
      });
    });
    const db = env.authenticatedContext("eve").firestore();
    // Too soon: the new claim itself is refused.
    await assertFails(
      setDoc(doc(db, "displayNames", "newname"), { uid: "eve", displayName: "New Name", createdAt: serverTimestamp() }),
    );
    // After the window it works, and the old claim can then be released.
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "users", "eve"), {
        displayName: "Old Name",
        nameKey: "oldname",
        nameChangedAt: new Date(Date.now() - 8 * DAY),
        createdAt: new Date("2026-01-01"),
      });
      await setDoc(doc(ctx.firestore(), "displayNames", "oldname"), {
        uid: "eve",
        displayName: "Old Name",
        createdAt: new Date(),
      });
    });
    await assertFails(deleteDoc(doc(db, "displayNames", "oldname"))); // still the current name
    await assertSucceeds(claim(db, "eve", "New Name", "newname"));
    await assertSucceeds(deleteDoc(doc(db, "displayNames", "oldname")));
  });

  test("a person cannot delete someone else's claim or edit one", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "displayNames", "marrow"), {
        uid: "alice",
        displayName: "Marrow",
        createdAt: new Date(),
      });
    });
    const bob = env.authenticatedContext("bob").firestore();
    await assertFails(deleteDoc(doc(bob, "displayNames", "marrow")));
    const alice = env.authenticatedContext("alice").firestore();
    await assertFails(updateDoc(doc(alice, "displayNames", "marrow"), { displayName: "MARROW" }));
  });

  test("other profile fields cannot be changed", async () => {
    const db = env.authenticatedContext("alice").firestore();
    await assertFails(updateDoc(doc(db, "users", "alice"), { createdAt: new Date() }));
    await assertFails(updateDoc(doc(db, "users", "alice"), { avatarUrl: "http://x" }));
  });
});

describe("requests carry the chosen name", () => {
  test("someone with no name yet cannot post", async () => {
    await seedNameless("eve");
    const db = env.authenticatedContext("eve").firestore();
    await assertFails(addDoc(collection(db, "requests"), newRequest("eve", { requesterName: "Eve" })));
    await assertFails(addDoc(collection(db, "requests"), newRequest("eve", { requesterName: null })));
  });

  test("the name on a request must be the poster's own chosen name", async () => {
    const db = env.authenticatedContext("alice").firestore();
    await assertFails(addDoc(collection(db, "requests"), newRequest("alice", { requesterName: "Someone Else" })));
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

/** Puts an entry and its private marker in place, as if it had been posted at `postedAt`. */
async function seedPostedAnswer(entryId: string, authorId: string, postedAt: Date, requestId = "r1") {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "entries", entryId), { ...newEntryData(requestId), createdAt: postedAt });
    await setDoc(doc(db, ...answerMarkerPath(requestId, authorId)), {
      authorId,
      requestId,
      entryId,
      createdAt: postedAt,
    });
  });
}

const HOUR = 60 * 60 * 1000;

function edit(overrides: Record<string, unknown> = {}) {
  return {
    name: "Vhane, the Last Hour (revised)",
    concept: "A statue-keeper who stopped time in her temple, and regrets it.",
    traits: ["Patient"],
    traitsNorm: ["patient"],
    editedAt: serverTimestamp(),
    ...overrides,
  };
}

describe("answers: editing your own entry", () => {
  test("the author can edit within 24 hours", async () => {
    await seedRequest("r1");
    await seedPostedAnswer("e1", "bob", new Date(Date.now() - 2 * HOUR));
    const db = env.authenticatedContext("bob").firestore();
    await assertSucceeds(updateDoc(doc(db, "entries", "e1"), edit()));
  });

  test("editing does not restart the clock: the window runs from the original posting", async () => {
    await seedRequest("r1");
    await seedPostedAnswer("e1", "bob", new Date(Date.now() - 25 * HOUR));
    const db = env.authenticatedContext("bob").firestore();
    await assertFails(updateDoc(doc(db, "entries", "e1"), edit()));
  });

  test("not after answers close, even inside 24 hours", async () => {
    await seedRequest("r1");
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), "requests", "r1"), {
        createdAt: new Date(Date.now() - 3.5 * DAY),
      });
    });
    await seedPostedAnswer("e1", "bob", new Date(Date.now() - 1 * HOUR));
    const db = env.authenticatedContext("bob").firestore();
    await assertFails(updateDoc(doc(db, "entries", "e1"), edit()));
  });

  test("only the author can edit, and signed-out visitors cannot", async () => {
    await seedRequest("r1");
    await seedPostedAnswer("e1", "bob", new Date(Date.now() - 1 * HOUR));
    await assertFails(updateDoc(doc(env.authenticatedContext("carol").firestore(), "entries", "e1"), edit()));
    await assertFails(updateDoc(doc(env.unauthenticatedContext().firestore(), "entries", "e1"), edit()));
  });

  test("only name, description and traits can change, and editedAt must be the server time", async () => {
    await seedRequest("r1");
    await seedPostedAnswer("e1", "bob", new Date(Date.now() - 1 * HOUR));
    const db = env.authenticatedContext("bob").firestore();
    const ref = doc(db, "entries", "e1");
    await assertFails(updateDoc(ref, edit({ kind: "location" })));
    await assertFails(updateDoc(ref, edit({ requestId: "r2" })));
    await assertFails(updateDoc(ref, edit({ sparkKey: "a|b|c" })));
    await assertFails(updateDoc(ref, edit({ moderation: "hidden" })));
    await assertFails(updateDoc(ref, edit({ createdAt: new Date() })));
    await assertFails(updateDoc(ref, edit({ authorId: "bob" })));
    await assertFails(updateDoc(ref, edit({ editedAt: new Date() })));
    await assertFails(updateDoc(ref, { name: "No editedAt stamp" }));
  });

  test("an edit must still be a valid entry", async () => {
    await seedRequest("r1");
    await seedPostedAnswer("e1", "bob", new Date(Date.now() - 1 * HOUR));
    const ref = doc(env.authenticatedContext("bob").firestore(), "entries", "e1");
    await assertFails(updateDoc(ref, edit({ name: "" })));
    await assertFails(updateDoc(ref, edit({ concept: "x".repeat(601) })));
    await assertFails(
      updateDoc(ref, edit({ traits: ["a", "b", "c", "d", "e", "f"], traitsNorm: ["a", "b", "c", "d", "e", "f"] })),
    );
  });

  test("entries still cannot be deleted", async () => {
    await seedRequest("r1");
    await seedPostedAnswer("e1", "bob", new Date(Date.now() - 1 * HOUR));
    await assertFails(deleteDoc(doc(env.authenticatedContext("bob").firestore(), "entries", "e1")));
  });

  test("once an entry has been reported, it can no longer be edited", async () => {
    await seedRequest("r1");
    await seedPostedAnswer("e1", "bob", new Date(Date.now() - 1 * HOUR));
    const carol = env.authenticatedContext("carol").firestore();
    await assertSucceeds(
      setDoc(doc(carol, "reports", "e1_carol"), {
        entryId: "e1",
        reporterId: "carol",
        reason: "ai_generated",
        details: "",
        status: "open",
        createdAt: serverTimestamp(),
      }),
    );
    await assertSucceeds(
      setDoc(doc(carol, "entryFlags", "e1"), {
        entryId: "e1",
        reportId: "e1_carol",
        createdAt: serverTimestamp(),
      }),
    );
    const bob = env.authenticatedContext("bob").firestore();
    await assertFails(updateDoc(doc(bob, "entries", "e1"), edit()));
  });
});

describe("report flags", () => {
  async function seedReport(entryId: string, reporter: string) {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "reports", `${entryId}_${reporter}`), {
        entryId,
        reporterId: reporter,
        reason: "spam",
        details: "",
        status: "open",
        createdAt: new Date(),
      });
    });
  }

  const flag = (entryId: string, reportId: string, overrides: Record<string, unknown> = {}) => ({
    entryId,
    reportId,
    createdAt: serverTimestamp(),
    ...overrides,
  });

  test("a flag needs a real report by the same person", async () => {
    await seedRequest("r1");
    await seedPostedAnswer("e1", "bob", new Date());
    const carol = env.authenticatedContext("carol").firestore();
    // No report yet.
    await assertFails(setDoc(doc(carol, "entryFlags", "e1"), flag("e1", "e1_carol")));
    await seedReport("e1", "carol");
    // Someone else cannot use carol's report.
    await assertFails(setDoc(doc(env.authenticatedContext("dave").firestore(), "entryFlags", "e1"), flag("e1", "e1_carol")));
    await assertSucceeds(setDoc(doc(carol, "entryFlags", "e1"), flag("e1", "e1_carol")));
  });

  test("a moderator can lift a flag, after which the author can edit again", async () => {
    await seedRequest("r1");
    await seedPostedAnswer("e1", "bob", new Date(Date.now() - 1 * HOUR));
    await seedReport("e1", "carol");
    const carol = env.authenticatedContext("carol").firestore();
    await assertSucceeds(setDoc(doc(carol, "entryFlags", "e1"), flag("e1", "e1_carol")));
    const bob = env.authenticatedContext("bob").firestore();
    await assertFails(updateDoc(doc(bob, "entries", "e1"), edit()));
    await assertFails(deleteDoc(doc(carol, "entryFlags", "e1")));
    const mod = env.authenticatedContext("mod", { role: "moderator" }).firestore();
    await assertSucceeds(deleteDoc(doc(mod, "entryFlags", "e1")));
    await assertSucceeds(updateDoc(doc(bob, "entries", "e1"), edit()));
  });

  test("a flag cannot be created twice, edited, deleted or read by members", async () => {
    await seedRequest("r1");
    await seedPostedAnswer("e1", "bob", new Date());
    await seedReport("e1", "carol");
    const carol = env.authenticatedContext("carol").firestore();
    await assertSucceeds(setDoc(doc(carol, "entryFlags", "e1"), flag("e1", "e1_carol")));
    await assertFails(setDoc(doc(carol, "entryFlags", "e1"), flag("e1", "e1_carol")));
    await assertFails(deleteDoc(doc(carol, "entryFlags", "e1")));
    await assertFails(getDoc(doc(carol, "entryFlags", "e1")));
    await assertFails(getDoc(doc(env.authenticatedContext("bob").firestore(), "entryFlags", "e1")));
  });

  test("a flag must name its own entry and carry the server time", async () => {
    await seedRequest("r1");
    await seedPostedAnswer("e1", "bob", new Date());
    await seedReport("e1", "carol");
    const carol = env.authenticatedContext("carol").firestore();
    await assertFails(setDoc(doc(carol, "entryFlags", "e2"), flag("e1", "e1_carol")));
    await assertFails(setDoc(doc(carol, "entryFlags", "e1"), flag("e1", "e1_carol", { createdAt: new Date() })));
    await assertFails(setDoc(doc(carol, "entryFlags", "e1"), flag("e1", "e1_carol", { extra: 1 })));
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
