"use client";

import { useEffect, useState } from "react";
import { collection, getCountFromServer, query, where } from "firebase/firestore";
import { getDb } from "@/lib/firebase";

/**
 * How many answers a request has, counted from its entries. `own` is true on the viewer's own fire. (The count stored on
 * the request is not kept up to date yet; that needs a Cloud Function.)
 * It is counted once when the card appears, not live.
 */
export default function AnswerCount({ requestId, own = false }: { requestId: string; own?: boolean }) {
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

  // Nothing until the count is known, so the row does not change shape when it arrives.
  if (count === null) return null;
  return <AnswerCountLabel count={count} own={own} />;
}

/** The words for a known answer count. On your own fire "be the first" would be an invitation you cannot accept. */
export function AnswerCountLabel({ count, own = false }: { count: number; own?: boolean }) {
  if (count === 0) return <span>{own ? "No answers yet." : "No answers yet. Be the first."}</span>;
  return (
    <span>
      <strong>{count}</strong> {count === 1 ? "answer" : "answers"}
    </span>
  );
}
