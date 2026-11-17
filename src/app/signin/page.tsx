import type { Metadata } from "next";
import SignInForm from "@/components/SignInForm";

export const metadata: Metadata = {
  title: "Sign in – Tavernfire",
};

export default function SignInPage() {
  return (
    <main className="container narrow">
      <SignInForm />
    </main>
  );
}
