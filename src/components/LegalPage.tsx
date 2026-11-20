import Link from "next/link";
import type { ReactNode } from "react";

/** Shared frame for the rules, terms and privacy pages. */
export default function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated?: string;
  children: ReactNode;
}) {
  return (
    <main className="container narrow">
      <Link href="/" className="back-link">
        ← Back to Fires
      </Link>
      <article className="legal">
        <h1 className="section-title">{title}</h1>
        {updated && <p className="muted">Last updated {updated}</p>}
        {children}
      </article>
    </main>
  );
}
