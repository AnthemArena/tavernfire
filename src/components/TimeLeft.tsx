import { describeTimeLeft, isClosingSoon } from "@/lib/requests";

/**
 * How long a request still accepts answers. Always a text label (never colour
 * alone); under 24 hours it also gets a tinted pill so it stands out.
 */
export default function TimeLeft({
  createdAt,
  now,
}: {
  createdAt: Date;
  now: Date;
}) {
  const soon = isClosingSoon(createdAt, now);
  return (
    <span className={soon ? "time-left time-left-soon" : "time-left"}>
      {describeTimeLeft(createdAt, now)}
    </span>
  );
}
