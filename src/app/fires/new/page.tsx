import type { Metadata } from "next";
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
          Give three single words and say what you need. People answer with
          something that fits all of them. Answers stay open for 3 days, then
          voting runs for 5.
        </p>
      </section>
      <PostRequestForm />
    </main>
  );
}
