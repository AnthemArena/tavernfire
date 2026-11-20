import { useEffect, useState } from "react";
import { getDb } from "./firebase";
import { findSparks, type SparkSuggestion } from "./spark-suggestions";

/**
 * Suggestions of sparks already in use for whichever spark box has the cursor.
 * `values` are the words in the boxes (the ones already chosen are left out).
 */
export function useSparkSuggestions(values: string[]) {
  const [focused, setFocused] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<SparkSuggestion[]>([]);
  const typed = focused === null ? "" : (values[focused] ?? "");

  useEffect(() => {
    if (focused === null) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      findSparks(getDb(), typed, values)
        .then((found) => {
          if (!cancelled) setSuggestions(found);
        })
        .catch(() => {
          if (!cancelled) setSuggestions([]);
        });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // `values` is read for the words to leave out; typing in a box already changes `typed`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focused, typed]);

  return { focused, setFocused, suggestions: focused === null ? [] : suggestions, typed };
}
