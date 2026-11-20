// The short "about me" on a profile (users/{uid}.bio). Shown on the profile page and at
// the top of the member's fires. The limits are also in firestore.rules (a test keeps them in step).

export const BIO_MAX = 280;

export class BioError extends Error {}

/** Matches what firestore.rules refuses: web addresses. Bios are plain text. */
export const BIO_LINK = /(https?:|www\.)/i;

/** Collapse runs of spaces and blank lines, and trim. An empty bio clears it. */
export function tidyBio(raw: string): string {
  return raw
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

/** The bio to save, or a BioError with a message to show. */
export function validateBio(raw: string): string {
  const bio = tidyBio(raw);
  if (bio.length > BIO_MAX) throw new BioError(`Keep it to ${BIO_MAX} characters or fewer.`);
  if (BIO_LINK.test(bio)) throw new BioError("Links aren't allowed in a bio.");
  return bio;
}
