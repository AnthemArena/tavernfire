// Preset avatars: portraits from art packs, files in public/avatars/<pack>-<n>.webp.
// A member's choice is a short id such as "demon-12", stored on their profile
// (`users/{uid}.avatar`) and copied onto their fires and answers (`requesterAvatar`,
// `authorAvatar`) so it can be shown without extra reads. The Cloud Function
// `propagateAvatar` keeps old posts in step when someone changes theirs.
//
// To add a pack: put its images in public/avatars named <pack>-1.webp, <pack>-2.webp…,
// add an entry to PACKS below, and add the pack name to the pattern in
// firestore.rules (validAvatar). A test checks the two agree.
// Uploaded pictures can come later as another kind of value in the same field.

export const PACKS = [
  { id: "demon", label: "Demons", count: 50 },
  { id: "undead", label: "Undead", count: 50 },
] as const;

export type PackId = (typeof PACKS)[number]["id"];
export type AvatarId = `${PackId}-${number}`;

export type AvatarOption = { id: AvatarId; pack: PackId; number: number; label: string };

export const AVATARS: AvatarOption[] = PACKS.flatMap((p) =>
  Array.from({ length: p.count }, (_, i) => ({
    id: `${p.id}-${i + 1}` as AvatarId,
    pack: p.id,
    number: i + 1,
    label: `${p.label.replace(/s$/, "")} portrait ${i + 1}`,
  })),
);

const BY_ID = new Map<string, AvatarOption>(AVATARS.map((a) => [a.id, a]));

/** An avatar can be changed once this many hours after the last change. Keep in step with firestore.rules. */
export const AVATAR_CHANGE_HOURS = 1;

export function isAvatarId(value: unknown): value is AvatarId {
  return typeof value === "string" && BY_ID.has(value);
}

export function avatarLabel(id: AvatarId): string {
  return BY_ID.get(id)?.label ?? id;
}

/** Where the picture lives. */
export function avatarSrc(id: AvatarId): string {
  return `/avatars/${id}.webp`;
}

/** When the avatar can next be changed, or null if it can be changed now. */
export function nextAvatarChange(changedAt: Date | null, now: Date): Date | null {
  if (!changedAt) return null;
  const next = new Date(changedAt.getTime() + AVATAR_CHANGE_HOURS * 3_600_000);
  return next.getTime() > now.getTime() ? next : null;
}

/** "at 3:15 pm" for a time later today, "on 26 November" for another day. */
export function describeWhen(when: Date, now: Date): string {
  const sameDay = when.toDateString() === now.toDateString();
  return sameDay
    ? `at ${when.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true })}`
    : `on ${when.toLocaleDateString("en-GB", { day: "numeric", month: "long" })}`;
}
