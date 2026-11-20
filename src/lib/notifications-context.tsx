"use client";

// Listens for the signed-in member's notifications and shares them with the bell and the
// toasts, so the list and the popups always agree. Toasts only appear for notifications that
// arrive while the member is on the site; the ones waiting when they arrive are just in the list.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { collection, limit, onSnapshot, orderBy, query, updateDoc, doc, where, writeBatch } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { addToast, toNotification, type NotificationItem, type Toast } from "@/lib/notifications";

const LIST_LIMIT = 30;

type NotificationsValue = {
  items: NotificationItem[];
  unread: number;
  markRead: (ids: string[]) => void;
  markAllRead: () => void;
  toasts: Toast[];
  dismissToast: (key: string) => void;
};

const NotificationsContext = createContext<NotificationsValue>({
  items: [],
  unread: 0,
  markRead: () => {},
  markAllRead: () => {},
  toasts: [],
  dismissToast: () => {},
});

export function useNotifications(): NotificationsValue {
  return useContext(NotificationsContext);
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    if (!uid) return;
    let first = true;
    const q = query(
      collection(getDb(), "notifications"),
      where("recipientId", "==", uid),
      orderBy("createdAt", "desc"),
      limit(LIST_LIMIT),
    );
    const stop = onSnapshot(
      q,
      (snap) => {
        setItems(
          snap.docs.map((d) => toNotification(d.id, d.data(), uid)).filter((n): n is NotificationItem => n !== null),
        );
        if (first) {
          first = false; // what was already waiting is not a toast
          return;
        }
        const arrived = snap.docChanges().filter((c) => c.type === "added");
        if (arrived.length === 0) return;
        const now = Date.now();
        setToasts((current) => {
          let next = current;
          for (const c of arrived) {
            const n = toNotification(c.doc.id, c.doc.data(), uid);
            if (n && !n.read) next = addToast(next, n, now);
          }
          return next;
        });
      },
      (err) => console.error("Could not load notifications", err),
    );
    return () => {
      stop();
      setItems([]);
      setToasts([]);
    };
  }, [uid]);

  const markRead = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    const db = getDb();
    for (const id of ids) {
      updateDoc(doc(db, "notifications", id), { read: true }).catch(() => {});
    }
  }, []);

  const markAllRead = useCallback(() => {
    const batch = writeBatch(getDb());
    let any = false;
    for (const n of items) {
      if (!n.read) {
        batch.update(doc(getDb(), "notifications", n.id), { read: true });
        any = true;
      }
    }
    if (any) batch.commit().catch(() => {});
  }, [items]);

  const dismissToast = useCallback((key: string) => {
    setToasts((current) => current.filter((t) => t.key !== key));
  }, []);

  const value = useMemo(
    () => ({
      items: uid ? items : [],
      unread: uid ? items.filter((n) => !n.read).length : 0,
      markRead,
      markAllRead,
      toasts: uid ? toasts : [],
      dismissToast,
    }),
    [uid, items, toasts, markRead, markAllRead, dismissToast],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}
