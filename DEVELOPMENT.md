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
  `functions/src/trending.ts`. The board's Trending, Most stoked and New tabs each run one query and
  need the two new indexes in `firestore.indexes.json` (they take a few minutes to build after
  `firebase deploy --only "firestore,functions"`; until then those tabs show an error).
- The 3-day answer window is gone from the rules. The 24-hour edit window (from the answer's
  own `createdAt`) and the 5-day ballot rule (kept for duels) remain, and a test keeps them in step.

## Picking favourites (voting, earlier design)

- The pick buttons are built but not for release on their own: set `NEXT_PUBLIC_ENABLE_VOTING=false` on any live deploy until the results and reveal ship.
- Email sign-ups get a verification email; voting needs a verified email (Google sign-ins already are). In the emulator the link appears in the Auth emulator's UI (http://localhost:4000/auth) under the user, or in the emulator terminal output.
- The new "your requests" list on the settings page needs the index in `firestore.indexes.json`; publish it with `npx firebase deploy --only firestore:indexes` when going live (the emulator does not need it).
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
- (The settings page used to list your own answers; that list is gone, the profile has them. The collection-group read it used was) found with a collection-group read of your
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

## Library search (fires)

- `/library?s=statue,time,glowing` searches **fires** by spark (`src/lib/library.ts`, `src/components/LibraryView.tsx`). One to three sparks; fires with all of them first, then two shared, then one; most stoked first within each group. Up to 30 fires per query. With nothing searched it shows a cloud of the most used sparks (from the `sparks` list) and the most stoked fires.
- Each result shows its answer count and best answer. Those come from fields on the fire, `answerCount` and `topAnswer`, kept by the `countAnswers` Cloud Function (it recomputes whenever an answer is written, including when upvotes change). The app never writes them.
- New fires start with `stokeCount: 0` and new answers with `upvoteCount: 0` (the rules require both). Firestore leaves out documents that lack a field you sort by, so without these they would be missing from sorted queries. Fires and answers written before this change lack them: they are test data and will not show in the Library until deleted or backfilled.
- Indexes: three on `requests` (`moderation`, one of `sparkKey` / `pairKeys` / `sparksNorm`, `stokeCount`). Deploy with `firebase deploy --only "firestore:rules,firestore:indexes,functions"`.
- Not built yet: search by trait, filter by type or by unanswered, paging past the first 30 results.

## Moderation

- **Making someone a moderator:** `node scripts/set-moderator.mjs someone@example.com` (add `--remove` to take it away). It needs a service account key: Firebase console, Project settings, Service accounts, Generate new private key. Keep that file outside the project folder and never commit it. Set `$env:GOOGLE_APPLICATION_CREDENTIALS` to its path first (PowerShell). The person must sign out and back in afterwards. The role is the custom claim `role: "moderator"`, which the rules and the function check.
- **The review queue:** `/moderation` (not linked anywhere; moderators bookmark it) lists answers with open reports, the reasons, and two buttons. **Hide answer** removes it from the site (reports become "actioned", the edit lock stays). **Dismiss reports** clears them and removes the edit lock. A hidden answer can be restored by the `restore` action (no button yet).
- Actions run in the `moderateAnswer` Cloud Function (`functions/src/moderation.ts`) because the rules let nobody change or delete answers from the app. Every action is written to `moderationLog`. Hiding an answer also updates its fire's answer count and top answer (`countAnswers`).
- Not built: moderating fires or profiles, a list of hidden answers with a restore button, and notifying authors.

- **Repairing the sparks list:** `node scripts/rebuild-sparks.mjs` shows what is wrong with `sparks/{word}` counts, and `--apply` fixes them. It needs the same admin key as `scripts/set-moderator.mjs`.

## Avatars

Members pick a portrait from the art packs on the settings page. The pictures are `public/avatars/<pack>-<n>.webp` (256 px wide, converted from the original PNGs), and the pack list is `PACKS` in `src/lib/avatars.ts`. The ids (like `demon-12`) are also checked in `firestore.rules` (`validAvatar`, a pattern naming the packs and the 1 to 50 range); tests fail if the two disagree or a picture file is missing.

- **Adding a pack:** save its images as `<pack>-1.webp`, `<pack>-2.webp`…, add it to `PACKS`, and add the pack name to the pattern in `validAvatar`. Then deploy the rules.
- The choice is stored as `users/{uid}.avatar` plus `avatarChangedAt`. The rules allow a change once an hour (`avatarFree`).
- Unlike names, avatars stay current on old posts. Each fire has `requesterAvatar` and each answer `authorAvatar` (left off when the member has none), copied when posting; the rules check they match the profile. When the profile avatar changes, the `propagateAvatar` function (`functions/src/avatars.ts`) updates the member's fires and answers. It is safe to run twice.
- `Avatar` has three sizes: `sm` (cards and bylines), `md` (header, fire page), `lg` (profile and picker). With no avatar it shows the first letter of the name.
- Uploaded pictures are a later step: they would be another kind of value in the same `avatar` field, with their own checks.
- Deploy with `firebase deploy --only "firestore:rules,firestore:indexes,functions"` (the new function is `propagateAvatar`).

## Bios

`users/{uid}.bio`: plain text, at most 280 characters, no web addresses (`validBio` in the rules; the same limits are in `src/lib/bio.ts` and a test keeps them in step). Written on the settings page ("About you"), shown on the profile only (kept off the fire page to avoid clutter). Nothing is copied onto fires. Bios are not yet covered by moderation (reporting a profile is on the later list), which is why links are refused.

## XP and ranks

The points and ranks are in `src/lib/xp.ts` (5 XP for a fire, 5 for an answer, 10 for each upvote on your answers, 10 for each stoke on your fires; ranks at 0, 50, 150, 400 and 1000 XP). The icons are in `public/ranks`. A copy of the file lives in `functions/src/xp.ts`: after changing it run `npm run sync:functions` (a test fails if the copies differ).

The `xpFromFires` and `xpFromAnswers` functions recount a member's XP from their visible posts whenever a post appears, goes away, is hidden or restored, or its stoke or upvote count changes, and save `xp` and `level` on `users/{uid}`. Because it recounts, hidden answers stop counting and running twice is harmless. The app can't write these two fields (rules test). To change the points later, edit the table, sync, deploy; XP then corrects itself as members' posts change (to correct everyone at once, a small script can recompute all members).

Ranks show on the profile, the settings page ("Your rank", with a progress bar) and the fire page. They are not on every card or answer byline yet: that would mean copying the level onto each post and updating it like avatars.

## Notifications, toasts and achievements

- **Making them:** `countStokes`, `countUpvotes` and `countAnswers` also call `notifyStoke`, `notifyUpvote` and `notifyAnswer`; the xp function (`recomputeXp`) announces new ranks and achievements. Each uses a fixed id, so retries and un-vote/re-vote cannot repeat a notification. Nobody is told about their own actions.
- **Showing them:** `NotificationsProvider` (in the layout) listens to the member's newest 30 notifications. The bell lists them; `ToastHost` pops up the ones that arrive while the member is on the site (not the ones already waiting). Bursts of stokes or upvotes are combined into one toast ("3 upvotes on your answers."). Clicking one marks it read and goes to the fire or profile.
- **Wording:** `src/lib/notifications.ts`. To add a kind: add it there, in `notify.ts`, in `NotificationIcon`, and in the rules test.
- **Achievements:** the list is `src/lib/achievements.ts` (copied to `functions/src`; run `npm run sync:functions`). Once earned they are kept on the profile even if posts are later hidden. A new rank is announced as a level-up, not an achievement.
- **Index:** notifications need the (recipientId, createdAt desc) index in `firestore.indexes.json`; deploy with the rules.

## Signing in and coming back

Every "Sign in" link carries the page the visitor was on as `?next=` (see `src/lib/next-path.ts`),
so someone who taps Stoke or Upvote while signed out lands back on the same fire after signing in.
Only a path on this site is accepted (one leading slash, never `//` or a full address), and anything
else falls back to the home page. Toasts hold while the pointer or keyboard focus is on them.

## Settings and the one-off XP recount

The settings page holds settings only (display name, rank, avatar, bio, email). Your fires and answers are on your public profile, which the page links to.

After the XP functions are first deployed, posts made before then are not counted until something changes on them. A moderator can run **Recount XP for everyone** on the moderation page (`/moderation`): it calls the `recountAllXp` function, which recounts every member's XP, rank and achievements. Run it once after deploying, or after changing the points table. Members whose rank or achievements change get the usual notifications.
