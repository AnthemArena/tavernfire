import {
  collection,
  documentId,
  endAt,
  getDocs,
  limit,
  orderBy,
  startAt,
  query,
  type Firestore,
} from "firebase/firestore";
import { normaliseSpark } from "./sparks.ts";

export type SparkSuggestion = {
  /** The normalised word, which is also what gets stored on a fire. */
  word: string;
  /** How many fires use it. */
  count: number;
};

const SHOW = 5;

/** "statue" becomes "Statue", to match how sparks are shown elsewhere. */
export function displayWord(word: string): string {
  return word.charAt(0).toLocaleUpperCase("en") + word.slice(1);
}

/** "1 fire", "14 fires". */
export function fireCount(count: number): string {
  return `${count} ${count === 1 ? "fire" : "fires"}`;
}

/** Most-used first, then alphabetical; drops words already chosen and anything malformed. */
export function rankSuggestions(
  found: { word: unknown; count: unknown }[],
  alreadyChosen: string[],
  max = SHOW,
): SparkSuggestion[] {
  const skip = new Set(alreadyChosen.map(normaliseSpark).filter((w) => w !== ""));
  return found
    .filter(
      (s): s is SparkSuggestion =>
        typeof s.word === "string" && typeof s.count === "number" && s.count > 0 && !skip.has(s.word),
    )
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word, "en"))
    .slice(0, max);
}

/**
 * Sparks already in use that start with what has been typed (the most used ones
 * when nothing is typed yet). Reads the small `sparks` list, never the fires.
 */
export async function findSparks(
  db: Firestore,
  typed: string,
  alreadyChosen: string[],
): Promise<SparkSuggestion[]> {
  const prefix = normaliseSpark(typed);
  const q =
    prefix === ""
      ? query(collection(db, "sparks"), orderBy("count", "desc"), limit(SHOW + 3))
      : query(
          collection(db, "sparks"),
          orderBy(documentId()),
          // Firestore has no "starts with", so ask for the range from the prefix to just past it.
          startAt(prefix),
          endAt(prefix + "\uf8ff"),
          limit(20),
        );
  const snap = await getDocs(q);
  return rankSuggestions(
    snap.docs.map((d) => ({ word: d.get("word"), count: d.get("count") })),
    alreadyChosen,
  );
}
