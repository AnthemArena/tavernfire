"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getDb } from "@/lib/firebase";
import { getCategory } from "@/lib/categories";
import { displayWord } from "@/lib/spark-suggestions";
import { matchHeading, parseSparks, searchLibrary, type LibraryResult } from "@/lib/library";

type State =
  | { status: "idle" }
  | { status: "error"; key: string }
  | { status: "ready"; key: string; results: LibraryResult[] };

const PLACEHOLDERS = ["Statue", "Time", "Glowing"];

/** Search answers by spark. The searched sparks live in the address (?s=statue,time) so a search can be shared. */
export default function LibraryView() {
  const router = useRouter();
  const params = useSearchParams();
  const searched = parseSparks(params.get("s") ?? "");
  const searchedKey = searched.join(",");

  const [boxes, setBoxes] = useState<string[]>(() => [0, 1, 2].map((i) => searched[i] ?? ""));
  const [state, setState] = useState<State>({ status: "idle" });

  useEffect(() => {
    const sparks = searchedKey === "" ? [] : searchedKey.split(",");
    if (sparks.length === 0) return;
    let cancelled = false;
    searchLibrary(getDb(), sparks)
      .then((results) => {
        if (!cancelled) setState({ status: "ready", key: searchedKey, results });
      })
      .catch((err) => {
        console.error("Library search failed", err);
        if (!cancelled) setState({ status: "error", key: searchedKey });
      });
    return () => {
      cancelled = true;
    };
  }, [searchedKey]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const sparks = parseSparks(boxes);
    if (sparks.length === 0) return;
    router.push(`/library?s=${encodeURIComponent(sparks.join(","))}`);
  }

  const typed = parseSparks(boxes);
  // Only show an outcome that belongs to the sparks now in the address (back and forward change them).
  const current = searched.length > 0 && "key" in state && state.key === searchedKey ? state : null;
  const results = current?.status === "ready" ? current.results : null;
  const loading = searched.length > 0 && current === null;

  // Group the (already ranked) results by how many sparks they share.
  const groups: { matched: number; items: LibraryResult[] }[] = [];
  for (const r of results ?? []) {
    const last = groups[groups.length - 1];
    if (last && last.matched === r.matched) last.items.push(r);
    else groups.push({ matched: r.matched, items: [r] });
  }

  return (
    <>
      <form onSubmit={onSubmit} noValidate className="library-search">
        <div className="form-row">
          {boxes.map((value, index) => (
            <div className="field field-spark" key={index}>
              <label className="label" htmlFor={`library-spark-${index}`}>
                {["Spark one", "Spark two", "Spark three"][index]}
              </label>
              <input
                id={`library-spark-${index}`}
                className="input input-spark"
                type="text"
                maxLength={30}
                autoComplete="off"
                placeholder={PLACEHOLDERS[index]}
                value={value}
                onChange={(e) => setBoxes((cur) => cur.map((b, i) => (i === index ? e.target.value : b)))}
              />
            </div>
          ))}
        </div>
        <button type="submit" className="btn btn-primary" disabled={typed.length === 0}>
          Search the library
        </button>
        <p className="hint">Use one, two or three single words. Sparks are matched exactly, so check your spelling.</p>
      </form>

      {searched.length === 0 && (
        <p className="empty">
          Type a spark or two to search. Nothing to try yet? Look through the <Link href="/">fires</Link> for
          ideas.
        </p>
      )}
      {loading && (
        <p className="muted page-note" role="status">
          Searching…
        </p>
      )}
      {current?.status === "error" && (
        <p className="empty" role="alert">
          Couldn&apos;t search right now. Please try again in a moment.
        </p>
      )}
      {results && results.length === 0 && (
        <p className="empty">
          No answers for {searched.map(displayWord).join(", ")} yet.{" "}
          <Link href="/fires/new">Light a fire</Link> and be the first to get one.
        </p>
      )}

      {groups.map((group) => (
        <section key={group.matched} className="library-group" aria-label={matchHeading(group.matched, searched.length)}>
          <h2 className="library-heading">{matchHeading(group.matched, searched.length)}</h2>
          <ul className="request-list">
            {group.items.map(({ entry, sparks }) => (
              <li key={entry.id}>
                <Link href={`/fires/${entry.requestId}`} className="request-card">
                  <div className="request-card-top">
                    <div className="sparks">
                      {sparks.map((s) => (
                        <span className={searched.includes(s) ? "spark spark-hit" : "spark"} key={s}>
                          {displayWord(s)}
                        </span>
                      ))}
                    </div>
                  </div>
                  <p className="my-answer-name">{entry.name}</p>
                  <p className="library-concept">{entry.concept}</p>
                  <div className="meta">
                    <span className="badge">{getCategory(entry.kind).label}</span>
                    <span>
                      {entry.upvoteCount} {entry.upvoteCount === 1 ? "upvote" : "upvotes"}
                    </span>
                    {entry.author && <span>by {entry.author.name}</span>}
                    {entry.traits.length > 0 && <span className="muted">{entry.traits.join(", ")}</span>}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
