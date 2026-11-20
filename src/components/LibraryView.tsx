"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getDb } from "@/lib/firebase";
import { getCategory } from "@/lib/categories";
import { cloudSize, displayWord, fireCount, popularSparks, type SparkSuggestion } from "@/lib/spark-suggestions";
import { normaliseSpark } from "@/lib/sparks";
import { useSparkSuggestions } from "@/lib/use-spark-suggestions";
import { browseLibrary, matchHeading, parseSparks, searchLibrary, type LibraryResult } from "@/lib/library";

type State =
  | { status: "error"; key: string }
  | { status: "ready"; key: string; results: LibraryResult[] }
  | { status: "idle" };

const PLACEHOLDERS = ["Statue", "Time", "Glowing"];

/** Search fires by spark. The searched sparks live in the address (?s=statue,time) so a search can be shared. */
export default function LibraryView() {
  const router = useRouter();
  const params = useSearchParams();
  const searched = parseSparks(params.get("s") ?? "");
  const searchedKey = searched.join(",");

  // What is in the three boxes. After a search (or a click on a spark in the cloud) the boxes show
  // what was searched; typing replaces them for as long as the address stays the same.
  const [typedBoxes, setTypedBoxes] = useState<{ key: string; boxes: string[] } | null>(null);
  const boxes =
    typedBoxes && typedBoxes.key === searchedKey
      ? typedBoxes.boxes
      : [0, 1, 2].map((i) => (searched[i] ? displayWord(searched[i]) : ""));
  const setBoxes = (update: (cur: string[]) => string[]) => setTypedBoxes({ key: searchedKey, boxes: update(boxes) });
  const [state, setState] = useState<State>({ status: "idle" });
  const { focused, setFocused, suggestions, typed } = useSparkSuggestions(boxes);

  // The most used sparks, shown as a cloud when nothing is searched.
  const [cloud, setCloud] = useState<SparkSuggestion[]>([]);
  useEffect(() => {
    let cancelled = false;
    popularSparks(getDb())
      .then((found) => {
        if (!cancelled) setCloud(found);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const sparks = searchedKey === "" ? [] : searchedKey.split(",");
    let cancelled = false;
    (sparks.length === 0 ? browseLibrary(getDb()) : searchLibrary(getDb(), sparks))
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
    if (sparks.length === 0) {
      document.getElementById("library-spark-0")?.focus();
      return;
    }
    router.push(`/library?s=${encodeURIComponent(sparks.join(","))}`);
  }

  function pick(index: number, word: string) {
    setBoxes((cur) => cur.map((b, i) => (i === index ? displayWord(word) : b)));
  }

  // Only show an outcome that belongs to the sparks now in the address (back and forward change them).
  const current = "key" in state && state.key === searchedKey ? state : null;
  const results = current?.status === "ready" ? current.results : null;
  const loading = current === null;
  const searching = searched.length > 0;

  // Group the (already ranked) results by how many sparks they share. Browsing is one group.
  const groups: { matched: number; items: LibraryResult[] }[] = [];
  for (const r of results ?? []) {
    const last = groups[groups.length - 1];
    if (last && last.matched === r.matched) last.items.push(r);
    else groups.push({ matched: r.matched, items: [r] });
  }

  const biggest = cloud.reduce((max, s) => Math.max(max, s.count), 0);

  return (
    <>
      <form onSubmit={onSubmit} noValidate className="library-search">
        <p className="label" id="library-sparks-label">
          Sparks
        </p>
        <div className="form-row" role="group" aria-labelledby="library-sparks-label">
          {boxes.map((value, index) => (
            <div className="field field-spark" key={index}>
              <label className="visually-hidden" htmlFor={`library-spark-${index}`}>
                Spark {index + 1}
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
                onFocus={() => setFocused(index)}
                onBlur={() => setFocused((c) => (c === index ? null : c))}
              />
            </div>
          ))}
        </div>
        {focused !== null && suggestions.length > 0 && (
          <div className="spark-suggestions" role="group" aria-label="Sparks already in use">
            <span className="muted">{typed.trim() === "" ? "Popular sparks:" : "Already in use:"}</span>
            {suggestions.map((s) => (
              <button
                type="button"
                key={s.word}
                className="spark-suggestion"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(focused, s.word)}
              >
                {displayWord(s.word)} <span className="muted">· {fireCount(s.count)}</span>
              </button>
            ))}
          </div>
        )}
        <button type="submit" className="btn btn-primary">
          Search
        </button>
        <p className="hint">Search one, two or three sparks.</p>
      </form>

      {!searching && cloud.length > 0 && (
        <>
        <h2 className="library-heading">Popular sparks</h2>
        <nav className="spark-cloud" aria-label="Popular sparks">
          {[...cloud]
            .sort((a, b) => a.word.localeCompare(b.word, "en"))
            .map((s) => (
              <Link
                key={s.word}
                href={`/library?s=${encodeURIComponent(s.word)}`}
                className={`cloud-spark cloud-${cloudSize(s.count, biggest)}`}
                title={fireCount(s.count)}
              >
                {displayWord(s.word)}
              </Link>
            ))}
        </nav>
        </>
      )}

      {loading && (
        <p className="muted page-note" role="status">
          {searching ? "Searching…" : "Loading…"}
        </p>
      )}
      {current?.status === "error" && (
        <p className="empty" role="alert">
          Couldn&apos;t load the library right now. Please try again in a moment.
        </p>
      )}
      {results && results.length === 0 && !searching && (
        <p className="empty">
          No fires yet. <Link href="/fires/new">Light the first one</Link>.
        </p>
      )}
      {results && results.length === 0 && searching && (
        <p className="empty">
          No fires with those sparks yet. <Link href="/fires/new">Light one</Link>.
        </p>
      )}

      {groups.map((group) => {
        const heading = searching ? matchHeading(group.matched, searched.length) : "Most stoked fires";
        return (
          <section key={group.matched} className="library-group" aria-label={heading}>
            <h2 className="library-heading">{heading}</h2>
            <ul className="request-list">
              {group.items.map(({ fire }) => (
                <li key={fire.id}>
                  <Link href={`/fires/${fire.id}`} className="request-card">
                    <div className="request-card-top">
                      <div className="sparks">
                        {fire.sparks.map((s) => (
                          <span
                            className={searched.includes(normaliseSpark(s)) ? "spark spark-hit" : "spark"}
                            key={s}
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="meta">
                      <span className="badge">{getCategory(fire.kind).label}</span>
                      <span>Lit by {fire.requesterName}</span>
                      {fire.stokeCount > 0 && (
                        <span>
                          {fire.stokeCount} {fire.stokeCount === 1 ? "stoke" : "stokes"}
                        </span>
                      )}
                      <span>
                        {fire.answerCount === 0
                          ? "No answers yet"
                          : `${fire.answerCount} ${fire.answerCount === 1 ? "answer" : "answers"}`}
                      </span>
                    </div>
                    {fire.topAnswer && (
                      <>
                        <p className="my-answer-name">{fire.topAnswer.name}</p>
                        <p className="library-concept">{fire.topAnswer.snippet}</p>
                      </>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}
