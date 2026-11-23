"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { collection, deleteDoc, doc, getDoc, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import Avatar from "@/components/Avatar";
import { getDb } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { signInHref } from "@/lib/next-path";
import { normaliseSpark } from "@/lib/sparks";
import { shownUpvotes, upvoteId, type PendingUpvote } from "@/lib/upvotes";
import UpArrow from "@/components/UpArrow";
import TypeFilter, { type TypeFilterValue } from "@/components/TypeFilter";
import VerifyEmailNotice from "@/components/VerifyEmailNotice";
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
  const [filter, setFilter] = useState<TypeFilterValue>("all");
  const [max, setMax] = useState(PAGE_SIZE);
  const [loaded, setLoaded] = useState<{ sort: Sort; max: number; full: boolean; items: EntryItem[] } | null>(null);
  // The fires the answers belong to, looked up once each. A fire that can't be read (hidden) is null.
  const [fires, setFires] = useState<Record<string, RequestItem | null>>({});
  const [failed, setFailed] = useState(false);
  const now = useNow();
  const { user, emailVerified } = useAuth();
  const pathname = usePathname();
  const uid = user?.uid ?? null;
  // The answers this person has upvoted (any fire), and changes still saving.
  const [myUpvotes, setMyUpvotes] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Record<string, PendingUpvote>>({});
  const [signInPrompt, setSignInPrompt] = useState(false);
  const [needVerify, setNeedVerify] = useState(false);
  const [voteError, setVoteError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      query(collection(getDb(), "upvotes"), where("voterId", "==", uid)),
      (snap) => setMyUpvotes(new Set(snap.docs.map((d) => d.get("entryId") as string))),
      (err) => console.error("Could not load your upvotes", err),
    );
  }, [uid]);

  async function toggleUpvote(entry: EntryItem) {
    if (!user) {
      setSignInPrompt(true);
      return;
    }
    if (!emailVerified) {
      setNeedVerify(true);
      return;
    }
    const has = myUpvotes.has(entry.id);
    setVoteError(null);
    setPending((p) => ({ ...p, [entry.id]: { delta: has ? -1 : 1, base: entry.upvoteCount } }));
    try {
      const ref = doc(getDb(), "upvotes", upvoteId(entry.id, user.uid));
      if (has) {
        await deleteDoc(ref);
      } else {
        await setDoc(ref, { entryId: entry.id, requestId: entry.requestId, voterId: user.uid, createdAt: serverTimestamp() });
      }
    } catch (err) {
      console.error("Could not save upvote", err);
      setPending((p) => {
        const rest = { ...p };
        delete rest[entry.id];
        return rest;
      });
      setVoteError("Couldn't save your upvote. Check your connection and try again.");
    }
  }

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
  const withFire = ready ? items.filter((e) => fires[e.requestId] != null) : [];
  const visible = withFire.filter((e) => filter === "all" || e.kind === filter);

  return (
    <section className="answers-feed" aria-labelledby="answers-feed-title">
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
      <TypeFilter value={filter} onChange={setFilter} label="Filter answers" idPrefix="answers" />

      {signInPrompt && !user && (
        <p className="notice notice-plain" role="status">
          <Link href={signInHref(pathname)}>Sign in</Link> to upvote answers.
        </p>
      )}
      {needVerify && !emailVerified && <VerifyEmailNotice action="upvote answers" />}
      {voteError && (
        <p className="error" role="alert">
          {voteError}
        </p>
      )}

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
          <p>{withFire.length === 0 ? "No answers yet. Find a fire and be the first." : "No answers of that type yet."}</p>
          <Link className="btn btn-primary" href="/">
            Browse fires
          </Link>
        </div>
      ) : (
        <ul className="answer-feed">
          {visible.map((e) => {
            const fire = fires[e.requestId] as RequestItem;
            const votes = shownUpvotes(e.upvoteCount, pending[e.id]);
            return (
              <li key={e.id} className="card answer-feed-card">
                <div className="entry-vote">
                  {e.author?.id !== uid || uid === null ? (
                    <button
                      type="button"
                      className={myUpvotes.has(e.id) ? "vote-btn vote-btn-on" : "vote-btn"}
                      aria-pressed={myUpvotes.has(e.id)}
                      title="A good answer."
                      aria-label={`Upvote this answer, ${votes} ${votes === 1 ? "upvote" : "upvotes"}`}
                      onClick={() => void toggleUpvote(e)}
                    >
                      <UpArrow />
                      <span>{votes}</span>
                    </button>
                  ) : (
                    <span
                      className="vote-static"
                      role="img"
                      title="You can't upvote your own answer"
                      aria-label={`${votes} ${votes === 1 ? "upvote" : "upvotes"}. You can't upvote your own answer`}
                    >
                      <UpArrow />
                      <span>{votes}</span>
                    </span>
                  )}
                </div>
                <div className="answer-feed-body">
                  <p className="hint">
                    <span className="badge">{kindLabel(e.kind)}</span>
                  </p>
                  <h3 className="answer-feed-name">
                    <Link href={`/fires/${e.requestId}#entry-${e.id}`}>{e.name}</Link>
                  </h3>
                  <div className="answer-feed-sparks-row">
                    {fire.sparks.map((sp) => (
                      <Link
                        key={sp}
                        className="spark spark-link"
                        href={`/library?s=${encodeURIComponent(normaliseSpark(sp))}`}
                        title={`See fires with the spark ${sp}`}
                      >
                        {sp}
                      </Link>
                    ))}
                  </div>
                  <p className="answer-feed-concept">{e.concept}</p>
                  <div className="answer-feed-foot">
                    {e.author && (
                      <span className="answer-feed-author">
                        <Avatar id={e.author.avatar} name={e.author.name} size="sm" />
                        <span>
                          Answered by <Link href={`/profile/${e.author.id}`}>{e.author.name}</Link>
                          {e.createdAt && <span className="answer-feed-age">, {describeAge(e.createdAt, now)}</span>}
                        </span>
                      </span>
                    )}
                    <Link className="answer-feed-link" href={`/fires/${e.requestId}#entry-${e.id}`}>
                      See this fire
                    </Link>
                  </div>
                  <p className="hint">
                    Lit by {fire.requesterName}
                    {/* The fire's age only when it says something the answer's age does not. */}
                    {describeAge(fire.createdAt, now) !== (e.createdAt ? describeAge(e.createdAt, now) : null) &&
                      `, ${describeAge(fire.createdAt, now)}`}
                  </p>
                </div>
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
