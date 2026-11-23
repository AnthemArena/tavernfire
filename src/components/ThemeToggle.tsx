"use client";

import { useEffect, useSyncExternalStore } from "react";

export const THEME_KEY = "tf-theme";
/** What the person picked. "system" follows the computer's own light or dark setting. */
type Choice = "dark" | "light" | "system";

const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function getChoice(): Choice {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "light" || saved === "system") return saved;
  } catch {
    // storage blocked: fall through to the default
  }
  return "dark";
}
function getServerChoice(): Choice {
  return "dark";
}
function apply(choice: Choice) {
  const light = choice === "light" || (choice === "system" && window.matchMedia("(prefers-color-scheme: light)").matches);
  document.documentElement.dataset.theme = light ? "light" : "dark";
}

/** Dark is the default for a first visit. The choice is remembered in this browser only. */
export default function ThemeToggle() {
  const choice = useSyncExternalStore(subscribe, getChoice, getServerChoice);

  // While following the system, switch when the computer's setting changes.
  useEffect(() => {
    if (choice !== "system") return;
    const query = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => apply("system");
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [choice]);

  function choose(next: Choice) {
    apply(next);
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
        <button type="button" aria-pressed={choice === "dark"} onClick={() => choose("dark")}>
          Dark
        </button>
        <button type="button" aria-pressed={choice === "light"} onClick={() => choose("light")}>
          Light
        </button>
        <button type="button" aria-pressed={choice === "system"} onClick={() => choose("system")}>
          System
        </button>
      </div>
    </div>
  );
}
