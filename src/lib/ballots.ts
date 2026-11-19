// Helpers for a person's ballot (their picks for one request).
import { MAX_PICKS } from "./ranking.ts";

export { MAX_PICKS };

/** The path of a person's ballot for a request. */
export function ballotPath(requestId: string, uid: string): string {
  return `requests/${requestId}/ballots/${uid}`;
}

/** Picks left to use (never below zero). */
export function picksLeft(picks: string[]): number {
  return Math.max(0, MAX_PICKS - picks.length);
}

/**
 * Add or remove a pick. Returns null when the person is already at the cap and
 * tries to add another (the screen says to un-pick one first).
 */
export function togglePick(picks: string[], entryId: string): string[] | null {
  if (picks.includes(entryId)) return picks.filter((id) => id !== entryId);
  if (picks.length >= MAX_PICKS) return null;
  return [...picks, entryId];
}
