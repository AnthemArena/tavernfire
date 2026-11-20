// Gives (or takes away) the moderator role for one account.
//
//   node scripts/set-moderator.mjs someone@example.com          make a moderator
//   node scripts/set-moderator.mjs someone@example.com --remove  take the role away
//
// It needs admin access to the Firebase project. In the Firebase console go to
// Project settings, Service accounts, Generate new private key, save the file somewhere
// SAFE OUTSIDE the project folder (never commit it), then in PowerShell:
//
//   $env:GOOGLE_APPLICATION_CREDENTIALS = "C:\path\to\that-key.json"
//   node scripts/set-moderator.mjs someone@example.com
//
// The person must sign out and back in before the role takes effect.

import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const [email, flag] = process.argv.slice(2);
if (!email || email.startsWith("--")) {
  console.error("Usage: node scripts/set-moderator.mjs <email> [--remove]");
  process.exit(1);
}
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error("Set GOOGLE_APPLICATION_CREDENTIALS to your service account key first (see the top of this file).");
  process.exit(1);
}

initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID ?? "tavernfire-3fcb5" });
const auth = getAuth();
const user = await auth.getUserByEmail(email);
const claims = { ...(user.customClaims ?? {}) };
if (flag === "--remove") delete claims.role;
else claims.role = "moderator";
await auth.setCustomUserClaims(user.uid, claims);
console.log(`${email} is ${flag === "--remove" ? "no longer a moderator" : "now a moderator"}. They need to sign out and back in.`);
