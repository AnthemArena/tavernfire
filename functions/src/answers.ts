// Keeps two things on each fire in step with its answers, so the Library can show a
// fire's answer count and its best answer without reading the answers themselves:
//   answerCount  how many visible answers it has
//   topAnswer    the most upvoted one ({ name, snippet, author }), oldest first among ties; null if none
// Like the vote counts, this recomputes from the answers every time, so running twice
// cannot leave it wrong. Only this function writes these fields.

import type { Firestore } from "firebase-admin/firestore";

export const SNIPPET_MAX = 140;

export type AnswerSummary = { name: string; snippet: string; author: string | null };

/** The start of a description, cut at a word and ended with an ellipsis if it was shortened. */
export function snippetOf(text: string, max = SNIPPET_MAX): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

type AnswerRow = { name: unknown; concept: unknown; upvoteCount: unknown; createdMs: number; authorName?: unknown };

/** Most upvoted answer; the oldest wins a tie. Null when there is no usable answer. */
export function pickTop(rows: AnswerRow[]): AnswerSummary | null {
  const usable = rows.filter((r) => typeof r.name === "string" && typeof r.concept === "string");
  if (usable.length === 0) return null;
  const votes = (r: AnswerRow) => (typeof r.upvoteCount === "number" ? r.upvoteCount : 0);
  const best = usable.reduce((a, b) =>
    votes(b) > votes(a) || (votes(b) === votes(a) && b.createdMs < a.createdMs) ? b : a,
  );
  const author = typeof best.authorName === "string" && best.authorName !== "" ? best.authorName : null;
  return { name: best.name as string, snippet: snippetOf(best.concept as string), author };
}

/** Recompute a fire's answer count and top answer from its visible answers. */
export async function recomputeFireAnswers(db: Firestore, requestId: string): Promise<number | null> {
  const fire = db.collection("requests").doc(requestId);
  if (!(await fire.get()).exists) return null; // the fire is gone
  const snap = await db
    .collection("entries")
    .where("requestId", "==", requestId)
    .where("moderation", "==", "ok")
    .get();
  const rows: AnswerRow[] = snap.docs.map((d) => ({
    name: d.get("name"),
    concept: d.get("concept"),
    upvoteCount: d.get("upvoteCount"),
    authorName: d.get("authorName"),
    createdMs: d.get("createdAt")?.toMillis?.() ?? 0,
  }));
  const top = pickTop(rows);
  await fire.update({
    answerCount: snap.size,
    // null (not a deleted field) when there is no answer, so no Firestore helper is needed here.
    topAnswer: top,
  });
  return snap.size;
}
