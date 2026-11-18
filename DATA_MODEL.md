# Tavernfire: Firestore data model (draft)

Stack assumed: Next.js + TypeScript, Firebase Auth, Firestore, Cloud Functions (scheduled and callable).

## Principles

1. **Anything hidden during voting is never on a client-readable document.** That means author IDs and vote counts. Security rules alone are easy to get wrong, so the data physically lives elsewhere until the reveal.
2. **Clients never write votes, counts or lifecycle state.** Cloud Functions do.
3. **Sparks and traits are normalised once, on write, by a function**, so search works on clean keys.
4. **Denormalise for reads.** Firestore bills per read, so entries carry the spark keys they need.

## Normalisation

`normalise(word)`: lowercase, trim, collapse internal whitespace, strip punctuation. Later: light singularisation and a synonym or "is-a" table (vampire is a kind of undead).

For a request with sparks A, B, C:

- `sparksNorm`: the three normalised words, sorted alphabetically
- `sparkKey`: `a|b|c` (sorted, joined), for exact-triple lookup
- `pairKeys`: `a|b`, `a|c`, `b|c` (each sorted), for two-of-three lookup

Require three distinct sparks. (Open decision: allow fewer than three?)

## Collections

### `users/{uid}` (public profile)
- `displayName`, `avatarUrl`, `createdAt`
- `bio` (optional)
- Custom claim `role`: `member` | `moderator` (set via Admin SDK, not stored here)
- Private settings in `users/{uid}/private/settings`: email preferences, etc. Owner-only.

### `requests/{requestId}`
- `sparks`: the three words as typed, for display
- `sparksNorm`, `sparkKey`, `pairKeys`: see above
- `kind`: `npc` | `location` (extend later)
- `note`: optional context from the requester
- `requesterId`: public (the requester is not anonymous)
- `status`: `open` | `voting` | `revealed` | `closed`
- `submissionsCloseAt`, `votingClosesAt`, `createdAt`
- *Current build:* requests are written directly by the signed-in client under strict security rules, and only `createdAt` (server time) is stored. The deadlines are derived in the app as `createdAt` plus 3 days until the lifecycle Cloud Function exists, at which point it stores them and moves requests through `open`, `voting` and `revealed`. Request creation is also due to move into a `createRequest` function (which needs the Blaze plan).
- `answerCount`: updated by function
- `moderation`: `ok` | `hidden`

Lifecycle: `open` (about 3 days) to `voting` to `revealed`. Entries stay in the library after reveal.

### `entries/{entryId}` (top-level, so the whole library is queryable)
- `requestId`, `kind`
- `name`, `concept`, `hook` ("How a GM could use it")
- `traits`: up to 5, as typed
- `traitsNorm`: normalised, for search
- Type-specific fields. NPC: `appearance`, `motivation`. Location: `mood`, `secrets`, `exits`. Keep these optional and small.
- Denormalised from the request: `sparksNorm`, `sparkKey`, `pairKeys`
- `requestStatus`: mirrored from the request by function, so clients can tell whether an entry is in the voting phase
- `moderation`: `ok` | `hidden` | `removed`
- `createdAt`
- **Not here during voting:** `authorId`, `voteCount`
- **Added at reveal by function:** `authorId`, `authorName`, `voteCount`, `rank`
- `usedCount`: self-reported uses, updated by function

> **Current build (answers, Slice A):** entries are written straight from the app, with no Cloud Function, as two writes in order that security rules check against what already exists. (A first design used one batch with `getAfter`/`existsAfter`; the Firestore emulator refused it with evaluation errors, so it was replaced.) 1) `answerLocks/{requestId}_{uid}` holds `{authorId, requestId, entryId, createdAt}`. It is create-only, so a second answer by the same person is refused, and it doubles as the hidden author record until the reveal (it takes the place of `entryAuthors` for now). Only its owner and moderators can read it. 2) `entries/{entryId}` is accepted only if the person's marker names that entry id. The rules look up the request, so an entry must match its kind and sparks, the requester cannot answer their own request, and answers must arrive inside the 3-day window. Entries have random ids and never hold an author. If step 2 fails after step 1, the page shows "Your last answer didn't finish saving" and resends it with the same entry id. `requests.answerCount` is not maintained yet (it needs a Cloud Function), so the board counts entries with an aggregate query instead. `traitsNorm` is normalised by the app and only length-checked by the rules. Voting, the reveal, `usedCount` and "I used this" still need Cloud Functions.

### `entryAuthors/{entryId}` (server-only)
- `authorId`, `requestId`
- No client read or write access. Read by functions for the reveal, for rate limits, and for moderation.

### `requests/{requestId}/votes/{uid}` (server-only)
- `entryId`, `createdAt`
- Document ID is the voter's uid, so one vote per user per request is enforced by structure.
- Written only by the `castVote` function. No client access.

### `entries/{entryId}/uses/{uid}`
- Created by the `markUsed` function: one "I used this" per user per entry. `usedCount` is updated by function (use a sharded counter if it ever gets busy).

### `collections/{collectionId}` (user collections, for example per campaign)
- `ownerId`, `name`, `description`, `visibility`: `private` | `shared`, `createdAt`
- Subcollection `items/{entryId}`: `addedAt`, `note`
- Owner reads and writes; shared collections are readable by link.

### `reports/{reportId}`
- *Current build:* written by the app with id `entryId_reporterUid` (one report per person per entry); readable by the reporter and moderators.
- `entryId`, `reporterId`, `reason`: `ai_generated` | `plagiarism` | `spam` | `abuse` | `other`, `details`, `status`: `open` | `dismissed` | `actioned`, `createdAt`, `handledBy`
- Create via function (rate limited). Readable by moderators only. Reporter identity is never exposed to authors.

### `sparks/{sparkNorm}` and `traits/{traitNorm}`
- `display`, `count`, `lastUsedAt`
- Maintained by function on entry and request creation. Used for "Browse sparks" and autocomplete suggestions (which prevent Ancient / Old / Aged drift).

## Queries the library needs

| Need | Query |
| --- | --- |
| Exact three-spark match | `entries where sparkKey == k` |
| Two of three | `entries where pairKeys array-contains-any [p1, p2, p3]` |
| One spark | `entries where sparksNorm array-contains s` |
| By trait | `entries where traitsNorm array-contains t` |
| Entries for a request | `entries where requestId == id` |
| A user's collection | `collections/{id}/items`, then fetch entries by ID |

Firestore allows only one `array-contains` or `array-contains-any` per query, so combined spark and trait searches mean running separate queries and merging client-side. If that gets clumsy, add Typesense or Algolia, synced from Firestore by a function.

Search ranking: exact triple, then two-of-three, then one spark; sparks outrank traits.

## Cloud Functions

| Function | Type | What it does |
| --- | --- | --- |
| `createRequest` | callable | Validates, normalises sparks, computes keys, sets deadlines |
| `submitEntry` | callable | Validates template, normalises traits, writes entry and `entryAuthors`, enforces limits (for example one entry per user per request, no answering your own request: open decision) |
| `castVote` | callable | One vote per user per request, no self-vote, minimum account age or verified email |
| `advanceLifecycle` | scheduled (every 15 min) | Moves requests open to voting to revealed when deadlines pass |
| `revealRequest` | internal | Tallies votes, writes `authorId`, `authorName`, `voteCount`, `rank` onto entries, updates `requestStatus` |
| `reportEntry` | callable | Rate-limited report creation |
| `markUsed` | callable | "I used this", one per user per entry |
| `onEntryWrite` | trigger | Maintains `sparks` and `traits` counts, request `answerCount` |
| `moderate` | callable (moderators) | Hide, restore, remove; handle reports |

## Security rules (summary)

- `requests`: public read; no client write
- `entries`: public read where `moderation == 'ok'`; no client write
- `entryAuthors`, `votes`: no client access
- `reports`: no client read or write (moderators via function)
- `collections`: owner read and write; shared collections public read
- `users`: public read of profile; owner write of profile fields only
- `sparks`, `traits`: public read; no client write

## Abuse and integrity

- Email-verified accounts only for voting and answering; minimum account age for voting
- Rate limits per account on requests, entries, reports
- Cloudflare Turnstile (or similar) on sign-up and posting
- Reports go to moderator review and never penalise an author automatically; authors can appeal

## Open decisions

- Allow fewer than three sparks per request?
- ~~Can a requester answer their own request? Can a user submit more than one entry per request?~~ Decided: no, and no (one entry each). Entries are readable while a request is open, with authors hidden.
- Minimum number of entries or votes before a request reveals?
- Is gender, age and species a spark or a separate optional filter?
- Which type-specific template fields launch with NPC and location?
- Do hidden or removed entries keep their spark counts?
- Synonym and "is-a" handling (vampire inside undead): when to add it
- Licensing terms stored per entry (for example `license: 'personal-use'`)
