"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { friendlyAuthError } from "@/lib/auth-errors";

export default function SignInForm() {
  const router = useRouter();
  const {
    user,
    loading,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    sendPasswordReset,
  } = useAuth();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  // Already signed in (or just finished): go back to the board.
  useEffect(() => {
    if (!loading && user) router.replace("/");
  }, [loading, user, router]);

  function onForgotPassword() {
    if (email.trim() === "") {
      setInfo(null);
      setError("Enter your email above first, then choose Forgot password.");
      return;
    }
    void run(async () => {
      await sendPasswordReset(email);
      setInfo(
        "If an account exists for that email, a reset link is on its way. Check your spam folder too.",
      );
    });
  }

  async function run(action: () => Promise<void>) {
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      await action();
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (mode === "signup" && displayName.trim() === "") {
      setError("Choose a name to show next to your entries.");
      return;
    }
    void run(() =>
      mode === "signup"
        ? signUpWithEmail(email, password, displayName)
        : signInWithEmail(email, password),
    );
  }

  const isSignUp = mode === "signup";

  return (
    <div className="card auth-card">
      <h1 className="auth-title">{isSignUp ? "Create your account" : "Sign in"}</h1>
      <p className="auth-lede">
        {isSignUp
          ? "Join to post requests and answer other people's."
          : "Welcome back. Sign in to post requests and answer them."}
      </p>

      <button
        type="button"
        className="btn btn-outline btn-block"
        onClick={() => void run(signInWithGoogle)}
        disabled={busy}
      >
        Continue with Google
      </button>

      <div className="divider" role="separator">
        <span>or use email</span>
      </div>

      <form onSubmit={onSubmit} noValidate>
        {isSignUp && (
          <div className="field">
            <label className="label" htmlFor="displayName">
              Name shown on your entries
            </label>
            <input
              id="displayName"
              className="input"
              type="text"
              autoComplete="nickname"
              maxLength={40}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
        )}

        <div className="field">
          <label className="label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            className="input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="field">
          <label className="label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            className="input"
            type="password"
            autoComplete={isSignUp ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {isSignUp ? (
            <p className="hint">At least 6 characters.</p>
          ) : (
            <p className="hint">
              <button type="button" className="btn-link" onClick={onForgotPassword} disabled={busy}>
                Forgot password?
              </button>
            </p>
          )}
        </div>

        {info && (
          <p className="notice notice-success" role="status">
            {info}
          </p>
        )}

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? "One moment…" : isSignUp ? "Create account" : "Sign in"}
        </button>
      </form>

      <p className="auth-switch">
        {isSignUp ? "Already have an account?" : "New here?"}{" "}
        <button
          type="button"
          className="btn-link"
          onClick={() => {
            setError(null);
            setMode(isSignUp ? "signin" : "signup");
          }}
        >
          {isSignUp ? "Sign in" : "Create an account"}
        </button>
      </p>
    </div>
  );
}
