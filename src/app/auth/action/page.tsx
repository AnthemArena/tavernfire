import type { Metadata } from "next";
import { Suspense } from "react";
import EmailActionView from "@/components/EmailActionView";

export const metadata: Metadata = {
  title: "Email link – Tavernfire",
  robots: { index: false },
};

// Firebase sends people here from verification and password-reset emails
// (set as the action URL in Authentication > Templates).
export default function EmailActionPage() {
  return (
    <main className="container narrow">
      <Suspense fallback={<p className="auth-lede">One moment…</p>}>
        <EmailActionView />
      </Suspense>
    </main>
  );
}
