// Keeps a member's avatar on their fires and answers in step with their profile.
// Names are fixed on a post when it is written; avatars are not: when someone picks a
// new one, every post of theirs shows it. The app only ever changes `users/{uid}.avatar`
// (the rules limit how often); this function copies it across.
//
// Safe to run twice: it writes the same value again. Posts already showing the right
// avatar are skipped. Each post gets the field `requesterAvatar` (fires) or
// `authorAvatar` (answers), or null if the member has none.

import type { Firestore } from "firebase-admin/firestore";

const BATCH_SIZE = 400; // Firestore allows 500 writes per batch

/** The avatar id on a profile document's data, or null. */
export function avatarOf(data: Record<string, unknown> | undefined): string | null {
  const a = data?.avatar;
  return typeof a === "string" ? a : null;
}

/** Split a list into chunks of at most `size`. */
export function chunk<T>(items: T[], size = BATCH_SIZE): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

type Target = { collection: "requests" | "entries"; ownerField: "requesterId" | "authorId"; field: "requesterAvatar" | "authorAvatar" };

const TARGETS: Target[] = [
  { collection: "requests", ownerField: "requesterId", field: "requesterAvatar" },
  { collection: "entries", ownerField: "authorId", field: "authorAvatar" },
];

/** Copy the member's current avatar onto all their fires and answers. Returns how many posts changed. */
export async function syncAvatar(db: Firestore, uid: string, avatar: string | null): Promise<number> {
  let changed = 0;
  for (const t of TARGETS) {
    const snap = await db.collection(t.collection).where(t.ownerField, "==", uid).get();
    const stale = snap.docs.filter((d) => (d.get(t.field) ?? null) !== avatar);
    for (const group of chunk(stale)) {
      const batch = db.batch();
      for (const d of group) batch.update(d.ref, { [t.field]: avatar });
      await batch.commit();
      changed += group.length;
    }
  }
  return changed;
}
