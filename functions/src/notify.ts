// Notifications: one small document per thing that happened to a member
// (`notifications/{id}`), written only by functions and read only by the member it is for.
// The app shows them as a list (the bell) and as toasts while the member is on the site.
//
// Each notification has a fixed id made from what caused it (for example `upvote_<upvoteId>`),
// so a function that runs twice, or an upvote taken back and given again, cannot send a
// second one: creating an existing id is simply ignored.

import type { Firestore } from "firebase-admin/firestore";

export type NotificationType = "stoke" | "upvote" | "answer" | "achievement" | "levelup";

export type NotificationData = {
  recipientId: string;
  type: NotificationType;
  /** The fire it is about, for stoke, upvote and answer. */
  requestId?: string;
  /** What to call the fire: its sparks, e.g. "Statue, Time, Glowing". */
  sparks?: string;
  /** The answer, for upvote and answer, so the link can open it on the fire page. */
  entryId?: string;
  /** The answer's name, for upvote. */
  entryName?: string;
  /** Who answered, for answer. Stokes and upvotes are anonymous on purpose. */
  actorName?: string;
  /** For achievement: its id. */
  achievement?: string;
  /** For levelup: the level reached. */
  level?: number;
};

function alreadyExists(err: unknown): boolean {
  const e = err as { code?: unknown; message?: unknown };
  return e?.code === 6 || (typeof e?.message === "string" && e.message.includes("ALREADY_EXISTS"));
}

/** Save a notification under a fixed id. Returns false if it already existed. */
export async function createNotification(db: Firestore, id: string, data: NotificationData): Promise<boolean> {
  try {
    await db.collection("notifications").doc(id).create({ ...data, read: false, createdAt: new Date() });
    return true;
  } catch (err) {
    if (alreadyExists(err)) return false;
    throw err;
  }
}

/** "Statue, Time, Glowing" from a fire's stored sparks. */
export function sparksText(sparks: unknown): string {
  return Array.isArray(sparks) ? sparks.filter((s): s is string => typeof s === "string").join(", ") : "";
}

/** Someone stoked a fire: tell its lighter (never the person who stoked). */
export async function notifyStoke(db: Firestore, stokeId: string, requestId: string, voterId: unknown): Promise<boolean> {
  const fire = await db.collection("requests").doc(requestId).get();
  const owner = fire.get("requesterId");
  if (typeof owner !== "string" || owner === "" || owner === voterId) return false;
  return createNotification(db, `stoke_${stokeId}`, {
    recipientId: owner,
    type: "stoke",
    requestId,
    sparks: sparksText(fire.get("sparks")),
  });
}

/** Someone upvoted an answer: tell its author (never the person who upvoted). */
export async function notifyUpvote(db: Firestore, upvoteId: string, entryId: string, voterId: unknown): Promise<boolean> {
  const answer = await db.collection("entries").doc(entryId).get();
  const author = answer.get("authorId");
  const requestId = answer.get("requestId");
  if (typeof author !== "string" || author === "" || author === voterId || typeof requestId !== "string") return false;
  return createNotification(db, `upvote_${upvoteId}`, {
    recipientId: author,
    type: "upvote",
    requestId,
    entryId,
    entryName: typeof answer.get("name") === "string" ? (answer.get("name") as string) : "",
  });
}

/** Someone answered a fire: tell its lighter. */
export async function notifyAnswer(db: Firestore, entryId: string, answer: Record<string, unknown>): Promise<boolean> {
  const requestId = answer.requestId;
  if (typeof requestId !== "string") return false;
  const fire = await db.collection("requests").doc(requestId).get();
  const owner = fire.get("requesterId");
  if (typeof owner !== "string" || owner === "" || owner === answer.authorId) return false;
  return createNotification(db, `answer_${entryId}`, {
    recipientId: owner,
    type: "answer",
    requestId,
    entryId,
    sparks: sparksText(fire.get("sparks")),
    actorName: typeof answer.authorName === "string" ? answer.authorName : "Someone",
  });
}
