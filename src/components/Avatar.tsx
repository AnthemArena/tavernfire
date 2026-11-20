import { isAvatarId, avatarLabel, type AvatarId } from "@/lib/avatars";

/** The picture drawn inside the circle, on a 96 by 96 grid. Original artwork, one colour. */
const ART: Record<AvatarId, React.ReactNode> = {
  ember: (
    <>
      <path d="M48 22c3 9 12 14 12 26a12 12 0 0 1-24 0c0-6 3-9 6-13 1 5 4 7 6 7-1-7-1-14 0-20z" />
      <path d="M48 50c2 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-5 3-7 1 2 2 3 3 3z" fill="var(--parchment)" />
    </>
  ),
  d20: (
    <>
      <polygon points="48,18 72,32 72,62 48,76 24,62 24,32" fill="none" stroke="currentColor" strokeWidth="5" strokeLinejoin="round" />
      <polygon points="48,30 63,56 33,56" fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" />
    </>
  ),
  lantern: (
    <>
      <path d="M42 28v-7h12v7" fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" />
      <rect x="32" y="28" width="32" height="42" rx="7" />
      <path d="M48 36c2 5 7 7 7 13a7 7 0 0 1-14 0c0-3 2-5 3-7 1 2 2 3 4 3z" fill="var(--parchment)" />
      <rect x="36" y="72" width="24" height="5" rx="2.5" />
    </>
  ),
  mug: (
    <>
      <path d="M28 38a9 9 0 0 1 10-8 10 10 0 0 1 20 0 9 9 0 0 1 10 8z" />
      <rect x="28" y="40" width="40" height="34" rx="6" />
      <path d="M68 48h4a8 8 0 0 1 0 16h-4" fill="none" stroke="currentColor" strokeWidth="5" />
    </>
  ),
  crown: (
    <>
      <path d="M24 66V34l16 14 8-18 8 18 16-14v32z" />
      <rect x="24" y="68" width="48" height="8" rx="3" />
    </>
  ),
  skull: (
    <>
      <path d="M48 20c-15 0-24 10-24 22 0 8 4 13 9 16v10h10v-6h10v6h10V58c5-3 9-8 9-16 0-12-9-22-24-22z" />
      <circle cx="38" cy="44" r="6" fill="var(--parchment)" />
      <circle cx="58" cy="44" r="6" fill="var(--parchment)" />
      <path d="M48 52l-4 8h8z" fill="var(--parchment)" />
    </>
  ),
  potion: (
    <>
      <rect x="42" y="16" width="12" height="7" rx="2" />
      <path d="M43 25h10v13l15 28a7 7 0 0 1-6 11H34a7 7 0 0 1-6-11l15-28z" />
      <path d="M36 62h24l5 9a3 3 0 0 1-3 4H34a3 3 0 0 1-3-4z" fill="var(--parchment)" />
    </>
  ),
  sword: (
    <>
      <path d="M48 12l6 10v34H42V22z" />
      <rect x="32" y="56" width="32" height="6" rx="3" />
      <rect x="44" y="62" width="8" height="14" rx="2" />
      <circle cx="48" cy="80" r="4" />
    </>
  ),
  key: (
    <>
      <circle cx="48" cy="32" r="14" fill="none" stroke="currentColor" strokeWidth="7" />
      <rect x="44.5" y="44" width="7" height="34" rx="2" />
      <rect x="51" y="62" width="12" height="6" rx="2" />
      <rect x="51" y="72" width="9" height="6" rx="2" />
    </>
  ),
  moon: <path d="M58 20a30 30 0 1 0 18 44 26 26 0 0 1-18-44z" />,
};

const PIXELS = { sm: 24, md: 36, lg: 96 } as const;

export type AvatarSize = keyof typeof PIXELS;

/**
 * A member's avatar: their chosen illustration in a circle, or the first letter of their
 * name when they have not chosen one (or the id is not one we know).
 */
export default function Avatar({
  id,
  name,
  size = "md",
}: {
  id: string | null | undefined;
  name: string;
  size?: AvatarSize;
}) {
  const px = PIXELS[size];
  const known = isAvatarId(id) ? id : null;
  return (
    <svg
      className={`avatar avatar-${size}`}
      width={px}
      height={px}
      viewBox="0 0 96 96"
      role="img"
      aria-label={known ? `${name}: ${avatarLabel(known)}` : name}
    >
      <circle cx="48" cy="48" r="45" fill="var(--chip)" stroke="var(--accent)" strokeWidth="3" />
      {known ? (
        <g fill="var(--accent)" color="var(--accent)">
          {ART[known]}
        </g>
      ) : (
        <text x="48" y="48" textAnchor="middle" dominantBaseline="central" fontSize="44" fontWeight="700" fill="var(--accent)">
          {name.trim().charAt(0).toUpperCase() || "?"}
        </text>
      )}
    </svg>
  );
}
