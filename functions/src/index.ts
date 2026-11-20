import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { runLifecycle } from "./lifecycle.ts";
import { recountUpvotes } from "./upvotes.ts";

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
    await recountUpvotes(getFirestore(), entryId);
  },
);
