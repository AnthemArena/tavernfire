// Upvotes on answers: the document id and the count shown while a change is saving.
//
// Each upvote is one document, `upvotes/{entryId}_{uid}` (so a person can upvote an
// answer once). The total on the answer is kept by a Cloud Function and arrives a
// moment after the vote, so the screen adds the person's own change until it does.

export function upvoteId(entryId: string, uid: string): string {
  return `${entryId}_${uid}`;
}

/** A change the person just made, and the total the answer had before it. */
export type PendingUpvote = { delta: 1 | -1; base: number };

/** The total to show: the server's, plus the person's own change until the server catches up. */
export function shownUpvotes(serverCount: number, pending: PendingUpvote | undefined): number {
  if (pending && serverCount === pending.base) return Math.max(0, serverCount + pending.delta);
  return serverCount;
}

export type AnswerSort = "top" | "newest";

/** Top: most upvotes first, newest first among equals. Newest: newest first. */
export function sortAnswers<T extends { upvoteCount: number; createdAt: Date | null }>(
  items: T[],
  sort: AnswerSort,
  counts: (item: T) => number = (item) => item.upvoteCount,
): T[] {
  const time = (x: T) => x.createdAt?.getTime() ?? 0;
  return [...items].sort((a, b) =>
    sort === "top" && counts(b) !== counts(a) ? counts(b) - counts(a) : time(b) - time(a),
  );
}
