// Keeps the upvote total on each answer in step with its upvote documents.
//
// The app writes one document per person per answer (`upvotes/{entryId}_{uid}`)
// and can never write the total. This recounts instead of adding one, so a
// trigger that runs twice cannot leave the total wrong.

import type { Firestore } from "firebase-admin/firestore";

/** Count the upvotes for an answer and store the total on it. Returns the total. */
export async function recountUpvotes(db: Firestore, entryId: string): Promise<number | null> {
  const entry = db.collection("entries").doc(entryId);
  if (!(await entry.get()).exists) return null; // the answer is gone
  const snap = await db.collection("upvotes").where("entryId", "==", entryId).count().get();
  const total = snap.data().count;
  await entry.update({ upvoteCount: total });
  return total;
}
