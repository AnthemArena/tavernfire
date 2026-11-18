import PostRequestForm from "@/components/PostRequestForm";
import RequestBoard from "@/components/RequestBoard";

export default function Home() {
  return (
    <main className="container">
      <section className="hero hero-grid">
        <div className="hero-copy">
          <p className="kicker">Where game tables trade ideas</p>
          <h1>Three sparks in. Something for your table out.</h1>
          <p className="hero-lede">
            A spark is a single word that starts an idea. Post three of them,
            say whether you need an NPC or a location, and the community
            answers. Every entry is written by a person and yours to use at the
            table.
          </p>
        </div>
        <div className="hero-form">
          <PostRequestForm />
        </div>
      </section>

      <div className="board-grid">
        <div className="board-main">
          <RequestBoard />
        </div>

        <aside className="board-side" aria-label="How it works">
          <div className="how-note">
            <p className="how-note-title">How a request works</p>
            <ol>
              <li>Answers open for 3 days.</li>
              <li>Voting follows, with authors hidden.</li>
              <li>Authors are revealed and winners highlighted.</li>
              <li>Every entry stays in the library.</li>
            </ol>
          </div>
        </aside>
      </div>
    </main>
  );
}
