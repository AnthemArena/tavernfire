// Notifications as the app shows them. The documents are written by functions
// (functions/src/notify.ts); this turns one into a line of text and a link, and groups
// bursts for toasts.

import { achievementById } from "./achievements.ts";
import { rankByLevel } from "./xp.ts";

export type NotificationType = "stoke" | "upvote" | "answer" | "achievement" | "levelup";

export type NotificationItem = {
  id: string;
  type: NotificationType;
  text: string;
  href: string;
  createdAt: Date | null;
  read: boolean;
};

const TYPES: readonly string[] = ["stoke", "upvote", "answer", "achievement", "levelup"];

const str = (v: unknown) => (typeof v === "string" ? v : "");

/** A notification document as an item to show, or null if it is not one we understand. */
export function toNotification(id: string, data: Record<string, unknown>, myId: string): NotificationItem | null {
  const type = data.type;
  if (typeof type !== "string" || !TYPES.includes(type)) return null;
  const sparks = str(data.sparks);
  const fire = sparks ? ` "${sparks}"` : "";
  const created = data.createdAt as { toDate?: () => Date } | null | undefined;
  const base = {
    id,
    type: type as NotificationType,
    createdAt: typeof created?.toDate === "function" ? created.toDate() : null,
    read: data.read === true,
  };
  const fireLink = typeof data.requestId === "string" && data.requestId ? `/fires/${data.requestId}` : "/";
  // Newer upvote and answer notifications know which answer, so the link opens it.
  const answerLink = fireLink !== "/" && typeof data.entryId === "string" && data.entryId ? `${fireLink}#entry-${data.entryId}` : fireLink;
  switch (type) {
    case "stoke":
      return { ...base, text: `Your fire${fire} was stoked.`, href: fireLink };
    case "upvote": {
      const name = str(data.entryName);
      return { ...base, text: name ? `Your answer "${name}" was upvoted.` : "Your answer was upvoted.", href: answerLink };
    }
    case "answer":
      return { ...base, text: `${str(data.actorName) || "Someone"} answered your fire${fire}.`, href: answerLink };
    case "achievement": {
      const a = achievementById(str(data.achievement));
      if (!a) return null;
      return { ...base, text: `Achievement unlocked: "${a.name}"`, href: `/profile/${myId}` };
    }
    default: {
      const level = typeof data.level === "number" ? data.level : 1;
      return { ...base, text: `You reached ${rankByLevel(level).name}.`, href: `/profile/${myId}` };
    }
  }
}

/** Stokes and upvotes arrive in bursts, so toasts for them are combined into one line. */
export function isGroupable(type: NotificationType): boolean {
  return type === "stoke" || type === "upvote";
}

export function groupedText(type: "stoke" | "upvote", count: number): string {
  return type === "stoke" ? `${count} stokes on your fires.` : `${count} upvotes on your answers.`;
}

export type Toast = {
  /** Stable key for this toast on screen. */
  key: string;
  type: NotificationType;
  text: string;
  href: string;
  count: number;
  /** The notifications behind it, so clicking can mark them read. */
  ids: string[];
  /** When it last changed; the toast leaves a few seconds after this. */
  at: number;
};

export const MAX_TOASTS = 3;

/**
 * Add a new notification to the toasts on screen: stokes and upvotes join an existing
 * toast of the same kind; anything else gets its own. At most MAX_TOASTS stay (the newest).
 */
export function addToast(toasts: Toast[], item: NotificationItem, now: number): Toast[] {
  if (isGroupable(item.type)) {
    const existing = toasts.find((t) => t.type === item.type);
    if (existing) {
      const count = existing.count + 1;
      const merged: Toast = {
        ...existing,
        count,
        text: groupedText(item.type as "stoke" | "upvote", count),
        href: "/", // several fires or answers: no single place to go
        ids: [...existing.ids, item.id],
        at: now,
      };
      return toasts.map((t) => (t === existing ? merged : t));
    }
  }
  const next: Toast = { key: item.id, type: item.type, text: item.text, href: item.href, count: 1, ids: [item.id], at: now };
  return [...toasts, next].slice(-MAX_TOASTS);
}
