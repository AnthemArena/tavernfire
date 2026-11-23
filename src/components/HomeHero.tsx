"use client";

import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

// Remembers that this browser belongs to a member, so a returning member sees the short hero at once
// instead of the example card flashing up while the sign-in check finishes.
const MEMBER_KEY = "tavernfire-member";
function subscribeMemberHint(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}
function readMemberHint() {
  try {
    return window.localStorage.getItem(MEMBER_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * The top of the front page. Members see the short version, so the board is
 * right there. Someone who is not signed in also gets a taste of the idea:
 * three example sparks and a question, then a way in. The signed-out version is
 * what the server sends, so it is also what link previews and search engines see.
 */
export default function HomeHero() {
  const { user, loading } = useAuth();
  const hint = useSyncExternalStore(subscribeMemberHint, readMemberHint, () => false);
  // Until the sign-in check finishes, go by what this browser remembered.
  const member = loading ? hint : user !== null;

  useEffect(() => {
    if (loading) return;
    try {
      if (user) window.localStorage.setItem(MEMBER_KEY, "1");
      else window.localStorage.removeItem(MEMBER_KEY);
    } catch {
      // Storage can be blocked; the page still works, it just may flash once.
    }
  }, [user, loading]);

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
