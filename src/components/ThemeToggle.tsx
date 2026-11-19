"use client";

import { useSyncExternalStore } from "react";

export const THEME_KEY = "tf-theme";
type Theme = "dark" | "light";

const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
// The page script has already put the saved theme on <html> before React runs.
function getTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}
function getServerTheme(): Theme {
  return "dark";
}

/** Dark is the default. The choice is remembered in this browser only. */
export default function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getTheme, getServerTheme);

  function choose(next: Theme) {
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // private browsing: the choice just lasts for this visit
    }
    listeners.forEach((l) => l());
  }

  return (
    <div className="theme-switch" role="group" aria-label="Colour theme">
      <span className="theme-switch-label" aria-hidden="true">
        Theme
      </span>
      <div className="theme-switch-group">
        <button type="button" aria-pressed={theme === "dark"} onClick={() => choose("dark")}>
          Dark
        </button>
        <button type="button" aria-pressed={theme === "light"} onClick={() => choose("light")}>
          Light
        </button>
      </div>
    </div>
  );
}
