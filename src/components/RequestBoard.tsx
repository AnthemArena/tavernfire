"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
import TimeLeft from "@/components/TimeLeft";
import {
  KIND_LABELS,
  toRequestItem,
  type RequestItem,
  type RequestKind,
} from "@/lib/requests";

type Filter = "all" | RequestKind;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "npc", label: "NPCs" },
  { value: "location", label: "Locations" },
];

export default function RequestBoard() {
  const [items, setItems] = useState<RequestItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const now = useNow();

  useEffect(() => {
    const q = query(
      collection(getDb(), "requests"),
      where("moderation", "==", "ok"),
      where("status", "==", "open"),
      orderBy("createdAt", "desc"),
      limit(30),
    );
    return onSnapshot(
      q,
      (snapshot) => {
        setItems(
          snapshot.docs
            .map((d) =>
              // "estimate" fills in createdAt for a request we just posted,
              // before the server has confirmed the time.
              toRequestItem(d.id, d.data({ serverTimestamps: "estimate" })),
            )
            .filter((item): item is RequestItem => item !== null),
        );
        setFailed(false);
      },
      (err) => {
        console.error("Could not load requests", err);
        setFailed(true);
      },
    );
  }, []);

  const visible =
    items === null ? [] : items.filter((r) => filter === "all" || r.kind === filter);

  return (
    <section aria-labelledby="open-requests">
      <div className="board-head">
        <h2 id="open-requests" className="section-title">
          Open requests
        </h2>
        <div className="tabs" role="group" aria-label="Filter requests">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              className="tab"
              aria-pressed={filter === f.value}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {failed ? (
        <p className="empty" role="alert">
          Couldn&apos;t load requests right now. Please try again in a moment.
        </p>
      ) : items === null ? (
        <p className="empty" role="status">
          Loading requests…
        </p>
      ) : visible.length === 0 ? (
        <p className="empty">
          {items.length === 0
            ? "No open requests yet. Be the first to post one."
            : "No requests of that type right now."}
        </p>
      ) : (
        <ul className="request-list">
          {visible.map((r) => (
            <li key={r.id}>
              <Link href={`/requests/${r.id}`} className="request-card">
                <div className="request-card-top">
                  <div className="sparks">
                    {r.sparks.map((s) => (
                      <span className="spark" key={s}>
                        {s}
                      </span>
                    ))}
                  </div>
                  <span className="badge">{KIND_LABELS[r.kind]}</span>
                </div>
                {r.note && <p className="request-note">{r.note}</p>}
                <div className="meta">
                  <span>
                    <strong>{r.answerCount}</strong>{" "}
                    {r.answerCount === 1 ? "answer" : "answers"}
                  </span>
                  <span>Posted by {r.requesterName}</span>
                  <TimeLeft createdAt={r.createdAt} now={now} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
