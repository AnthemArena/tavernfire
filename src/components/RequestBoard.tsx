"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import TopAnswer from "@/components/TopAnswer";
import Avatar from "@/components/Avatar";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { useNow } from "@/lib/use-now";
import { useAuth } from "@/lib/auth-context";
import { AnswerCountLabel } from "@/components/AnswerCount";
import { LAUNCHED_CATEGORIES, isCompactPicker } from "@/lib/categories";
import {
  describeAge,
  kindLabel,
  toRequestItem,
  type RequestItem,
  type RequestKind,
} from "@/lib/requests";

type Filter = "all" | RequestKind;
type Sort = "trending" | "top" | "new";

const SORTS: { value: Sort; label: string }[] = [
  { value: "trending", label: "Trending" },
  { value: "top", label: "Most stoked" },
  { value: "new", label: "New" },
];

const EMPTY: Record<Sort, string> = {
  trending: "Nothing's trending yet. Stoke a fire you'd like answered, or upvote an answer you like.",
  top: "No fire has been stoked yet. Stoke one you'd like to see answered.",
  new: "Nothing is burning yet. Be the first to light a fire.",
};

/** One query per tab, so only the tab being looked at is read. */
function boardQuery(sort: Sort) {
  const requests = collection(getDb(), "requests");
  switch (sort) {
    case "trending":
      return query(requests, where("moderation", "==", "ok"), orderBy("trendRank", "desc"), limit(30));
    case "top":
      return query(
        requests,
        where("moderation", "==", "ok"),
        orderBy("stokeCount", "desc"),
        orderBy("createdAt", "desc"),
        limit(30),
      );
    case "new":
      return query(
        requests,
        where("moderation", "==", "ok"),
        // Every status, so the existing index (moderation, status, createdAt) serves this.
        where("status", "in", ["open", "voting", "revealed", "closed"]),
        orderBy("createdAt", "desc"),
        limit(30),
      );
  }
}



export default function RequestBoard() {
  const [sort, setSort] = useState<Sort>("trending");
  // Which tab the list belongs to, so switching tabs shows "Loading" instead of the old list.
  const [loaded, setLoaded] = useState<{ sort: Sort; items: RequestItem[] } | null>(null);
  const items = loaded && loaded.sort === sort ? loaded.items : null;
  // Until someone picks a tab, an empty Trending falls back to New.
  const chosen = useRef(false);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const now = useNow();

  useEffect(() => {
    return onSnapshot(
      boardQuery(sort),
      (snapshot) => {
        const list = snapshot.docs
          .map((d) =>
            // "estimate" fills in createdAt for a request we just posted,
            // before the server has confirmed the time.
            toRequestItem(d.id, d.data({ serverTimestamps: "estimate" })),
          )
          .filter((item): item is RequestItem => item !== null);
        if (sort === "trending" && list.length === 0 && !chosen.current) {
          setSort("new");
          return;
        }
        setLoaded({ sort, items: list });
        setFailed(false);
      },
      (err) => {
        console.error("Could not load requests", err);
        setFailed(true);
      },
    );
  }, [sort]);

  // Only offer types that have open requests right now (an empty filter makes the
  // board look dead), and only once there are enough types to be worth filtering.
  const present = new Set((items ?? []).map((r) => r.kind));
  const filters: { value: Filter; label: string }[] = [
    { value: "all", label: "All types" },
    ...LAUNCHED_CATEGORIES.filter((c) => present.has(c.id as RequestKind)).map((c) => ({
      value: c.id as Filter,
      label: c.filterLabel,
    })),
  ];
  const showFilters = LAUNCHED_CATEGORIES.length >= 3 && filters.length > 2;
  const activeFilter: Filter = filters.some((f) => f.value === filter) ? filter : "all";

  const visible =
    items === null ? [] : items.filter((r) => activeFilter === "all" || r.kind === activeFilter);

  return (
    <>
    <section aria-labelledby="open-requests">
      <div className="board-head">
        {/* The selected tab already says which list this is, so the heading is for screen readers only. */}
        <h2 id="open-requests" className="visually-hidden">
          Fires
        </h2>
        <div className="sort-tabs" role="group" aria-label="Sort fires">
          {SORTS.map((s) => (
            <button
              key={s.value}
              type="button"
              className="sort-tab"
              aria-pressed={sort === s.value}
              onClick={() => {
                chosen.current = true;
                setFailed(false);
                setSort(s.value);
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
        {items === null && (
          // Holds the filter's place while requests load, so the list does not
          // jump down when the filter appears with the first cards.
          <div className="tabs-placeholder" aria-hidden="true" />
        )}
        {showFilters && isCompactPicker(LAUNCHED_CATEGORIES.length) && (
          <div className="board-select">
            <label className="board-select-label" htmlFor="board-show">
              Type
            </label>
            <select
              id="board-show"
              className="input select board-select-input"
              value={activeFilter}
              onChange={(e) => setFilter(e.target.value as Filter)}
            >
              {filters.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
        )}
        {showFilters && !isCompactPicker(LAUNCHED_CATEGORIES.length) && (
        <div className="tabs board-filter" role="group" aria-label="Filter fires">
          {filters.map((f) => (
            <button
              key={f.value}
              type="button"
              className="tab"
              aria-pressed={activeFilter === f.value}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
        )}
      </div>

      {failed ? (
        <p className="empty" role="alert">
          Couldn&apos;t load fires. Try again in a moment.
        </p>
      ) : items === null ? (
        <>
          <p className="visually-hidden" role="status">
            Loading fires
          </p>
          <ul className="request-list" aria-hidden="true">
            {[0, 1, 2].map((n) => (
              <li key={n} className="request-card request-card-skeleton">
                <div className="skeleton-sparks">
                  <span />
                  <span />
                  <span />
                </div>
                <div className="skeleton-meta" />
              </li>
            ))}
          </ul>
        </>
      ) : visible.length === 0 ? (
        <div className="empty">
          <p>{items.length === 0 ? EMPTY[sort] : "No fires of that type."}</p>
          {items.length === 0 && sort === "new" && (
            <Link className="btn btn-primary" href="/fires/new">
              Light a fire
            </Link>
          )}
        </div>
      ) : (
        <ul className="request-list">
          {visible.map((r) => (
            <li key={r.id}>
              <RequestCard request={r} now={now} />
            </li>
          ))}
        </ul>
      )}
    </section>
    </>
  );
}

function RequestCard({ request: r, now }: { request: RequestItem; now: Date }) {
  const { user } = useAuth();
  return (
    <Link href={`/fires/${r.id}`} className="request-card">
      <div className="request-card-top">
        <div className="sparks">
          {r.sparks.map((s) => (
            <span className="spark" key={s}>
              {s}
            </span>
          ))}
        </div>
      </div>
      {r.note && <p className="request-note">{r.note}</p>}
      <div className="meta">
        <span className="badge">{kindLabel(r.kind)}</span>
        <span className="by-line">
          <Avatar id={r.requesterAvatar} name={r.requesterName} size="sm" />
          Lit by {r.requesterName}, {describeAge(r.createdAt, now)}
        </span>
        {/* Counts sit at the right edge in the same order on every card: stokes (when there are any), then answers. */}
        <span className="card-counts">
          {r.stokeCount > 0 && (
            <span className="stoke-static">
              <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
                <path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 1-5 3-7 0 3 1 4 2 4-1-3-1-6 1-9z" />
              </svg>
              <span>
                <strong>{r.stokeCount}</strong> {r.stokeCount === 1 ? "stoke" : "stokes"}
              </span>
            </span>
          )}
          <AnswerCountLabel count={r.answerCount} own={r.requesterId === user?.uid} />
        </span>
      </div>
      {r.topAnswer && <TopAnswer name={r.topAnswer.name} />}
    </Link>
  );
}
