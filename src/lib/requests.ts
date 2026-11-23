// Shared types and helpers for requests.

export const ANSWER_WINDOW_DAYS = 3;
/** Answers and voting for 3 days, then voting only for 2 more. */
export const VOTING_WINDOW_DAYS = 5;

import { isAvatarId, type AvatarId } from "./avatars.ts";
import { getCategory, isCategoryId, type CategoryId } from "./categories.ts";

/** The type of a request. The list of types lives in categories.ts. */
export type RequestKind = CategoryId;

/** Short label for a type, for badges. */
export function kindLabel(kind: RequestKind): string {
  return getCategory(kind).label;
}

/** Written by the lifecycle function: open, voting, revealed (results out) or closed (no answers). */
export type RequestStatus = "open" | "voting" | "revealed" | "closed";

export type RequestItem = {
  id: string;
  sparks: string[];
  sparksNorm: string[];
  sparkKey: string;
  kind: RequestKind;
  note: string;
  requesterId: string;
  requesterName: string;
  /** The lighter's preset avatar, kept current by a Cloud Function. Null if none. */
  requesterAvatar: AvatarId | null;
  answerCount: number;
  /** How many people have stoked it ("good fire"). Kept by a Cloud Function. */
  stokeCount: number;
  /** The most upvoted answer so far, kept by a Cloud Function. Null when there are no answers. */
  topAnswer: { name: string; snippet: string; author: string | null } | null;
  status: RequestStatus;
  /** People who picked favourites; set when the results are revealed. */
  ballotCount: number | null;
  /** When the request was created. A local estimate until the server confirms it. */
  createdAt: Date;
};

function toTopAnswer(raw: unknown): RequestItem["topAnswer"] {
  if (typeof raw !== "object" || raw === null) return null;
  const { name, snippet, author } = raw as { name?: unknown; snippet?: unknown; author?: unknown };
  if (typeof name !== "string" || typeof snippet !== "string") return null;
  return { name, snippet, author: typeof author === "string" && author !== "" ? author : null };
}

/**
 * Convert a Firestore document's data into a RequestItem.
 * Returns null if the data is missing something essential, so a bad document
 * never breaks the whole board.
 */
export function toRequestItem(
  id: string,
  data: Record<string, unknown>,
): RequestItem | null {
  const sparks = data.sparks;
  const kind = data.kind;
  const createdAt = data.createdAt as { toDate?: () => Date } | null | undefined;

  if (
    !Array.isArray(sparks) ||
    sparks.length !== 3 ||
    !sparks.every((s) => typeof s === "string") ||
    !isCategoryId(kind) ||
    typeof createdAt?.toDate !== "function"
  ) {
    return null;
  }

  return {
    id,
    sparks: sparks as string[],
    sparksNorm: Array.isArray(data.sparksNorm) ? (data.sparksNorm as string[]) : [],
    sparkKey: typeof data.sparkKey === "string" ? data.sparkKey : "",
    kind,
    note: typeof data.note === "string" ? data.note : "",
    requesterId: typeof data.requesterId === "string" ? data.requesterId : "",
    requesterName:
      typeof data.requesterName === "string" && data.requesterName
        ? data.requesterName
        : "Someone",
    requesterAvatar: isAvatarId(data.requesterAvatar) ? data.requesterAvatar : null,
    answerCount: typeof data.answerCount === "number" ? data.answerCount : 0,
    stokeCount: typeof data.stokeCount === "number" && data.stokeCount > 0 ? data.stokeCount : 0,
    topAnswer: toTopAnswer(data.topAnswer),
    status:
      data.status === "voting" || data.status === "revealed" || data.status === "closed"
        ? data.status
        : "open",
    ballotCount: typeof data.ballotCount === "number" ? data.ballotCount : null,
    createdAt: createdAt.toDate(),
  };
}

/** When answers stop being accepted. Derived from createdAt until a server function stores it. */
export function answersCloseAt(createdAt: Date): Date {
  return new Date(createdAt.getTime() + ANSWER_WINDOW_DAYS * 24 * 60 * 60 * 1000);
}

/** True while answers are still open but fewer than 24 hours remain. */
export function isClosingSoon(createdAt: Date, now: Date): boolean {
  const msLeft = answersCloseAt(createdAt).getTime() - now.getTime();
  return msLeft > 0 && msLeft < 24 * 60 * 60 * 1000;
}

/** A short human label such as "2 days left", "5 hours left" or "Answers closed". */
export function describeTimeLeft(createdAt: Date, now: Date): string {
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;
  // Never show more than the full window, even if this device's clock is a little
  // behind the server's (a request can then look like it was created "in the future").
  const msLeft = Math.min(
    answersCloseAt(createdAt).getTime() - now.getTime(),
    ANSWER_WINDOW_DAYS * day,
  );
  if (msLeft <= 0) return "Answers closed";

  if (msLeft >= day) {
    const days = Math.ceil(msLeft / day);
    return days === 1 ? "1 day left" : `${days} days left`;
  }
  if (msLeft >= hour) {
    const hours = Math.floor(msLeft / hour);
    return hours === 1 ? "1 hour left" : `${hours} hours left`;
  }
  return "Closing soon";
}

/** When voting stops. Derived from createdAt until a server function stores it. */
export function votingClosesAt(createdAt: Date): Date {
  return new Date(createdAt.getTime() + VOTING_WINDOW_DAYS * 24 * 60 * 60 * 1000);
}

export type RequestPhase = "answering" | "voting" | "ended";

/**
 * Where a request is in its life: answers and voting both open for 3 days
 * ("answering"), then voting only for 2 more ("voting"), then "ended" (results
 * are counted by a function; until it exists the app just says so).
 */
export function requestPhase(createdAt: Date, now: Date): RequestPhase {
  if (now < answersCloseAt(createdAt)) return "answering";
  if (now < votingClosesAt(createdAt)) return "voting";
  return "ended";
}

/** What to show people. "counting" is the gap between voting ending and the results function running. */
export type DisplayPhase = "answering" | "voting" | "counting" | "revealed" | "closed";

export function displayPhase(r: Pick<RequestItem, "status" | "createdAt">, now: Date): DisplayPhase {
  if (r.status === "revealed") return "revealed";
  if (r.status === "closed") return "closed";
  const phase = requestPhase(r.createdAt, now);
  return phase === "ended" ? "counting" : phase;
}

/** "2 days", "5 hours" or "under an hour": how long until a moment. */
export function describeUntil(until: Date, now: Date): string {
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;
  const ms = until.getTime() - now.getTime();
  if (ms >= day) {
    const days = Math.ceil(ms / day);
    return days === 1 ? "1 day" : `${days} days`;
  }
  if (ms >= hour) {
    const hours = Math.floor(ms / hour);
    return hours === 1 ? "1 hour" : `${hours} hours`;
  }
  return "under an hour";
}

/** "today", "1 day ago", "3 days ago": how long ago something was posted. */
export function describeAge(at: Date, now: Date): string {
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;
  const ms = Math.max(0, now.getTime() - at.getTime());
  if (ms < hour) return "just now";
  if (ms < day) {
    const hours = Math.floor(ms / hour);
    return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  }
  const days = Math.floor(ms / day);
  if (days < 60) return days === 1 ? "1 day ago" : `${days} days ago`;
  const months = Math.floor(days / 30);
  return months < 24 ? `${months} months ago` : `${Math.floor(days / 365)} years ago`;
}

/** The short status line on cards and request pages. */
export function describePhase(r: Pick<RequestItem, "status" | "createdAt">, now: Date): string {
  switch (displayPhase(r, now)) {
    case "answering":
      return `Open for answers · ${describeTimeLeft(r.createdAt, now)}`;
    case "voting":
      return `Voting · ends in ${describeUntil(votingClosesAt(r.createdAt), now)}`;
    case "counting":
      return "Counting votes";
    case "revealed":
      return "Results are in";
    case "closed":
      return "Closed with no answers";
  }
}
