import Link from "next/link";
import RequestBoard from "@/components/RequestBoard";

export default function Home() {
  return (
    <main className="container">
      <section className="hero">
        <div className="hero-copy">
          <p className="kicker">Where game tables trade ideas</p>
          <h1>Three sparks in. Something for your table out.</h1>
          <p className="hero-lede">
            A spark is a single word that starts an idea. Light a fire with
            three of them, say what you need, and the community answers. Every
            entry is written by a person and yours to use at the table.
          </p>
          <Link className="btn btn-primary hero-cta" href="/fires/new">
            Light a fire
          </Link>
        </div>
      </section>

      <div className="board-grid">
        <div className="board-main">
          <RequestBoard />
        </div>

        <aside className="board-side" aria-label="How it works">
          <div className="how-note">
            <p className="how-note-title">How a fire works</p>
            <ol>
              <li>Someone lights a fire with three sparks.</li>
              <li>Anyone can answer, under their own name.</li>
              <li>People upvote the answers they like.</li>
              <li>Every answer stays in the library.</li>
            </ol>
          </div>
        </aside>
      </div>
    </main>
  );
}
