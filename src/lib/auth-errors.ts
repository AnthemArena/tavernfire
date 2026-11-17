// Turn Firebase Auth error codes into messages that are safe and useful to show.

const MESSAGES: Record<string, string> = {
  "auth/invalid-credential": "That email and password don't match.",
  "auth/wrong-password": "That email and password don't match.",
  "auth/user-not-found": "That email and password don't match.",
  "auth/invalid-email": "That doesn't look like a valid email address.",
  "auth/email-already-in-use": "There's already an account with that email. Try signing in instead.",
  "auth/weak-password": "Choose a password with at least 6 characters.",
  "auth/missing-password": "Enter your password.",
  "auth/too-many-requests": "Too many attempts. Wait a moment and try again.",
  "auth/network-request-failed": "Couldn't reach the server. Check your connection and try again.",
  "auth/popup-closed-by-user": "The Google window was closed before signing in.",
  "auth/cancelled-popup-request": "The Google window was closed before signing in.",
  "auth/popup-blocked": "Your browser blocked the Google window. Allow pop-ups for this site and try again.",
  "auth/user-disabled": "This account has been disabled.",
  "auth/operation-not-allowed": "This sign-in method isn't switched on yet.",
};

const FALLBACK = "Something went wrong signing in. Please try again.";

export function friendlyAuthError(err: unknown): string {
  const code =
    typeof err === "object" && err !== null && "code" in err
      ? String((err as { code: unknown }).code)
      : "";
  return MESSAGES[code] ?? FALLBACK;
}
