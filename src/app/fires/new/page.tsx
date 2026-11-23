import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import PostRequestForm from "@/components/PostRequestForm";

export const metadata: Metadata = {
  title: "Light a fire – Tavernfire",
};

export default function LightAFirePage() {
  return (
    <main className="container narrow">
      <Link href="/" className="back-link">
        ← Back to Fires
      </Link>
      <section className="page-intro">
        <h1 className="section-title">Light a fire</h1>
        <p className="hero-lede">
          Write three one-word sparks and say what you need. Answers should fit
          all three.
        </p>
      </section>
      <Suspense fallback={null}>
        <PostRequestForm />
      </Suspense>
    </main>
  );
}
