// Display names: the one public name a person picks, needed only when they
// post a request. Rules in firestore.rules repeat the same checks (a unit test
// compares the reserved list), so keep both in step.

export const NAME_MIN = 3;
export const NAME_MAX = 20;
/** A name can be changed once this many days have passed since the last change. */
export const NAME_CHANGE_DAYS = 7;

/** Letters and digits first; then letters, digits, spaces, _ . ' and -. */
export const NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 _.'-]*$/;

/** Names (compared by their key) nobody may take. */
export const RESERVED_NAMES = [
  "admin",
  "administrator",
  "moderator",
  "mod",
  "staff",
  "support",
  "system",
  "official",
  "anonymous",
  "adventurer",
  "you",
  "everyone",
];
/** Words that may not appear anywhere in a name's key. */
export const RESERVED_FRAGMENTS = ["tavernfire", "moderator", "admin"];

export class NameError extends Error {}

/** Collapse runs of spaces and trim. The stored name is shown exactly like this. */
export function tidyName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

/** Lower-case, with spaces and punctuation removed: "Dun Gan_01" and "dungan01" collide. */
export function nameKey(name: string): string {
  return tidyName(name).toLowerCase().replace(/[ _.'-]/g, "");
}

/** Returns the tidy name, or throws a NameError with a message for the person. */
export function validateName(raw: string): string {
  const name = tidyName(raw);
  if (name.length < NAME_MIN) throw new NameError(`Use at least ${NAME_MIN} characters.`);
  if (name.length > NAME_MAX) throw new NameError(`Use ${NAME_MAX} characters or fewer.`);
  if (!NAME_PATTERN.test(name)) {
    throw new NameError("Use letters, numbers, spaces, and . _ ' - only, starting with a letter or number.");
  }
  const key = nameKey(name);
  if (key.length < NAME_MIN) throw new NameError("Add a few more letters or numbers.");
  if (RESERVED_NAMES.includes(key) || RESERVED_FRAGMENTS.some((w) => key.includes(w))) {
    throw new NameError("That name is reserved. Pick another.");
  }
  return name;
}

/** When someone may next change their name, or null if they can now. */
export function nextNameChange(changedAt: Date | null, now: Date): Date | null {
  if (!changedAt) return null;
  const next = new Date(changedAt.getTime() + NAME_CHANGE_DAYS * 24 * 60 * 60 * 1000);
  return next > now ? next : null;
}
