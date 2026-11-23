import Link from "next/link";
import RequestBoard from "@/components/RequestBoard";

/** The four steps. Shown beside the list on wide screens and as a folded note above it on phones. */
function HowSteps() {
  return (
    <ol>
      <li>Light a fire: choose what you need, pick three sparks and add a little context.</li>
      <li>The community answers.</li>
      <li>Stoke the fires worth answering. Upvote the answers you like.</li>
      <li>Every fire stays in the library, filed under its sparks.</li>
    </ol>
  );
}

export default function Home() {
  return (
    <main className="container">
      <section className="hero">
        <div className="hero-copy">
          <p className="kicker">Where game tables trade ideas</p>
          <h1>Three sparks in. Something for your table out.</h1>
          <p className="hero-lede">Give three sparks. Get an NPC, place, item or creature for your table.</p>
          <Link className="btn btn-primary hero-cta" href="/fires/new">
            Light a fire
          </Link>
        </div>
      </section>

      <div className="board-grid">
        <div className="board-main">
          <details className="how-note how-note-fold">
            <summary>How a fire works</summary>
            <HowSteps />
          </details>
          <RequestBoard />
        </div>

        <aside className="board-side" aria-label="How it works">
          <div className="how-note">
            <p className="how-note-title">How a fire works</p>
            <HowSteps />
          </div>
        </aside>
      </div>
    </main>
  );
}
