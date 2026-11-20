import type { Metadata } from "next";
import { Suspense } from "react";
import LibraryView from "@/components/LibraryView";

export const metadata: Metadata = {
  title: "Library – Tavernfire",
};

export default function LibraryPage() {
  return (
    <main className="container narrow">
      <section className="page-intro">
        <h1 className="section-title">Library</h1>
        <p className="hero-lede">
          Every answer ever written, filed under the sparks of its fire. Search one, two or three
          sparks. Exact matches come first, then answers that share two sparks, then one.
        </p>
      </section>
      <Suspense fallback={<p className="muted page-note">Loading…</p>}>
        <LibraryView />
      </Suspense>
    </main>
  );
}
