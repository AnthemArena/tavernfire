// Rebuilds the list of sparks in use (the `sparks` collection) from the fires that exist.
//
//   node scripts/rebuild-sparks.mjs            show what would change
//   node scripts/rebuild-sparks.mjs --apply    make the change
//
// Use it when the cloud of popular sparks looks wrong (for example after fires were
// deleted before the countSparks function existed). It needs the same admin key as
// scripts/set-moderator.mjs: set GOOGLE_APPLICATION_CREDENTIALS to the key file first.

import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error("Set GOOGLE_APPLICATION_CREDENTIALS to your service account key first (see scripts/set-moderator.mjs).");
  process.exit(1);
}
const apply = process.argv.includes("--apply");

initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID ?? "tavernfire-3fcb5" });
const db = getFirestore();

// Count every fire, the same way the countSparks function does.
const wanted = new Map();
for (const doc of (await db.collection("requests").get()).docs) {
  const norms = doc.get("sparksNorm");
  if (!Array.isArray(norms)) continue;
  for (const norm of new Set(norms)) {
    if (typeof norm === "string" && norm !== "") wanted.set(norm, (wanted.get(norm) ?? 0) + 1);
  }
}

const existing = new Map((await db.collection("sparks").get()).docs.map((d) => [d.id, d.get("count")]));
const changes = [];
for (const [word, count] of wanted) {
  if (existing.get(word) !== count) changes.push({ word, from: existing.get(word) ?? "none", to: count });
}
for (const [word, count] of existing) {
  if (!wanted.has(word)) changes.push({ word, from: count, to: "removed" });
}

if (changes.length === 0) {
  console.log("The sparks list is already correct.");
} else {
  for (const c of changes) console.log(`${c.word}: ${c.from} -> ${c.to}`);
  if (!apply) {
    console.log("\nNothing changed. Run again with --apply to make these changes.");
  } else {
    const batch = db.batch();
    for (const [word, count] of wanted) batch.set(db.collection("sparks").doc(word), { word, count });
    for (const word of existing.keys()) if (!wanted.has(word)) batch.delete(db.collection("sparks").doc(word));
    await batch.commit();
    console.log("\nDone.");
  }
}
