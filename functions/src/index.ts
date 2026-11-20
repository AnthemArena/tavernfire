import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { runLifecycle } from "./lifecycle.ts";
import { recountUpvotes } from "./upvotes.ts";
import { recomputeFireAnswers } from "./answers.ts";
import { applyModeration, isModerationAction } from "./moderation.ts";
import { avatarOf, syncAvatar } from "./avatars.ts";
import { recountSparks, sparksChanged, sparksOf } from "./sparks.ts";
import { addTrend, recountStokes, STOKE_WEIGHT, UPVOTE_WEIGHT } from "./trending.ts";

initializeApp();

// Every 15 minutes: close answering, run voting, reveal results, clear old ballots.
export const advanceLifecycle = onSchedule(
  {
    schedule: "every 15 minutes",
    timeZone: "Europe/London",
    region: "europe-west2",
    maxInstances: 1,
    retryCount: 0,
  },
  async () => {
    // Paused: ordinary fires no longer close or go to a vote (they stay open and
    // are upvoted). The code stays for duels. Set LIFECYCLE_ENABLED=true in the
    // function's environment to run it again.
    if (process.env.LIFECYCLE_ENABLED !== "true") {
      console.log("Lifecycle paused");
      return;
    }
    const report = await runLifecycle(getFirestore(), new Date());
    console.log("Lifecycle pass", JSON.stringify(report));
  },
);

// Whenever an upvote is added or removed, recount that answer's upvotes.
export const countUpvotes = onDocumentWritten(
  { document: "upvotes/{upvoteId}", region: "europe-west2", maxInstances: 5 },
  async (event) => {
    const data = event.data?.after.data() ?? event.data?.before.data();
    const entryId = data?.entryId;
    if (typeof entryId !== "string") return;
    const db = getFirestore();
    await recountUpvotes(db, entryId);
    // A new upvote also warms up the fire it belongs to (taking one back does not cool it).
    const added = event.data?.before.exists === false && event.data?.after.exists === true;
    if (added && typeof data?.requestId === "string") {
      await addTrend(db, data.requestId, UPVOTE_WEIGHT, Date.now());
    }
  },
);

// Whenever a fire is stoked or un-stoked, recount it, and warm it up for Trending.
export const countStokes = onDocumentWritten(
  { document: "stokes/{stokeId}", region: "europe-west2", maxInstances: 5 },
  async (event) => {
    const data = event.data?.after.data() ?? event.data?.before.data();
    const requestId = data?.requestId;
    if (typeof requestId !== "string") return;
    const db = getFirestore();
    await recountStokes(db, requestId);
    const added = event.data?.before.exists === false && event.data?.after.exists === true;
    if (added) await addTrend(db, requestId, STOKE_WEIGHT, Date.now());
  },
);

// When a fire is lit or deleted (or its sparks change), recount the sparks it uses.
// Other changes to a fire (stokes, trend scores) are ignored.
export const countSparks = onDocumentWritten(
  { document: "requests/{requestId}", region: "europe-west2", maxInstances: 5 },
  async (event) => {
    const before = sparksOf(event.data?.before.data());
    const after = sparksOf(event.data?.after.data());
    if (!sparksChanged(before, after)) return;
    await recountSparks(getFirestore(), [...before, ...after]);
  },
);

// Whenever an answer is added, edited or its upvotes change, refresh its fire's answer
// count and top answer (shown on Library cards).
export const countAnswers = onDocumentWritten(
  { document: "entries/{entryId}", region: "europe-west2", maxInstances: 5 },
  async (event) => {
    const data = event.data?.after.data() ?? event.data?.before.data();
    const requestId = data?.requestId;
    if (typeof requestId !== "string") return;
    await recomputeFireAnswers(getFirestore(), requestId);
  },
);

// When a member picks a new avatar, copy it onto their fires and answers.
// Other changes to the profile (such as the display name) are ignored.
export const propagateAvatar = onDocumentWritten(
  { document: "users/{uid}", region: "europe-west2", maxInstances: 3 },
  async (event) => {
    const before = avatarOf(event.data?.before.data());
    const after = avatarOf(event.data?.after.data());
    if (before === after) return;
    const changed = await syncAvatar(getFirestore(), event.params.uid, after);
    console.log("Avatar synced", event.params.uid, changed);
  },
);

// A moderator hides, restores or clears the reports on an answer. Only people whose
// account has the moderator role (see scripts/set-moderator.mjs) can call it.
export const moderateAnswer = onCall({ region: "europe-west2", maxInstances: 5 }, async (request) => {
  if (request.auth?.token.role !== "moderator") {
    throw new HttpsError("permission-denied", "Moderators only.");
  }
  const { entryId, action } = (request.data ?? {}) as { entryId?: unknown; action?: unknown };
  if (typeof entryId !== "string" || entryId === "" || !isModerationAction(action)) {
    throw new HttpsError("invalid-argument", "Send an answer id and an action (hide, dismiss or restore).");
  }
  const found = await applyModeration(getFirestore(), entryId, action, request.auth.uid);
  if (!found) throw new HttpsError("not-found", "That answer no longer exists.");
  return { ok: true };
});
