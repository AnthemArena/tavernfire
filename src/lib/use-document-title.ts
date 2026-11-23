import { useEffect } from "react";

/**
 * Sets the browser tab title from the page's own content (a fire's sparks, a person's
 * name). Pass null while there is nothing to show yet, and the title set by the page's
 * metadata stays. Page metadata still gives each page a sensible title before this runs.
 */
export function useDocumentTitle(title: string | null) {
  useEffect(() => {
    if (title === null) return;
    // Not put back on leaving: the next page sets its own title, and restoring the old one
    // here could land after it and leave a stale title in the tab.
    document.title = `${title} – Tavernfire`;
  }, [title]);
}
