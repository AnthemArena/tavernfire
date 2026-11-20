import type { Metadata } from "next";
import { Suspense } from "react";
import SignInForm from "@/components/SignInForm";

export const metadata: Metadata = {
  title: "Sign in – Tavernfire",
};

export default function SignInPage() {
  return (
    <main className="container narrow">
      {/* The form reads ?next= (where to go after signing in) in the browser, so it sits in a Suspense boundary. */}
      <Suspense fallback={null}>
        <SignInForm />
      </Suspense>
    </main>
  );
}
