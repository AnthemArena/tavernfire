"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import {
  applyActionCode,
  confirmPasswordReset,
  verifyPasswordResetCode,
} from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";
import { friendlyAuthError } from "@/lib/auth-errors";

type State =
  | { kind: "working" }
  | { kind: "verified" }
  | { kind: "reset-form"; email: string }
  | { kind: "reset-done" }
  | { kind: "failed"; message: string };

const BAD_LINK =
  "This link has expired or has already been used. Request a new one and try again.";

function linkError(err: unknown): string {
  const code =
    typeof err === "object" && err !== null && "code" in err
      ? String((err as { code: unknown }).code)
      : "";
  if (code === "auth/expired-action-code" || code === "auth/invalid-action-code") {
    return BAD_LINK;
  }
  return friendlyAuthError(err);
}

export default function EmailActionView() {
  const params = useSearchParams();
  const mode = params.get("mode");
  const code = params.get("oobCode");

  const [state, setState] = useState<State>({ kind: "working" });
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const set = (next: State) => {
      if (!cancelled) setState(next);
    };

    if (!code || (mode !== "verifyEmail" && mode !== "resetPassword")) {
      set({ kind: "failed", message: BAD_LINK });
      return;
    }
    const auth = getFirebaseAuth();

    if (mode === "verifyEmail") {
      applyActionCode(auth, code)
        .then(async () => {
          // If they are signed in here, pick up the change so voting unlocks.
          if (auth.currentUser) {
            await auth.currentUser.reload();
            await auth.currentUser.getIdToken(true);
          }
          set({ kind: "verified" });
        })
        .catch((err) => set({ kind: "failed", message: linkError(err) }));
    } else {
      verifyPasswordResetCode(auth, code)
        .then((email) => set({ kind: "reset-form", email }))
        .catch((err) => set({ kind: "failed", message: linkError(err) }));
    }
    return () => {
      cancelled = true;
    };
  }, [mode, code]);

  async function onReset(event: FormEvent) {
    event.preventDefault();
    if (!code) return;
    setFormError(null);
    setBusy(true);
    try {
      await confirmPasswordReset(getFirebaseAuth(), code, password);
      setState({ kind: "reset-done" });
    } catch (err) {
      setFormError(linkError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card auth-card">
      {state.kind === "working" && <p className="auth-lede">One moment…</p>}

      {state.kind === "verified" && (
        <>
          <h1 className="auth-title">Email verified</h1>
          <p className="auth-lede">
            Thank you. Your email is confirmed, so you can now pick your favourites when voting opens.
          </p>
          <Link href="/" className="btn btn-primary btn-block">
            Back to Tavernfire
          </Link>
        </>
      )}

      {state.kind === "reset-form" && (
        <>
          <h1 className="auth-title">Choose a new password</h1>
          <p className="auth-lede">For {state.email}.</p>
          <form onSubmit={onReset} noValidate>
            <div className="field">
              <label className="label" htmlFor="new-password">
                New password
              </label>
              <input
                id="new-password"
                className="input"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <p className="hint">At least 6 characters.</p>
            </div>
            {formError && (
              <p className="error" role="alert">
                {formError}
              </p>
            )}
            <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
              {busy ? "One moment…" : "Save new password"}
            </button>
          </form>
        </>
      )}

      {state.kind === "reset-done" && (
        <>
          <h1 className="auth-title">Password changed</h1>
          <p className="auth-lede">Your new password is saved. You can sign in with it now.</p>
          <Link href="/signin" className="btn btn-primary btn-block">
            Sign in
          </Link>
        </>
      )}

      {state.kind === "failed" && (
        <>
          <h1 className="auth-title">That link didn&rsquo;t work</h1>
          <p className="auth-lede">{state.message}</p>
          <Link href="/" className="btn btn-outline btn-block">
            Back to Tavernfire
          </Link>
        </>
      )}
    </div>
  );
}
