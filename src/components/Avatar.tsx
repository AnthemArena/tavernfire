import { isAvatarId, avatarLabel, avatarSrc } from "@/lib/avatars";

const PIXELS = { sm: 24, md: 36, lg: 96 } as const;

export type AvatarSize = keyof typeof PIXELS;

/**
 * A member's avatar: their chosen portrait in a circle, or the first letter of their
 * name when they have not chosen one (or the id is not one we know).
 */
export default function Avatar({
  id,
  name,
  size = "md",
  eager = false,
}: {
  id: string | null | undefined;
  name: string;
  size?: AvatarSize;
  /** Load straight away (for the large picture at the top of a page) instead of lazily. */
  eager?: boolean;
}) {
  const px = PIXELS[size];
  if (isAvatarId(id)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- small fixed files, already sized
      <img
        className={`avatar avatar-img avatar-${size}`}
        src={avatarSrc(id)}
        width={px}
        height={px}
        alt={`${name}: ${avatarLabel(id)}`}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
      />
    );
  }
  return (
    <svg className={`avatar avatar-${size}`} width={px} height={px} viewBox="0 0 96 96" role="img" aria-label={name}>
      <circle cx="48" cy="48" r="45" fill="var(--chip)" stroke="var(--accent)" strokeWidth="3" />
      <text x="48" y="48" textAnchor="middle" dominantBaseline="central" fontSize="44" fontWeight="700" fill="var(--accent)">
        {name.trim().charAt(0).toUpperCase() || "?"}
      </text>
    </svg>
  );
}
