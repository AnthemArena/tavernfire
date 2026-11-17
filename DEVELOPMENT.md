# Local development

## Prerequisites

- **Node.js** (current LTS) and **Git**
- **Java 11 or newer.** The Firestore emulator is a Java program, so it will not start without it. Check with `java -version`; if it is missing, install a JDK such as Temurin (adoptium.net).

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
npm run build
```

## Security reminders

- The Firebase web config values are not secrets, but keep them in `.env.local` anyway.
- Never commit a service account key (a JSON file with a private key). The `.gitignore` blocks the common names, but check before you commit.
- `firestore.rules` is deny-by-default. Rules for each collection are added with the feature that needs them, following `DATA_MODEL.md`.
- Deploying rules to the real project is a separate step (`npx firebase deploy --only firestore:rules`) and is not part of local development.
