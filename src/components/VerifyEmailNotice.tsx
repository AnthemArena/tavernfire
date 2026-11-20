"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";

/** Shown to someone with an unverified email who tries something that needs a verified one. */
export default function VerifyEmailNotice({ action }: { action: string }) {
  const { user, resendVerification, refreshVerification } = useAuth();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function check() {
    setBusy(true);
    setNote(null);
    try {
      const ok = await refreshVerification();
      if (!ok) setNote("We can't see that it's verified yet. Open the link in the email, then try again.");
    } catch {
      setNote("Couldn't check just now. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setBusy(true);
    setNote(null);
    try {
      await resendVerification();
      setNote("Sent. Check your inbox and spam folder.");
    } catch {
      setNote("Couldn't send it just now. Wait a minute and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="notice notice-warn" role="status">
      <p className="notice-title">Verify your email to {action}</p>
      <p>We sent a link to {user?.email ?? "your email"}. Open it, then come back here.</p>
      <div className="notice-actions">
        <button type="button" className="btn btn-outline" onClick={check} disabled={busy}>
          I&apos;ve verified it
        </button>
        <button type="button" className="btn btn-outline" onClick={resend} disabled={busy}>
          Send the link again
        </button>
      </div>
      {note && <p role="status">{note}</p>}
    </div>
  );
}
