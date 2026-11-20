"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { useAuth } from "@/lib/auth-context";
import { shownStokes, stokeId, type PendingStoke } from "@/lib/stokes";
import VerifyEmailNotice from "@/components/VerifyEmailNotice";
import { getDb } from "@/lib/firebase";
import { useNow } from "@/lib/use-now";
import PhaseLabel from "@/components/PhaseLabel";
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

function Flame() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 1-5 3-7 0 3 1 4 2 4-1-3-1-6 1-9z" />
    </svg>
  );
}

export default function RequestView({ id }: { id: string }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const now = useNow();
  const router = useRouter();
  const { user, emailVerified } = useAuth();
  const uid = user?.uid ?? null;
  const [stoked, setStoked] = useState(false);
  const [pending, setPending] = useState<PendingStoke | undefined>(undefined);
  const [needVerify, setNeedVerify] = useState(false);
  const [stokeError, setStokeError] = useState<string | null>(null);

  // Whether I have stoked this fire. Only I can read it.
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      doc(getDb(), "stokes", stokeId(id, uid)),
      (snap) => setStoked(snap.exists()),
      (err) => console.error("Could not check your stoke", err),
    );
  }, [id, uid]);

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
        <h1 className="section-title">Fire not found</h1>
        <p className="muted">
          It may have been removed, or the link may be wrong.{" "}
          <Link href="/">Back to Fires</Link>
        </p>
      </div>
    );
  }

  const r = state.request;
  const stokes = shownStokes(r.stokeCount, pending);
  const isOwnFire = uid !== null && uid === r.requesterId;

  async function toggleStoke() {
    if (!user) {
      router.push("/signin");
      return;
    }
    if (!emailVerified) {
      setNeedVerify(true);
      return;
    }
    setStokeError(null);
    setPending({ delta: stoked ? -1 : 1, base: r.stokeCount });
    try {
      const ref = doc(getDb(), "stokes", stokeId(r.id, user.uid));
      if (stoked) {
        await deleteDoc(ref);
      } else {
        await setDoc(ref, { requestId: r.id, voterId: user.uid, createdAt: serverTimestamp() });
      }
    } catch (err) {
      console.error("Could not save stoke", err);
      setPending(undefined);
      setStokeError("Couldn't save that. Check your connection and try again.");
    }
  }

  return (
    <article className="request-page">
      <Link href="/" className="back-link">
        ← Fires
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
        <PhaseLabel request={r} now={now} />
        {isOwnFire ? (
          <span className="stoke-static">
            <Flame />
            {stokes} {stokes === 1 ? "stoke" : "stokes"}
          </span>
        ) : (
          <button
            type="button"
            className={stoked ? "stoke-btn stoke-btn-on" : "stoke-btn"}
            aria-pressed={stoked}
            aria-label={`Stoke this fire, ${stokes} ${stokes === 1 ? "stoke" : "stokes"}`}
            onClick={() => void toggleStoke()}
          >
            <Flame />
            <span>{stoked ? "Stoked" : "Stoke this fire"}</span>
            <span className="stoke-count">{stokes}</span>
          </button>
        )}
      </div>
      {needVerify && !emailVerified && <VerifyEmailNotice action="stoke fires" />}
      {stokeError && (
        <p className="error" role="alert">
          {stokeError}
        </p>
      )}

      <Answers request={r} />
    </article>
  );
}
