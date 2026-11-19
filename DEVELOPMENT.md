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

## Picking favourites (voting)

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
Keep `NEXT_PUBLIC_ENABLE_VOTING` false until results and the reveal ship.
