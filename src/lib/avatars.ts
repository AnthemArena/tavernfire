// Preset avatars: a small set of illustrations a member can pick. The choice is a
// short id stored on their profile (`users/{uid}.avatar`) and copied onto their fires
// and answers (`requesterAvatar`, `authorAvatar`) so it can be shown without extra reads.
// The Cloud Function `syncAvatar` keeps old posts in step when someone changes theirs.
//
// The same ids are listed in firestore.rules (validAvatar); a test keeps the two in step.
// Uploaded pictures can come later as another kind of value in the same field.

export const AVATARS = [
  { id: "ember", label: "Ember" },
  { id: "d20", label: "Twenty-sided die" },
  { id: "lantern", label: "Lantern" },
  { id: "mug", label: "Tavern mug" },
  { id: "crown", label: "Crown" },
  { id: "skull", label: "Skull" },
  { id: "potion", label: "Potion" },
  { id: "sword", label: "Sword" },
  { id: "key", label: "Key" },
  { id: "moon", label: "Moon" },
] as const;

export type AvatarId = (typeof AVATARS)[number]["id"];

/** An avatar can be changed once this many hours after the last change. Keep in step with firestore.rules. */
export const AVATAR_CHANGE_HOURS = 1;

export function isAvatarId(value: unknown): value is AvatarId {
  return typeof value === "string" && AVATARS.some((a) => a.id === value);
}

export function avatarLabel(id: AvatarId): string {
  return AVATARS.find((a) => a.id === id)?.label ?? id;
}

/** When the avatar can next be changed, or null if it can be changed now. */
export function nextAvatarChange(changedAt: Date | null, now: Date): Date | null {
  if (!changedAt) return null;
  const next = new Date(changedAt.getTime() + AVATAR_CHANGE_HOURS * 3_600_000);
  return next.getTime() > now.getTime() ? next : null;
}
