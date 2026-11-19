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
    const report = await runLifecycle(getFirestore(), new Date());
    console.log("Lifecycle pass", JSON.stringify(report));
  },
);
