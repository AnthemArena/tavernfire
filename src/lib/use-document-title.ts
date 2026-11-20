import { useEffect } from "react";

/**
 * Sets the browser tab title from the page's own content (a fire's sparks, a person's
 * name). Pass null while there is nothing to show yet, and the title set by the page's
 * metadata stays. Page metadata still gives each page a sensible title before this runs.
 */
export function useDocumentTitle(title: string | null) {
  useEffect(() => {
    if (title === null) return;
    const previous = document.title;
    document.title = `${title} – Tavernfire`;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
