// Stokes: a vote on the fire itself ("good fire"), one per person.
// The document is `stokes/{requestId}_{uid}`. Counts and the shown-while-saving
// total work the same way as upvotes on answers (see upvotes.ts).

export function stokeId(requestId: string, uid: string): string {
  return `${requestId}_${uid}`;
}

export type { PendingUpvote as PendingStoke } from "./upvotes.ts";
export { shownUpvotes as shownStokes } from "./upvotes.ts";
