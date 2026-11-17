import Link from "next/link";

export default function Home() {
  return (
    <>
      <header className="site-header">
        <div className="container">
          <Link className="brand" href="/">
            Tavernfire
          </Link>
        </div>
      </header>

      <main className="container">
        <section className="hero">
          <p className="kicker">Where game tables trade ideas</p>
          <h1>Three sparks in. Something for your table out.</h1>
          <p>
            A spark is a single word that starts an idea. Post three of them,
            say whether you need an NPC or a location, and the community
            answers. Every entry is written by a person and yours to use at the
            table.
          </p>
          <div className="sparks" aria-label="Example sparks">
            <span className="spark">Statue</span>
            <span className="spark">Time</span>
            <span className="spark">Glowing</span>
          </div>
          <p className="status-note">
            Project scaffold. The request board comes in the next step.
          </p>
        </section>
      </main>
    </>
  );
}
