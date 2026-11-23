"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

/**
 * The top of the front page. Members see the short version, so the board is
 * right there. Someone who is not signed in also gets a taste of the idea:
 * three example sparks and a question, then a way in. The signed-out version is
 * what the server sends, so it is also what link previews and search engines see.
 */
export default function HomeHero() {
  const { user, loading } = useAuth();
  const member = !loading && user !== null;

  return (
    <section className="hero">
      <div className="hero-grid">
        <div className="hero-copy">
          <p className="kicker">Where game tables trade ideas</p>
          <h1>Three sparks in. Something for your table out.</h1>
          <p className="hero-lede">Give three sparks. Get an NPC, place, item or creature for your table.</p>
          {!member && <p className="hero-made">Every answer is written by a person.</p>}
          {member ? (
            <Link className="btn btn-primary hero-cta" href="/fires/new">
              Light a fire
            </Link>
          ) : (
            <div className="hero-actions">
              <Link className="btn btn-primary" href="/fires/new">
                Light a fire
              </Link>
              <a className="btn btn-outline" href="#open-requests">
                Browse fires
              </a>
            </div>
          )}
        </div>

        {!member && (
          <div className="card hero-example" role="group" aria-label="An example of three sparks">
            <p className="kicker">A little creative challenge</p>
            <div className="sparks hero-example-sparks">
              <span className="spark">Ancient</span>
              <span className="spark">Glowing</span>
              <span className="spark">Forgotten</span>
            </div>
            <p className="hero-example-question">What would you make from these?</p>
            <p className="hint">An NPC, a place, an item or a creature. Light a fire with your own three, or answer someone else&apos;s.</p>
          </div>
        )}
      </div>
    </section>
  );
}
