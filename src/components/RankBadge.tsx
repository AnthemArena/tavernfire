import { rankFor, rankProgress } from "@/lib/xp";

/** A member's rank: the icon and the name, e.g. "Flamebearer". */
export function RankBadge({ xp, size = 20 }: { xp: number; size?: number }) {
  const rank = rankFor(xp);
  return (
    <span className="rank-badge">
      {/* eslint-disable-next-line @next/next/no-img-element -- small fixed file */}
      <img src={`/ranks/${rank.icon}.webp`} width={size} height={size} alt="" loading="lazy" decoding="async" />
      <span>{rank.name}</span>
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
        {xp} XP
        {p.next ? ` · ${p.toNext} to ${p.next.name}` : " · the highest rank"}
      </p>
    </div>
  );
}
