// Pure ranking for the voting reveal. No Firebase here, so the same code can
// run in the app and in the Cloud Function that tallies ballots later.
//
// Rules (voting plan v3 + round 23):
// - Each ballot holds up to MAX_PICKS distinct entries.
// - Fewer than MIN_BALLOTS_FOR_RANKS ballots in total: show the picks that
//   exist, but keep the random order and give no rank labels.
// - From MIN_BALLOTS_FOR_RANKS ballots: order by picks, highest first. Entries
//   with the same picks share a rank (1, 1, 3) and sit in a stable
//   pseudo-random order (seeded by the request id, so it never reshuffles).
// - "Community favourite": the top entry, only with at least
//   FAVOURITE_MIN_PICKS picks and strictly more than the runner-up.

export const MAX_PICKS = 3;
export const MIN_BALLOTS_FOR_RANKS = 3;
export const FAVOURITE_MIN_PICKS = 3;

export type RankedEntry = {
  entryId: string;
  picks: number;
  /** 1-based rank with ties sharing a rank, or null when ranks are not shown. */
  rank: number | null;
  favourite: boolean;
};

/** Small stable string hash (FNV-1a) used for the pseudo-random order. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Stable pseudo-random order of entry ids for one request. */
export function stableOrder(requestId: string, entryIds: string[]): string[] {
  return [...entryIds].sort((a, b) => {
    const d = hash(`${requestId}:${a}`) - hash(`${requestId}:${b}`);
    return d !== 0 ? d : a < b ? -1 : 1;
  });
}

/** Keep a ballot's valid picks: known entries, no repeats, at most MAX_PICKS. */
export function cleanBallot(picks: string[], entryIds: Set<string>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of picks) {
    if (entryIds.has(id) && !seen.has(id)) {
      seen.add(id);
      out.push(id);
      if (out.length === MAX_PICKS) break;
    }
  }
  return out;
}

export function rankEntries(
  requestId: string,
  entryIds: string[],
  ballots: string[][],
): RankedEntry[] {
  const known = new Set(entryIds);
  const counts = new Map<string, number>(entryIds.map((id) => [id, 0]));
  let cast = 0;
  for (const ballot of ballots) {
    const picks = cleanBallot(ballot, known);
    if (picks.length === 0) continue;
    cast++;
    for (const id of picks) counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  const ordered = stableOrder(requestId, entryIds);
  if (cast < MIN_BALLOTS_FOR_RANKS) {
    return ordered.map((entryId) => ({
      entryId,
      picks: counts.get(entryId) ?? 0,
      rank: null,
      favourite: false,
    }));
  }

  // Array.sort is stable, so ties keep the pseudo-random order above.
  ordered.sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0));
  const result: RankedEntry[] = [];
  ordered.forEach((entryId, i) => {
    const picks = counts.get(entryId) ?? 0;
    const prev = result[i - 1];
    result.push({
      entryId,
      picks,
      rank: prev && prev.picks === picks ? (prev.rank as number) : i + 1,
      favourite: false,
    });
  });
  const [first, second] = result;
  if (first && first.picks >= FAVOURITE_MIN_PICKS && (!second || first.picks > second.picks)) {
    first.favourite = true;
  }
  return result;
}
