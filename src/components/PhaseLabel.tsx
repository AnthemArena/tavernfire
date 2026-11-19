import { describePhase, displayPhase, isClosingSoon, type RequestItem } from "@/lib/requests";

/**
 * Where a request is in its life, as a text label (never colour alone):
 * "Open for answers · 2 days left", "Voting · ends in 2 days", "Counting votes",
 * "Results are in". Under 24 hours of answering left it also gets a tinted pill.
 */
export default function PhaseLabel({
  request,
  now,
}: {
  request: Pick<RequestItem, "status" | "createdAt">;
  now: Date;
}) {
  const soon = displayPhase(request, now) === "answering" && isClosingSoon(request.createdAt, now);
  return (
    <span className={soon ? "time-left time-left-soon" : "time-left"}>
      {describePhase(request, now)}
    </span>
  );
}
