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
    throw new Error("Choose three sparks.");
  }

  const sparks = input.map((s) => s.trim());
  const norm = sparks.map(normaliseSpark);

  for (let i = 0; i < norm.length; i++) {
    if (norm[i] === "") {
      throw new Error("Each spark needs a word.");
    }
    if (norm[i].includes(" ")) {
      throw new Error("A spark is a single word. Use a hyphen for joined words.");
    }
    if (sparks[i].length > SPARK_MAX_LENGTH) {
      throw new Error(`Sparks can be up to ${SPARK_MAX_LENGTH} characters long.`);
    }
  }

  if (new Set(norm).size !== SPARK_COUNT) {
    throw new Error("Use three different sparks.");
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
