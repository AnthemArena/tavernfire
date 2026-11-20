import type { Metadata } from "next";
import SignInForm from "@/components/SignInForm";
import { safeNext } from "@/lib/next-path";

export const metadata: Metadata = {
  title: "Sign in – Tavernfire",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  return (
    <main className="container narrow">
      <SignInForm next={safeNext(Array.isArray(next) ? next[0] : next)} />
    </main>
  );
}
