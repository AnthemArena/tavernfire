"use client";

import Link from "next/link";
import { useDocumentTitle } from "@/lib/use-document-title";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { safeNext } from "@/lib/next-path";
import { useAuth } from "@/lib/auth-context";
import { friendlyAuthError } from "@/lib/auth-errors";

export default function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  // Create account has its own address (?mode=signup), so Back and shared links work.
  const mode: "signin" | "signup" = params.get("mode") === "signup" ? "signup" : "signin";
  const {
    user,
    loading,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    sendPasswordReset,
  } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  // Already signed in (or just finished): go back to the board.
  useEffect(() => {
    if (!loading && user) router.replace(next);
  }, [loading, user, router, next]);

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
          ? "Join to light fires and answer other people\u2019s fires."
          : "Light fires and answer other people\u2019s fires."}
      </p>
      {isSignUp && (
        <p className="hint">
          By creating an account you agree to the <Link href="/terms">terms</Link>,{" "}
          <Link href="/rules">rules</Link> and <Link href="/privacy">privacy policy</Link>.
        </p>
      )}

      <button
        type="button"
        className="btn btn-outline btn-block"
        onClick={() => void run(signInWithGoogle)}
        disabled={busy}
      >
        Continue with Google
      </button>
      {!isSignUp && <p className="hint">Creates an account if you are new.</p>}

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
          <div className="password-wrap">
            <input
              id="password"
              className="input"
              type={showPassword ? "text" : "password"}
              autoComplete={isSignUp ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="btn-link password-toggle"
              aria-pressed={showPassword}
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
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
            We&apos;ll email a link to verify your address. You need it to stoke and upvote.
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
            const q = new URLSearchParams(params.toString());
            if (isSignUp) q.delete("mode");
            else q.set("mode", "signup");
            const qs = q.toString();
            router.push(qs ? `/signin?${qs}` : "/signin");
          }}
        >
          {isSignUp ? "Sign in" : "Create an account"}
        </button>
      </p>
    </div>
  );
}
