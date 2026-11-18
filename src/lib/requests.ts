// Shared types and helpers for requests.

export const ANSWER_WINDOW_DAYS = 3;

export const REQUEST_KINDS = ["npc", "location"] as const;
export type RequestKind = (typeof REQUEST_KINDS)[number];

export const KIND_LABELS: Record<RequestKind, string> = {
  npc: "NPC",
  location: "Location",
};

export type RequestItem = {
  id: string;
  sparks: string[];
  sparksNorm: string[];
  sparkKey: string;
  kind: RequestKind;
  note: string;
  requesterId: string;
  requesterName: string;
  answerCount: number;
  /** When the request was created. A local estimate until the server confirms it. */
  createdAt: Date;
};

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
    (kind !== "npc" && kind !== "location") ||
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
    answerCount: typeof data.answerCount === "number" ? data.answerCount : 0,
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
  const msLeft = answersCloseAt(createdAt).getTime() - now.getTime();
  if (msLeft <= 0) return "Answers closed";

  const hour = 60 * 60 * 1000;
  const day = 24 * hour;

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
