"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useNotifications } from "@/lib/notifications-context";
import NotificationIcon from "@/components/NotificationIcon";

const SHOW_MS = 6000;

/** The popups: a few lines at the corner of the screen that fade after a few seconds. */
export default function ToastHost() {
  const { toasts, dismissToast, markRead } = useNotifications();
  // Hovering or focusing a toast holds every toast on screen until the pointer or focus leaves,
  // so nobody loses a message (or its link) half way through reading it.
  const [paused, setPaused] = useState(false);

  // Each toast leaves a few seconds after it last changed (a burst keeps it up a little longer).
  useEffect(() => {
    if (paused) return;
    const timers = toasts.map((t) => setTimeout(() => dismissToast(t.key), Math.max(2000, t.at + SHOW_MS - Date.now())));
    return () => timers.forEach(clearTimeout);
  }, [toasts, dismissToast, paused]);

  return (
    <div
      className="toast-host"
      aria-live="polite"
      aria-atomic="false"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {toasts.map((t) => (
        <div className={`toast toast-${t.type}`} key={t.key}>
          <Link
            href={t.href}
            className="toast-link"
            onClick={() => {
              markRead(t.ids);
              dismissToast(t.key);
            }}
          >
            <span className="toast-icon">
              <NotificationIcon type={t.type} />
            </span>
            <span>{t.text}</span>
          </Link>
          <button type="button" className="toast-close" aria-label="Dismiss" onClick={() => dismissToast(t.key)}>
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
