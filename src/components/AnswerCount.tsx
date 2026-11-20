"use client";

import { useEffect, useState } from "react";
import { collection, getCountFromServer, query, where } from "firebase/firestore";
import { getDb } from "@/lib/firebase";

/**
 * How many answers a request has, counted from its entries. (The count stored on
 * the request is not kept up to date yet; that needs a Cloud Function.)
 * It is counted once when the card appears, not live.
 */
export default function AnswerCount({ requestId }: { requestId: string }) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCountFromServer(
      query(
        collection(getDb(), "entries"),
        where("requestId", "==", requestId),
        where("moderation", "==", "ok"),
      ),
    )
      .then((snap) => {
        if (!cancelled) setCount(snap.data().count);
      })
      .catch((err) => console.error("Could not count answers", err));
    return () => {
      cancelled = true;
    };
  }, [requestId]);

  if (count === null) return <span className="muted">Answers…</span>;
  if (count === 0) return <span>No answers yet. Be the first.</span>;
  return (
    <span>
      <strong>{count}</strong> {count === 1 ? "answer" : "answers"}
    </span>
  );
}
