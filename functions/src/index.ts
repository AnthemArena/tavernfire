import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { runLifecycle } from "./lifecycle.ts";

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
