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

1. Add an entry to `CATEGORIES` in `src/lib/categories.ts` (stable `id`, labels, answer wording) with `launched: false`.
2. When it is ready, set `launched: true` and add its id to the `d.kind in [...]` list in `firestore.rules`.
3. Run `npm test` (a test fails if the two lists differ) and `npm run test:rules`, then publish the rules.

Every category uses the same answer shape (name, description, optional tags); only the wording differs.
