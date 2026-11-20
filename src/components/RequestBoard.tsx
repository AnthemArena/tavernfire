"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
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
import AnswerCount from "@/components/AnswerCount";
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
  { value: "top", label: "Top" },
  { value: "new", label: "New" },
];

const HEADINGS: Record<Sort, string> = {
  trending: "Trending fires",
  top: "Most stoked fires",
  new: "New fires",
};

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
    { value: "all", label: "All" },
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
        <h2 id="open-requests" className="section-title">
          {HEADINGS[sort]}
        </h2>
        <div className="tabs" role="group" aria-label="Sort fires">
          {SORTS.map((s) => (
            <button
              key={s.value}
              type="button"
              className="tab"
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
              Show
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
        <div className="tabs" role="group" aria-label="Filter fires">
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
          Couldn&apos;t load fires right now. Please try again in a moment.
        </p>
      ) : items === null ? (
        <p className="empty" role="status">
          Loading fires…
        </p>
      ) : visible.length === 0 ? (
        <p className="empty">
          {items.length === 0
            ? EMPTY[sort]
            : "No fires of that type right now."}
        </p>
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
        {r.stokeCount > 0 && (
          <span className="stoke-static">
            <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
              <path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 1-5 3-7 0 3 1 4 2 4-1-3-1-6 1-9z" />
            </svg>
            {r.stokeCount} {r.stokeCount === 1 ? "stoke" : "stokes"}
          </span>
        )}
        <AnswerCount requestId={r.id} own={r.requesterId === user?.uid} />
      </div>
    </Link>
  );
}
