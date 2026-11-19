// What to say about each of your own answers on the account page.

import { rankLabel, type EntryItem } from "./entries.ts";
import { displayPhase, votingClosesAt, type RequestItem } from "./requests.ts";

/**
 * One line about how an answer is doing. Before the reveal it says when results
 * come (never anything about votes); after, its rank and picks.
 */
export function answerStatus(
  request: Pick<RequestItem, "status" | "createdAt">,
  entry: Pick<EntryItem, "reveal"> | null,
  now: Date,
): string {
  if (entry === null) return "This answer is no longer shown.";
  switch (displayPhase(request, now)) {
    case "answering":
    case "voting": {
      const day = votingClosesAt(request.createdAt).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
      });
      return `Results after ${day}`;
    }
    case "counting":
      return "Counting votes";
    case "closed":
      return "Closed";
    case "revealed": {
      const r = entry.reveal;
      if (!r) return "Results are in";
      const picks = `${r.picks} ${r.picks === 1 ? "pick" : "picks"}`;
      const parts: string[] = [];
      if (r.favourite) parts.push("Community favourite");
      if (r.rank !== null) parts.push(rankLabel(r.rank, r.tied));
      if (r.picks > 0 || r.rank !== null) parts.push(picks);
      return parts.length > 0 ? parts.join(" · ") : "Results are in";
    }
  }
}
