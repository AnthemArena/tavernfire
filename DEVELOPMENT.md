# Local development

## Prerequisites

- **Node.js** (current LTS) and **Git**
- **Java 21 or newer.** The Firestore emulator is a Java program, so it will not start without it. Check with `java -version`; if it is missing, install Temurin 21 (adoptium.net) and restart VS Code afterwards.

## First-time setup

1. Install dependencies:

   ```
   npm install
   ```

2. Create your local environment file. Copy `.env.example` to `.env.local` and paste in the values from your Firebase web app config (Firebase console, Project settings, Your apps). `.env.local` is ignored by Git.

   ```
   copy .env.example .env.local      (Windows, Command Prompt)
   cp .env.example .env.local        (macOS, Linux, Git Bash)
   ```

3. Leave `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true` while developing. The app then talks to local emulators and cannot touch your real database.

## Running it

Use two terminals.

Terminal 1, the Firebase emulators (Auth, Firestore and a local UI at http://127.0.0.1:4000):

```
npm run emulators
```

The first run asks to download the emulator files and may ask you to log in. If it asks to log in, run `npx firebase login` once.

Terminal 2, the website (http://localhost:3000):

```
npm run dev
```

## Checks

```
npm run typecheck
npm run lint
npm test            (unit tests for spark keys and request helpers)
npm run test:rules  (Firestore security rules tests; starts the emulator itself, needs Java)
npm run build
```

`npm run test:rules` starts and stops its own emulator, so stop `npm run emulators` first if the ports are in use.

## Trying the first slice by hand

With the emulators and `npm run dev` running:

1. Open http://localhost:3000 and click **Sign in**. Create an account with an email and password (any fake email works against the emulator), or use Continue with Google, which shows a fake account picker.
2. Back on the home page, enter three different sparks, pick NPC or Location, and click **Post request**. You land on the request page.
3. Go back to the board. Your request is listed, with its three sparks, type, poster and time left.
4. Open http://127.0.0.1:4000 (Emulator UI) to see the `users` and `requests` documents. Check that `sparkKey` and `pairKeys` match your sparks, sorted.
5. Try breaking it: post with a repeated spark or an empty one and confirm you get a friendly message instead of a request.

## Security reminders

- The Firebase web config values are not secrets, but keep them in `.env.local` anyway.
- Never commit a service account key (a JSON file with a private key). The `.gitignore` blocks the common names, but check before you commit.
- `firestore.rules` is deny-by-default. Rules for each collection are added with the feature that needs them, following `DATA_MODEL.md`.
- Deploying rules to the real project is a separate step (`npx firebase deploy --only firestore:rules`) and is not part of local development.

## Adding a request category

1. Add an entry to `CATEGORIES` in `src/lib/categories.ts` (stable `id`, labels, a one-line `description`, `group`, answer wording) with `launched: false`.
2. **Publish the rules first.** Set `launched: true`, add its id to the `d.kind in [...]` list in `firestore.rules`, run `npm test` (a test fails if the two lists differ) and `npm run test:rules`, then publish the rules.
3. **Then release the app.** If the app ships first, people can pick the category and every post is refused.

Policy: ids never change, and a launched category is never removed (the app skips requests whose type it does not know, so removing one would make them vanish). Renaming changes only the label. Every category uses the same answer shape (name, description, optional tags); only the wording differs. The post form shows a radio list up to four categories and a grouped drop-down from five (`COMPACT_PICKER_FROM`).

## Open fires (current design, from 2026-11-20)

Ordinary fires never close. Anyone signed in can answer at any time; answers carry the
author's id and chosen name from the start (`authorId`, `authorName` on `entries`, checked
by the rules against the person's profile); there is no reveal. Upvotes and Stoke are next
(see the project plan). The sections below describe the earlier blind-voting design: that
code (lifecycle function, ballots, ranking, results screens) is kept for duels but is not
used by ordinary fires.

- The lifecycle function is **paused**: it logs "Lifecycle paused" and does nothing unless
  `LIFECYCLE_ENABLED=true` is set in its environment. Redeploy it with
  `firebase deploy --only "firestore,functions"` before or together with the rules.
- `NEXT_PUBLIC_ENABLE_VOTING` no longer exists; the pick buttons were removed from the app.
- **Upvotes on answers:** one document per person per answer at `upvotes/{entryId}_{uid}`
  (verified email, not your own answer, no cap on how many you give). The function
  `countUpvotes` (Firestore trigger, europe-west2) recounts and stores `upvoteCount` on the
  entry; the app only adds the person's own change while that catches up. The first deploy of
  a Firestore-triggered function can fail once while Google finishes setting up Eventarc
  permissions; wait a few minutes and run the deploy again.
- **Stoke and the Fires tabs:** a vote on the fire itself at `stokes/{requestId}_{uid}` (same
  rules as upvotes; you cannot stoke your own fire). `countStokes` stores `stokeCount` on the
  request. Trending uses one stored number, `trendRank` (= ln(score) + time/tau, half-life 3
  days, stoke weight 2, upvote weight 1), written by the same functions; see
  `functions/src/trending.ts`. The board's Trending, Top and New tabs each run one query and
  need the two new indexes in `firestore.indexes.json` (they take a few minutes to build after
  `firebase deploy --only "firestore,functions"`; until then those tabs show an error).
- The 3-day answer window is gone from the rules. The 24-hour edit window (from the answer's
  own `createdAt`) and the 5-day ballot rule (kept for duels) remain, and a test keeps them in step.

## Picking favourites (voting, earlier design)

- The pick buttons are built but not for release on their own: set `NEXT_PUBLIC_ENABLE_VOTING=false` on any live deploy until the results and reveal ship.
- Email sign-ups get a verification email; voting needs a verified email (Google sign-ins already are). In the emulator the link appears in the Auth emulator's UI (http://localhost:4000/auth) under the user, or in the emulator terminal output.
- The new "your requests" list on the account page needs the index in `firestore.indexes.json`; publish it with `npx firebase deploy --only firestore:indexes` when going live (the emulator does not need it).
- Windows: answers and voting open for 3 days, then voting only for 2 more (`ANSWER_WINDOW_DAYS`, `VOTING_WINDOW_DAYS` in `src/lib/requests.ts`; a test keeps `firestore.rules` in step).

## Hosting (Firebase App Hosting)

Settings live in `apphosting.yaml`. Fill in the `REPLACE_ME` Firebase config values
(same ones as `.env.local`), then in the Firebase console go to Build > App Hosting >
Get started, connect the GitHub repo, pick branch `main`, and set the root directory
to `/`. Every push to `main` then deploys. It needs the Blaze plan.
After the first deploy, add the site's address (and tavernfire.com when connected)
under Authentication > Settings > Authorized domains, or sign-in will fail.
Voting is switched on in `apphosting.yaml` (`NEXT_PUBLIC_ENABLE_VOTING`).

## Email links (verification and password reset)

`/auth/action` handles the links in Firebase's emails, so people land on a Tavernfire
page instead of Firebase's plain one. In the Firebase console go to Authentication >
Templates, open "Email address verification" and "Password reset", choose the pencil
icon > Customize action URL, and set it to `https://<your site>/auth/action`
(later `https://tavernfire.com/auth/action`). The same page handles both emails.


## Cloud Functions (voting lifecycle)

Code is in `functions/` (Node 22, TypeScript). One-time setup on your computer:

1. `cd functions` then `npm install`, then `cd ..`.
2. `firebase login` (if needed), then deploy the rules, indexes and function together:
   `firebase deploy --only firestore,functions`
   The first deploy asks to switch on a few Google Cloud services (Cloud Build, Cloud Scheduler, Artifact Registry). Say yes. It needs the Blaze plan.
3. The new Firestore index (status + createdAt on requests) takes a few minutes to build after deploying. Until it finishes, the function logs a "needs an index" error and tries again 15 minutes later.
4. Check it in the Firebase console: Functions > `advanceLifecycle` > Logs. A healthy run prints `Lifecycle pass {...}`.

After changing `src/lib/ranking.ts`, run `npm run sync:functions` (a test fails if the copies differ).
Tests: `npm test` (logic) and `npm run test:rules` (rules plus the lifecycle running against the emulator).
Keep `NEXT_PUBLIC_ENABLE_VOTING=false` on the live site until the results screens ship.

## Results screens

The request page and board read the fields the lifecycle function writes
(`status`, `ballotCount` on requests; `result`, `authorName`, `revealedAt` on entries).
Author names and pick counts show only when an entry has `revealedAt` and `result`.
The board lists `open` and `voting` requests (with a phase label on each card) and a
"Recent results" list of `revealed` ones; both use the existing
(moderation, status, createdAt) index. With `NEXT_PUBLIC_ENABLE_VOTING=false`, picks are hidden but results
still show if a request has been revealed.

## Answer names and "Your answers"

- Someone with no display name is asked for one on the answer form (the name is shown on
  the answer when voting ends). Posting a request asks the same way.
- The account page lists your own answers, found with a collection-group read of your
  answer markers (`answerLocks` where `authorId` is you). That needs the new rule and the
  collection-group index on `answerLocks.authorId`, so deploy with
  `firebase deploy --only "firestore,functions"`. The reveal now also stores `result.tied`
  (for "Joint 2nd"), so redeploy the function too.

## Legal pages

- `/rules`, `/terms` and `/privacy` are plain-language pages (`src/app/rules|terms|privacy`), linked from the footer, the sign-up form and the answer form. They are not lawyer-reviewed.
- Answers and fires are licensed to everyone under CC BY 4.0 (authors keep ownership; credit is needed when work is shared or published). Wording lives in `src/app/terms/page.tsx`; names and links in `src/lib/site.ts`.
- **Before launch:** make sure `CONTACT_EMAIL` in `src/lib/site.ts` is a real inbox, and update `LEGAL_UPDATED` whenever the wording changes.

## Sparks in use

- `sparks/{word}` holds each normalised spark and how many fires use it (`{ word, count }`). Only the `countSparks` Cloud Function writes it (it recounts when a fire is created, deleted or its sparks change); anyone can read it.
- The Light a fire form reads it to suggest existing sparks while you type (`src/lib/spark-suggestions.ts`). Suggestions are optional; people can still type any word.
- Fires lit before this function was deployed are not in the list until one of them is written to. For a quick start, light (or delete) a test fire per spark, or run a one-off recount over `requests` with `recountSparks`.
- Deploy with `firebase deploy --only "firestore:rules,functions"`.

## Library search

- `/library?s=statue,time,glowing` searches answers by the sparks of the fire they answered (`src/lib/library.ts`, `src/components/LibraryView.tsx`). One to three sparks; exact matches first, then two shared, then one; most upvoted first within each group. Up to 30 answers per query.
- It uses three new indexes on `entries` (`sparkKey`, `pairKeys`, `sparksNorm`, each with `moderation` and `upvoteCount`). Deploy them with `firebase deploy --only firestore:indexes`; they take a few minutes to build.
- Not built yet: search by trait, filter by type, spark suggestions in the search box, paging past the first 30 results.
