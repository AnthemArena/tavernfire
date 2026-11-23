import { useEffect, useState } from "react";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { getDb } from "./firebase";
import { buildSparkFields } from "./sparks";

/**
 * Fires that already use exactly these three sparks (in any order), so the form can say so
 * before someone lights a copy. Empty until all three boxes hold valid, different words.
 * A lookup that fails just shows nothing: the warning is a courtesy, never a block.
 */
export function useExistingFires(values: string[]) {
  const [found, setFound] = useState<{ key: string; ids: string[] } | null>(null);

  let key: string | null = null;
  try {
    key = buildSparkFields(values).sparkKey;
  } catch {
    key = null;
  }

  useEffect(() => {
    if (key === null) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      getDocs(
        query(
          collection(getDb(), "requests"),
          where("sparkKey", "==", key),
          where("moderation", "==", "ok"),
          limit(3),
        ),
      )
        .then((snap) => {
          if (!cancelled) setFound({ key, ids: snap.docs.map((d) => d.id) });
        })
        .catch(() => {
          if (!cancelled) setFound(null);
        });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [key]);

  return key !== null && found?.key === key ? found.ids : [];
}
