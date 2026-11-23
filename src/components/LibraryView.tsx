"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import Avatar from "@/components/Avatar";
import TopAnswer from "@/components/TopAnswer";
import { useRouter, useSearchParams } from "next/navigation";
import { getDb } from "@/lib/firebase";
import { getCategory } from "@/lib/categories";
import { cloudSize, displayWord, fireCount, popularSparks, type SparkSuggestion } from "@/lib/spark-suggestions";
import { SPARK_MAX_LENGTH, normaliseSpark } from "@/lib/sparks";
import { useSparkSuggestions } from "@/lib/use-spark-suggestions";
import { matchHeading, parseSparks, searchLibrary, type LibraryResult } from "@/lib/library";
import { useNow } from "@/lib/use-now";
import { describeAge } from "@/lib/requests";

type State =
  | { status: "error"; key: string }
  | { status: "ready"; key: string; results: LibraryResult[] }
  | { status: "idle" };

const PLACEHOLDER = "Type a spark";

/** Search fires by spark. The searched sparks live in the address (?s=statue,time) so a search can be shared. */
export default function LibraryView() {
  const router = useRouter();
  const now = useNow();
  const params = useSearchParams();
  // One spark at a time: an older link with several sparks searches the first.
  const searched = parseSparks(params.get("s") ?? "").slice(0, 1);
  const searchedKey = searched.join(",");

  // What is in the three boxes. After a search (or a click on a spark in the cloud) the boxes show
  // what was searched; typing replaces them for as long as the address stays the same.
  const [typedBoxes, setTypedBoxes] = useState<{ key: string; boxes: string[] } | null>(null);
  const boxes =
    typedBoxes && typedBoxes.key === searchedKey
      ? typedBoxes.boxes
      : [searched[0] ? displayWord(searched[0]) : ""];
  const setBoxes = (update: (cur: string[]) => string[]) => setTypedBoxes({ key: searchedKey, boxes: update(boxes) });
  const [state, setState] = useState<State>({ status: "idle" });
  const { focused, setFocused, suggestions, typed } = useSparkSuggestions(boxes);

  // The most used sparks, shown as a cloud when nothing is searched.
  const [cloud, setCloud] = useState<SparkSuggestion[]>([]);
  const [cloudLoaded, setCloudLoaded] = useState(false);
  useEffect(() => {
    let cancelled = false;
    popularSparks(getDb())
      .then((found) => {
        if (!cancelled) {
          setCloud(found);
          setCloudLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) setCloudLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // Nothing searched means nothing to load: the page shows the search box and the popular sparks.
    if (searchedKey === "") return;
    const sparks = searchedKey.split(",");
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
    if (sparks.length === 0) {
      document.getElementById("library-spark-0")?.focus();
      return;
    }
    router.push(`/library?s=${encodeURIComponent(sparks.join(","))}`);
  }

  // With one box, choosing a suggested spark is the search: no second click on Search.
  function pick(word: string) {
    const norm = normaliseSpark(word);
    setBoxes(() => [displayWord(word)]);
    setFocused(null);
    router.push(`/library?s=${encodeURIComponent(norm)}`);
  }

  // Only show an outcome that belongs to the sparks now in the address (back and forward change them).
  const searching = searched.length > 0;
  const current = "key" in state && state.key === searchedKey ? state : null;
  const results = searching && current?.status === "ready" ? current.results : null;
  const loading = searching && current === null;

  // Group the (already ranked) results by how many sparks they share. Browsing is one group.
  const groups: { matched: number; items: LibraryResult[] }[] = [];
  for (const r of results ?? []) {
    const last = groups[groups.length - 1];
    if (last && last.matched === r.matched) last.items.push(r);
    else groups.push({ matched: r.matched, items: [r] });
  }

  const biggest = cloud.reduce((max, s) => Math.max(max, s.count), 0);

  const cloudBlock = cloud.length > 0 ? (
        <>
        <h2 className={searching ? "library-heading cloud-after-results" : "library-heading"}>Popular sparks</h2>
        <p className="hint cloud-hint">Pick a spark to see its fires.</p>
        <nav className="spark-cloud" aria-label="Popular sparks">
          {[...cloud]
            .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word, "en"))
            .map((s) => (
              <Link
                key={s.word}
                href={`/library?s=${encodeURIComponent(s.word)}`}
                className={`cloud-spark cloud-${cloudSize(s.count, biggest)}`}
                title={fireCount(s.count)}
              >
                {displayWord(s.word)} <span className="cloud-count">{s.count}</span>
              </Link>
            ))}
        </nav>
        </>
  ) : null;

  return (
    <>
      <form onSubmit={onSubmit} noValidate className="library-search">
        <p className="label" id="library-sparks-label">
          Search by spark
        </p>
        <div className="library-search-row" role="group" aria-labelledby="library-sparks-label">
          {boxes.map((value, index) => (
            <div className="field field-spark" key={index}>
              <label className="visually-hidden" htmlFor={`library-spark-${index}`}>
                Spark
              </label>
              <input
                id={`library-spark-${index}`}
                className="input input-spark"
                type="text"
                maxLength={SPARK_MAX_LENGTH}
                autoComplete="off"
                placeholder={PLACEHOLDER}
                value={value}
                onChange={(e) => setBoxes((cur) => cur.map((b, i) => (i === index ? e.target.value : b)))}
                onFocus={() => setFocused(index)}
                onBlur={() => setFocused((c) => (c === index ? null : c))}
              />
            </div>
          ))}
          <button type="submit" className="btn btn-primary">
            Search
          </button>
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
                onClick={() => pick(s.word)}
              >
                {displayWord(s.word)} <span className="muted">· {fireCount(s.count)}</span>
              </button>
            ))}
          </div>
        )}
        {/\s/.test(boxes[0]?.trim() ?? "") ? (
          <p className="hint" role="status">
            Sparks are single words. Search one at a time.
          </p>
        ) : (
          <p className="hint">One word, like Statue or Lantern.</p>
        )}
      </form>

      {!searching && cloudBlock}

      {!searching && cloudLoaded && cloud.length === 0 && (
        <p className="empty">
          No sparks yet. <Link href="/fires/new">Light the first fire</Link>.
        </p>
      )}
      {loading && (
        <p className="muted page-note" role="status">
          Searching…
        </p>
      )}
      {current?.status === "error" && (
        <p className="empty" role="alert">
          Couldn&apos;t load the library right now. Please try again in a moment.
        </p>
      )}
      {results && results.length === 0 && searching && (
        <div className="empty">
          <p className="empty-line">No fires use {displayWord(searched[0])} yet.</p>
          <Link href={`/fires/new?s=${encodeURIComponent(searched.join(","))}`} className="btn btn-primary">
            Light a fire with this spark
          </Link>
        </div>
      )}

      {groups.map((group) => {
        const heading =
          searched.length === 1
            ? `${group.items.length} ${group.items.length === 1 ? "fire" : "fires"} with the spark ${displayWord(searched[0])}`
            : matchHeading(group.matched, searched.length);
        return (
          <section key={group.matched} className="library-group" aria-label={heading}>
            <h2 className="library-heading">{heading}</h2>
            {searched.length === 1 && (
              <p className="hint">
                <Link href={`/fires/new?s=${encodeURIComponent(searched[0])}`}>Light a fire with this spark</Link>
              </p>
            )}
            <ul className="request-list">
              {group.items.map(({ fire }) => (
                <li key={fire.id}>
                  <div className="request-card request-card-linked">
                    <Link
                      href={`/fires/${fire.id}`}
                      className="card-cover"
                      aria-label={`Open the fire ${fire.sparks.join(", ")}`}
                    />
                    <div className="request-card-top">
                      <div className="sparks">
                        {fire.sparks.map((s) => (
                          <Link
                            className={
                              searched.includes(normaliseSpark(s)) ? "spark spark-hit spark-link" : "spark spark-link"
                            }
                            href={`/library?s=${encodeURIComponent(normaliseSpark(s))}`}
                            title={`See fires with the spark ${s}`}
                            key={s}
                          >
                            {s}
                          </Link>
                        ))}
                      </div>
                    </div>
                    <div className="meta">
                      <span className="badge">{getCategory(fire.kind).label}</span>
                      <span className="by-line">
                        <Avatar id={fire.requesterAvatar} name={fire.requesterName} size="sm" />
                        Lit by {fire.requesterName}, {describeAge(fire.createdAt, now)}
                      </span>
                      <span className="card-counts">
                        {fire.stokeCount > 0 && (
                          <span>
                            <strong>{fire.stokeCount}</strong> {fire.stokeCount === 1 ? "stoke" : "stokes"}
                          </span>
                        )}
                        <span>
                          {fire.answerCount === 0 ? (
                            "No answers yet"
                          ) : (
                            <>
                              <strong>{fire.answerCount}</strong> {fire.answerCount === 1 ? "answer" : "answers"}
                            </>
                          )}
                        </span>
                      </span>
                    </div>
                    {fire.topAnswer && <TopAnswer name={fire.topAnswer.name} snippet={fire.topAnswer.snippet} lines={1} />}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {searching && !loading && cloudBlock}
    </>
  );
}
