// Spark normalisation and the precomputed search keys described in DATA_MODEL.md.
//
// A spark is a single word that starts an idea. A request has exactly three
// distinct sparks. From them we derive keys so the library can be searched with
// plain Firestore queries:
//   sparksNorm  the three normalised words, sorted
//   sparkKey    "a|b|c" for exact-triple lookup
//   pairKeys    "a|b", "a|c", "b|c" for two-of-three lookup

export const SPARK_COUNT = 3;
export const SPARK_MAX_LENGTH = 30;

export type SparkFields = {
  /** The words as the author typed them (trimmed), for display. */
  sparks: string[];
  sparksNorm: string[];
  sparkKey: string;
  pairKeys: string[];
};

/**
 * A problem with the sparks, with enough detail to point at the box that is
 * wrong. `message` is safe to show to the person typing.
 */
export class SparkError extends Error {
  /** Which spark box (0 to 2) is the problem, or null if it is about all three. */
  readonly index: number | null;
  /** A corrected word the person can accept in one tap, if there is an obvious one. */
  readonly fix: string | null;

  constructor(message: string, index: number | null = null, fix: string | null = null) {
    super(message);
    this.name = "SparkError";
    this.index = index;
    this.fix = fix;
  }
}

/** Lowercase, tidy and strip punctuation. Returns "" if nothing usable is left. */
export function normaliseSpark(raw: string): string {
  return raw
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/[^\p{L}\p{N}\s'-]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[-']+|[-']+$/g, "");
}

/**
 * Check three sparks and build the fields stored on a request.
 * Throws an Error with a message that is safe to show to the person typing.
 */
export function buildSparkFields(input: string[]): SparkFields {
  if (input.length !== SPARK_COUNT) {
    throw new SparkError("Choose three sparks.");
  }

  const sparks = input.map((s) => s.trim());
  const norm = sparks.map(normaliseSpark);

  for (let i = 0; i < norm.length; i++) {
    if (norm[i] === "") {
      throw new SparkError("Each spark needs a word.", i);
    }
    if (norm[i].includes(" ")) {
      const joined = sparks[i].split(/\s+/).join("-");
      throw new SparkError(
        `"${sparks[i]}" is more than one word. A spark is a single word; use a hyphen for joined words.`,
        i,
        joined.length <= SPARK_MAX_LENGTH ? joined : null,
      );
    }
    if (sparks[i].length > SPARK_MAX_LENGTH) {
      throw new SparkError(
        `"${sparks[i]}" is too long. Sparks can be up to ${SPARK_MAX_LENGTH} characters.`,
        i,
      );
    }
  }

  const seen = new Set<string>();
  for (let i = 0; i < norm.length; i++) {
    if (seen.has(norm[i])) {
      throw new SparkError(`"${sparks[i]}" is already one of your sparks. Use three different words.`, i);
    }
    seen.add(norm[i]);
  }

  const sparksNorm = [...norm].sort();
  const [a, b, c] = sparksNorm;

  return {
    sparks,
    sparksNorm,
    sparkKey: `${a}|${b}|${c}`,
    pairKeys: [`${a}|${b}`, `${a}|${c}`, `${b}|${c}`],
  };
}
