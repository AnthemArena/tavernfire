"use client";

import Link from "next/link";
import { useDocumentTitle } from "@/lib/use-document-title";
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
    if (mode === "signup" && password.length < 8) {
      setError("Use at least 8 characters for your password.");
      return;
    }
    void run(() =>
      mode === "signup"
        ? signUpWithEmail(email, password)
        : signInWithEmail(email, password),
    );
  }

  const isSignUp = mode === "signup";
  useDocumentTitle(isSignUp ? "Create account" : "Sign in");

  return (
    <div className="card auth-card">
      <h1 className="auth-title">{isSignUp ? "Create your account" : "Sign in"}</h1>
      <p className="auth-lede">
        {isSignUp
          ? "Join to light fires and answer other people's."
          : "Welcome back. Sign in to light fires and answer other people's."}
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
            <p className="hint">Use at least 8 characters.</p>
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

        {isSignUp && (
          <p className="hint">
            We&apos;ll email you a link to verify your address. You&apos;ll need it to stoke fires and
            upvote answers.
          </p>
        )}
        {isSignUp && (
          <p className="hint">
            By creating an account you agree to the <Link href="/terms">terms</Link> and{" "}
            <Link href="/rules">rules</Link>. See the <Link href="/privacy">privacy page</Link>.
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
