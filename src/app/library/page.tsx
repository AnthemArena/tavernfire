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
          Every fire, filed under its sparks. Search one, two or three sparks: exact matches come
          first, then fires that share two, then one.
        </p>
      </section>
      <Suspense fallback={<p className="muted page-note">Loading…</p>}>
        <LibraryView />
      </Suspense>
    </main>
  );
}
