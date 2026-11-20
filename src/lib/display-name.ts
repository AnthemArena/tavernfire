import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { NameError, nameKey, nextNameChange, validateName } from "@/lib/names";
import { isAvatarId, nextAvatarChange, type AvatarId } from "@/lib/avatars";

export type Profile = {
  displayName: string | null;
  nameKey: string | null;
  nameChangedAt: Date | null;
  /** The preset avatar the member chose, or null (the first letter of the name is shown). */
  avatar: AvatarId | null;
  avatarChangedAt: Date | null;
};

export const EMPTY_PROFILE: Profile = { displayName: null, nameKey: null, nameChangedAt: null, avatar: null, avatarChangedAt: null };

export async function loadProfile(uid: string): Promise<Profile> {
  const snap = await getDoc(doc(getDb(), "users", uid));
  const d = snap.data();
  if (!d) return EMPTY_PROFILE;
  return {
    displayName: typeof d.displayName === "string" ? d.displayName : null,
    nameKey: typeof d.nameKey === "string" ? d.nameKey : null,
    nameChangedAt: d.nameChangedAt?.toDate?.() ?? null,
    avatar: isAvatarId(d.avatar) ? d.avatar : null,
    avatarChangedAt: d.avatarChangedAt?.toDate?.() ?? null,
  };
}

/**
 * Claim a display name: reserve it (displayNames), point the profile at it,
 * then release the old one. Throws a NameError with a message to show.
 */
export async function claimName(uid: string, raw: string, current: Profile): Promise<Profile> {
  const name = validateName(raw);
  const key = nameKey(name);
  if (current.displayName === name) return current;

  const wait = nextNameChange(current.nameChangedAt, new Date());
  if (wait) {
    throw new NameError(
      `You can change your name again on ${wait.toLocaleDateString(undefined, { day: "numeric", month: "long" })}.`,
    );
  }

  const db = getDb();
  const lookup = doc(db, "displayNames", key);
  const existing = await getDoc(lookup);
  if (existing.exists() && existing.data().uid !== uid) {
    throw new NameError("That name is taken. Try another.");
  }
  if (!existing.exists()) {
    try {
      await setDoc(lookup, { uid, displayName: name, createdAt: serverTimestamp() });
    } catch {
      const again = await getDoc(lookup).catch(() => null);
      if (again?.exists() && again.data().uid !== uid) {
        throw new NameError("That name is taken. Try another.");
      }
      throw new NameError("Couldn't save that name. Check your connection and try again.");
    }
  }
  try {
    await updateDoc(doc(db, "users", uid), {
      displayName: name,
      nameKey: key,
      nameChangedAt: serverTimestamp(),
    });
  } catch {
    throw new NameError("Couldn't save that name. Try again.");
  }
  if (current.nameKey && current.nameKey !== key) {
    // Best effort: a leftover old claim only holds a name nobody is using.
    await deleteDoc(doc(db, "displayNames", current.nameKey)).catch(() => {});
  }
  return { ...current, displayName: name, nameKey: key, nameChangedAt: new Date() };
}

export class AvatarError extends Error {}

/** Save a preset avatar on the profile. A function then copies it onto the member's posts. */
export async function saveAvatar(uid: string, avatar: AvatarId, current: Profile): Promise<Profile> {
  if (current.avatar === avatar) return current;
  const wait = nextAvatarChange(current.avatarChangedAt, new Date());
  if (wait) {
    throw new AvatarError(
      `You can change your avatar again at ${wait.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}.`,
    );
  }
  try {
    await updateDoc(doc(getDb(), "users", uid), { avatar, avatarChangedAt: serverTimestamp() });
  } catch {
    throw new AvatarError("Couldn't save that avatar. Try again.");
  }
  return { ...current, avatar, avatarChangedAt: new Date() };
}
