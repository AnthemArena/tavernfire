import type { NotificationType } from "@/lib/notifications";

/** A small picture for each kind of notification. */
export default function NotificationIcon({ type }: { type: NotificationType }) {
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": true } as const;
  switch (type) {
    case "stoke":
      return (
        <svg {...common}>
          <path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 1-5 3-7 0 3 1 4 2 4-1-3-1-6 1-9z" />
        </svg>
      );
    case "upvote":
      return (
        <svg {...common}>
          <path d="M12 4l8 9h-5v7H9v-7H4z" />
        </svg>
      );
    case "answer":
      return (
        <svg {...common}>
          <path d="M4 4h16v12H9l-5 4z" />
        </svg>
      );
    case "achievement":
      return (
        <svg {...common}>
          <path d="M12 2l2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 17l-6.1 3.4 1.5-6.8L2.2 9l6.9-.7z" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <path d="M12 3l9 9-9 9-9-9z" />
        </svg>
      );
  }
}
