import type { ReactNode } from "react";
import { RANKS, rankFor, rankProgress } from "@/lib/xp";

/** One line icon per rank, in the style of rank insignia: a diamond, then one to three chevrons, then a star. */
const INSIGNIA: Record<number, ReactNode> = {
  1: <path d="M12 3.5 19 12l-7 8.5L5 12z" />,
  2: <path d="M5 15l7-7 7 7" />,
  3: (
    <>
      <path d="M5 11l7-7 7 7" />
      <path d="M5 19l7-7 7 7" />
    </>
  ),
  4: (
    <>
      <path d="M5 8l7-6 7 6" />
      <path d="M5 14l7-6 7 6" />
      <path d="M5 20l7-6 7 6" />
    </>
  ),
  5: <path d="M12 2.5l2.9 6.2 6.6.8-4.9 4.6 1.3 6.6L12 17.4 6.1 20.7l1.3-6.6L2.5 9.5l6.6-.8z" />,
};

/** A member's rank: the icon and the name, e.g. "Flamebearer". The icon takes its colour from the text. */
export function RankBadge({ xp, size = 20, iconOnly = false }: { xp: number; size?: number; iconOnly?: boolean }) {
  const rank = rankFor(xp);
  const label = `${rank.name}, rank ${rank.level} of ${RANKS.length}`;
  return (
    <span className="rank-badge" title={label}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={size >= 24 ? 2.2 : 1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        role={iconOnly ? "img" : undefined}
        aria-label={iconOnly ? label : undefined}
        aria-hidden={iconOnly ? undefined : true}
      >
        {INSIGNIA[rank.level]}
      </svg>
      {!iconOnly && <span>{rank.name}</span>}
    </span>
  );
}

/** The rank with the XP total and a bar showing the way to the next rank. */
export function RankProgress({ xp }: { xp: number }) {
  const p = rankProgress(xp);
  return (
    <div className="rank-progress">
      <RankBadge xp={xp} size={28} />
      <div
        className="rank-bar"
        role="progressbar"
        aria-label="Progress to the next rank"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(p.fraction * 100)}
      >
        <div className="rank-bar-fill" style={{ width: `${Math.round(p.fraction * 100)}%` }} />
      </div>
      <p className="hint">
        {xp} XP{p.next ? `, ${p.toNext} more to ${p.next.name}` : ", the highest rank"}
      </p>
    </div>
  );
}
