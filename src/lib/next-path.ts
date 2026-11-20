/**
 * Where to send someone after they sign in. The sign-in link carries the page they were
 * on as ?next=, so a visitor who taps "upvote" or "stoke" comes back to the same fire.
 * Only a path on this site is accepted (it must start with one slash), so the link can
 * never send anyone to another website.
 */
export function safeNext(raw: string | null | undefined): string {
  if (typeof raw !== "string") return "/";
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return "/";
  if (raw === "/signin" || raw.startsWith("/signin?") || raw.startsWith("/signin/")) return "/";
  if (/[\u0000-\u001f]/.test(raw)) return "/";
  return raw;
}

/** The sign-in link for a page: /signin, plus ?next= when it is anywhere but the home page. */
export function signInHref(path: string | null | undefined): string {
  const next = safeNext(path);
  return next === "/" ? "/signin" : `/signin?next=${encodeURIComponent(next)}`;
}
