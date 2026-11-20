import { describeAge, type RequestItem } from "@/lib/requests";

/** How long ago a fire was lit, as text. Fires stay open, so there is no phase to show. */
export default function PhaseLabel({
  request,
  now,
}: {
  request: Pick<RequestItem, "createdAt">;
  now: Date;
}) {
  return <span className="time-left">Lit {describeAge(request.createdAt, now)}</span>;
}
