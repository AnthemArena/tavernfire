"use client";

import { useSyncExternalStore } from "react";

// The current time, refreshed once a minute, for labels such as "2 days left".
// It is read through useSyncExternalStore so nothing time-dependent is computed
// while the page is prerendered (Next.js does not allow that).

function subscribe(onChange: () => void) {
  const timer = setInterval(onChange, 60_000);
  return () => clearInterval(timer);
}

// Rounded to the minute so the value stays stable between renders.
function getSnapshot() {
  return Math.floor(Date.now() / 60_000) * 60_000;
}

function getServerSnapshot() {
  return 0;
}

export function useNow(): Date {
  const ms = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return new Date(ms);
}
