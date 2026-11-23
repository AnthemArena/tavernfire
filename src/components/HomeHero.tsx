"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { collection, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { describeAge, kindLabel, toRequestItem, type RequestItem } from "@/lib/requests";

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
 * a showcase fire (or an example, if there is none), then a way in. The signed-out
 * version is what the server sends, so it is also what link previews and search engines see.
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

        <HeroPanel member={member} />
      </div>
    </section>
  );
}

/** How many of the trending fires to pick from. */
const FEATURE_POOL = 10;

/**
 * The panel beside the headline: a showcase of one fire and its top answer, from the fires that are
 * trending and already have an answer. The same fire all day (it changes at midnight UTC). With none to show,
 * a visitor sees an example of three sparks, and a member sees nothing extra.
 */
function HeroPanel({ member }: { member: boolean }) {
  const [state, setState] = useState<{ fire: RequestItem; now: Date } | "none" | null>(null);

  useEffect(() => {
    let cancelled = false;
    getDocs(
      query(
        collection(getDb(), "requests"),
        where("moderation", "==", "ok"),
        orderBy("trendRank", "desc"),
        limit(FEATURE_POOL),
      ),
    )
      .then((snapshot) => {
        if (cancelled) return;
        const fires = snapshot.docs
          .map((d) => toRequestItem(d.id, d.data({ serverTimestamps: "estimate" })))
          .filter((f): f is RequestItem => f !== null && f.topAnswer !== null);
        if (fires.length === 0) {
          setState("none");
          return;
        }
        const now = new Date();
        const day = Math.floor(now.getTime() / 86_400_000);
        setState({ fire: fires[day % fires.length], now });
      })
      .catch(() => {
        if (!cancelled) setState("none");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Holds the space while the fire loads, so the page below does not jump.
  if (state === null) return <div className="hero-example hero-example-wait" aria-hidden="true" />;

  const top = state !== "none" ? state.fire.topAnswer : null;
  if (state !== "none" && top) {
    const { fire, now } = state;
    return (
      <div className="card hero-example" role="group" aria-label="A fire from the community">
        <p className="kicker">From the community</p>
        <div className="sparks hero-example-sparks">
          {fire.sparks.map((s) => (
            <span className="spark" key={s}>
              {s}
            </span>
          ))}
        </div>
        <p className="hero-featured-name">{top.name}</p>
        {top.snippet && <p className="hero-featured-note">{top.snippet}</p>}
        <p className="hint">
          {kindLabel(fire.kind)} · Lit by {fire.requesterName}, {describeAge(fire.createdAt, now)}
        </p>
        <Link className="btn btn-outline" href={`/fires/${fire.id}`}>
          See this fire
        </Link>
      </div>
    );
  }

  if (member) return null;

  return (
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
  );
}
