// What a moderator can do about a reported answer. These changes cannot be made from
// the app (the rules refuse them for everyone), so they run here, with admin access,
// after the callable function in index.ts has checked the caller is a moderator.
//
//   hide     the answer disappears from the site (moderation: "hidden"); its reports are
//            marked "actioned". The edit lock stays.
//   dismiss  the reports were mistaken: they are marked "dismissed" and the edit lock is
//            removed so the author can edit again (if their 24 hours have not ended).
//   restore  put a hidden answer back on the site.
//
// Every action is written to `moderationLog`.

import type { Firestore } from "firebase-admin/firestore";

export const MODERATION_ACTIONS = ["hide", "dismiss", "restore"] as const;
export type ModerationAction = (typeof MODERATION_ACTIONS)[number];

export function isModerationAction(value: unknown): value is ModerationAction {
  return typeof value === "string" && (MODERATION_ACTIONS as readonly string[]).includes(value);
}

/** Apply one moderator action to an answer. Returns false if the answer does not exist. */
export async function applyModeration(
  db: Firestore,
  entryId: string,
  action: ModerationAction,
  moderatorUid: string,
): Promise<boolean> {
  const entryRef = db.collection("entries").doc(entryId);
  if (!(await entryRef.get()).exists) return false;

  const reports = await db.collection("reports").where("entryId", "==", entryId).get();
  const batch = db.batch();

  if (action === "hide") {
    batch.update(entryRef, { moderation: "hidden" });
    for (const r of reports.docs) batch.update(r.ref, { status: "actioned" });
  } else if (action === "dismiss") {
    for (const r of reports.docs) batch.update(r.ref, { status: "dismissed" });
    batch.delete(db.collection("entryFlags").doc(entryId));
  } else {
    batch.update(entryRef, { moderation: "ok" });
  }

  batch.set(db.collection("moderationLog").doc(), {
    entryId,
    action,
    moderatorUid,
    at: new Date(),
  });
  await batch.commit();
  return true;
}
