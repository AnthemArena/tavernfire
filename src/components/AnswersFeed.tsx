"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, doc, getDoc, limit, onSnapshot, orderBy, query, where } from "firebase/firestore";
import Avatar from "@/components/Avatar";
import { getDb } from "@/lib/firebase";
import { useNow } from "@/lib/use-now";
import { toEntryItem, type EntryItem } from "@/lib/entries";
import { describeAge, kindLabel, toRequestItem, type RequestItem } from "@/lib/requests";

type Sort = "top" | "new";

const PAGE_SIZE = 30;

const SORTS: { value: Sort; label: string }[] = [
  { value: "top", label: "Most upvoted" },
  { value: "new", label: "New" },
];

function answersQuery(sort: Sort, max: number) {
  const entries = collection(getDb(), "entries");
  return sort === "top"
    ? query(entries, where("moderation", "==", "ok"), orderBy("upvoteCount", "desc"), orderBy("createdAt", "desc"), limit(max))
    : query(entries, where("moderation", "==", "ok"), orderBy("createdAt", "desc"), limit(max));
}

/** A feed of answers, each with the fire it answers. Clicking goes to that answer on its fire's page. */
export default function AnswersFeed() {
  const [sort, setSort] = useState<Sort>("top");
  const [max, setMax] = useState(PAGE_SIZE);
  const [loaded, setLoaded] = useState<{ sort: Sort; max: number; full: boolean; items: EntryItem[] } | null>(null);
  // The fires the answers belong to, looked up once each. A fire that can't be read (hidden) is null.
  const [fires, setFires] = useState<Record<string, RequestItem | null>>({});
  const [failed, setFailed] = useState(false);
  const now = useNow();

  const items = loaded && loaded.sort === sort ? loaded.items : null;
  const loadingMore = loaded !== null && loaded.sort === sort && loaded.max !== max;

  useEffect(() => {
    return onSnapshot(
      answersQuery(sort, max),
      (snap) => {
        const list = snap.docs
          .map((d) => toEntryItem(d.id, d.data({ serverTimestamps: "estimate" })))
          .filter((e): e is EntryItem => e !== null);
        setLoaded({ sort, max, full: snap.size >= max, items: list });
        setFailed(false);
      },
      (err) => {
        console.error("Could not load answers", err);
        setFailed(true);
      },
    );
  }, [sort, max]);

  useEffect(() => {
    if (!items) return;
    const missing = [...new Set(items.map((e) => e.requestId))].filter((id) => !(id in fires));
    if (missing.length === 0) return;
    let cancelled = false;
    Promise.all(
      missing.map(async (id) => {
        try {
          const snap = await getDoc(doc(getDb(), "requests", id));
          return [id, snap.exists() ? toRequestItem(id, snap.data({ serverTimestamps: "estimate" })) : null] as const;
        } catch {
          return [id, null] as const;
        }
      }),
    ).then((pairs) => {
      if (!cancelled) setFires((prev) => ({ ...prev, ...Object.fromEntries(pairs) }));
    });
    return () => {
      cancelled = true;
    };
  }, [items, fires]);

  // Hold the list back until each answer's fire has been looked up, so cards do not pop in one by one.
  const ready = items !== null && items.every((e) => e.requestId in fires);
  const visible = ready ? items.filter((e) => fires[e.requestId] != null) : [];

  return (
    <section aria-labelledby="answers-feed-title">
      <h2 id="answers-feed-title" className="visually-hidden">
        Answers
      </h2>
      <div className="sort-tabs" role="group" aria-label="Sort answers">
        {SORTS.map((s) => (
          <button
            key={s.value}
            type="button"
            className="sort-tab"
            aria-pressed={sort === s.value}
            onClick={() => {
              setMax(PAGE_SIZE);
              setSort(s.value);
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {failed ? (
        <p className="empty" role="alert">
          Couldn&apos;t load answers. Try again in a moment.
        </p>
      ) : !ready ? (
        <p className="muted page-note" role="status">
          Loading…
        </p>
      ) : visible.length === 0 ? (
        <div className="empty">
          <p>No answers yet. Find a fire and be the first.</p>
          <Link className="btn btn-primary" href="/">
            Browse fires
          </Link>
        </div>
      ) : (
        <ul className="answer-feed">
          {visible.map((e) => {
            const fire = fires[e.requestId] as RequestItem;
            return (
              <li key={e.id} className="card answer-feed-card">
                <p className="hint">
                  <span className="badge">{kindLabel(e.kind)}</span> Answer to a fire
                </p>
                <h3 className="answer-feed-name">
                  <Link href={`/fires/${e.requestId}#entry-${e.id}`}>{e.name}</Link>
                </h3>
                <p className="answer-feed-sparks">{fire.sparks.join(" · ")}</p>
                <p className="answer-feed-concept">{e.concept}</p>
                <div className="answer-feed-foot">
                  {e.author && (
                    <span className="answer-feed-author">
                      <Avatar id={e.author.avatar} name={e.author.name} size="sm" />
                      <Link href={`/profile/${e.author.id}`}>{e.author.name}</Link>
                    </span>
                  )}
                  <span className="answer-feed-votes" aria-label={`${e.upvoteCount} upvotes`}>
                    ↑ {e.upvoteCount}
                  </span>
                </div>
                <p className="hint">
                  Fire lit by {fire.requesterName}, {describeAge(fire.createdAt, now)}
                </p>
                <Link className="answer-feed-link" href={`/fires/${e.requestId}#entry-${e.id}`}>
                  View in the fire →
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {!failed && ready && loaded?.full && (
        <div className="show-more">
          <button
            type="button"
            className="btn btn-outline"
            disabled={loadingMore}
            onClick={() => setMax((m) => m + PAGE_SIZE)}
          >
            {loadingMore ? "Loading…" : "Show more"}
          </button>
        </div>
      )}
    </section>
  );
}
