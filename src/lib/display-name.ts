import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { NameError, nameKey, nextNameChange, validateName } from "@/lib/names";

export type Profile = {
  displayName: string | null;
  nameKey: string | null;
  nameChangedAt: Date | null;
};

export const EMPTY_PROFILE: Profile = { displayName: null, nameKey: null, nameChangedAt: null };

export async function loadProfile(uid: string): Promise<Profile> {
  const snap = await getDoc(doc(getDb(), "users", uid));
  const d = snap.data();
  if (!d) return EMPTY_PROFILE;
  return {
    displayName: typeof d.displayName === "string" ? d.displayName : null,
    nameKey: typeof d.nameKey === "string" ? d.nameKey : null,
    nameChangedAt: d.nameChangedAt?.toDate?.() ?? null,
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
  return { displayName: name, nameKey: key, nameChangedAt: new Date() };
}
