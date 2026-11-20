// What to say about each of your own answers on the settings page.

import { describeAge } from "./requests.ts";
import type { EntryItem } from "./entries.ts";

/** One line about an answer of yours: when you posted it. */
export function answerStatus(entry: Pick<EntryItem, "createdAt"> | null, now: Date): string {
  if (entry === null) return "This answer is no longer shown.";
  return entry.createdAt ? `Posted ${describeAge(entry.createdAt, now)}` : "Just posted";
}
