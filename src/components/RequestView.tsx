"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { doc, onSnapshot } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { useNow } from "@/lib/use-now";
import TimeLeft from "@/components/TimeLeft";
import Answers from "@/components/Answers";
import {
  kindLabel,
  toRequestItem,
  type RequestItem,
} from "@/lib/requests";

type State =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "ready"; request: RequestItem };

export default function RequestView({ id }: { id: string }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const now = useNow();

  useEffect(() => {
    return onSnapshot(
      doc(getDb(), "requests", id),
      (snapshot) => {
        const request = snapshot.exists()
          ? toRequestItem(snapshot.id, snapshot.data({ serverTimestamps: "estimate" }))
          : null;
        setState(request ? { status: "ready", request } : { status: "missing" });
      },
      (err) => {
        // A request that is hidden or doesn't exist is refused the same way.
        console.error("Could not load request", err);
        setState({ status: "missing" });
      },
    );
  }, [id]);

  if (state.status === "loading") {
    return (
      <p className="muted page-note" role="status">
        Loading…
      </p>
    );
  }

  if (state.status === "missing") {
    return (
      <div className="page-note">
        <h1 className="section-title">Request not found</h1>
        <p className="muted">
          It may have been removed, or the link may be wrong.{" "}
          <Link href="/">Back to all requests</Link>
        </p>
      </div>
    );
  }

  const r = state.request;

  return (
    <article className="request-page">
      <Link href="/" className="back-link">
        ← All requests
      </Link>

      <p className="kicker">The three sparks</p>
      <h1 className="visually-hidden">
        Request: {r.sparks.join(", ")}
      </h1>
      <div className="sparks sparks-large" aria-hidden="true">
        {r.sparks.map((s) => (
          <span className="spark spark-large" key={s}>
            {s}
          </span>
        ))}
      </div>

      {r.note && <p className="request-lede">{r.note}</p>}

      <div className="meta">
        <span className="badge">{kindLabel(r.kind)}</span>
        <span>Posted by {r.requesterName}</span>
        <TimeLeft createdAt={r.createdAt} now={now} />
      </div>

      <Answers request={r} />
    </article>
  );
}
