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
    <section className={member ? "hero hero-compact" : "hero"}>
      <div className="hero-grid">
        <div className="hero-copy">
          {!member && <p className="kicker">Where game tables trade ideas</p>}
          <h1>Three sparks in. Something for your table out.</h1>
          <p className="hero-lede">
            Give three one-word sparks.
            <br />
            Get an NPC, location, item or creature back.
          </p>
          {!member && <p className="hero-made">Made by people.</p>}
          {member ? (
            <Link className="btn btn-primary hero-cta" href="/fires/new">
              Light a fire
            </Link>
          ) : (
            <div className="hero-actions">
              <Link className="btn btn-primary" href="/fires/new">
                Light a fire
              </Link>
              <Link className="btn btn-outline" href="/answers">
                Browse answers
              </Link>
            </div>
          )}
        </div>

        {!member && <HeroPanel />}
      </div>
    </section>
  );
}

/** How many of the trending fires to pick from. */
const FEATURE_POOL = 20;

function toFires(snapshot: { docs: { id: string; data: (o: { serverTimestamps: "estimate" }) => Record<string, unknown> }[] }) {
  return snapshot.docs
    .map((d) => toRequestItem(d.id, d.data({ serverTimestamps: "estimate" })))
    .filter((f): f is RequestItem => f !== null && f.topAnswer !== null);
}

/**
 * The panel beside the headline: a showcase of one fire and its top answer, the same for everyone.
 * It picks from the trending fires that have an answer, one per day (it changes at midnight UTC).
 * If none qualify it uses the newest fire with an answer, and if there are none at all it invites
 * people to light the first one.
 */
function HeroPanel() {
  const [state, setState] = useState<{ fire: RequestItem; now: Date } | "none" | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const db = getDb();
      const now = new Date();
      const trending = await getDocs(
        query(collection(db, "requests"), where("moderation", "==", "ok"), orderBy("trendRank", "desc"), limit(FEATURE_POOL)),
      );
      let fires = toFires(trending);
      // The first Trending card sits right below this panel, so show a different fire when there is one.
      const boardFirst = trending.docs[0]?.id;
      const others = fires.filter((f) => f.id !== boardFirst);
      if (others.length > 0) fires = others;
      if (fires.length === 0) {
        fires = toFires(
          await getDocs(
            query(
              collection(db, "requests"),
              where("moderation", "==", "ok"),
              where("answerCount", ">", 0),
              orderBy("answerCount"),
              orderBy("createdAt", "desc"),
              limit(10),
            ),
          ),
        );
      }
      if (cancelled) return;
      if (fires.length === 0) {
        setState("none");
        return;
      }
      const day = Math.floor(now.getTime() / 86_400_000);
      setState({ fire: fires[day % fires.length], now });
    })().catch(() => {
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
        <p className="hint hero-example-meta">
          <span className="badge">{kindLabel(fire.kind)}</span>
        </p>
        <p className="hint hero-example-lit">
          Lit by {fire.requesterName}, <span className="nowrap">{describeAge(fire.createdAt, now)}</span>
        </p>
        <p className="hero-featured-name">{top.name}</p>
        {top.snippet && <p className="hero-featured-note">{top.snippet}</p>}
        {top.author && <p className="hero-featured-author">Answered by {top.author}</p>}
        <Link className="btn btn-outline" href={`/fires/${fire.id}`}>
          See this fire
        </Link>
      </div>
    );
  }

  return (
    <div className="card hero-example" role="group" aria-label="Light the first fire">
      <p className="kicker">From the community</p>
      <p className="hero-example-question">No fires have been answered yet.</p>
      <p className="hint">Light one with three sparks, and the first answer will show up here.</p>
      <Link className="btn btn-outline" href="/fires/new">
        Light a fire
      </Link>
    </div>
  );
}
