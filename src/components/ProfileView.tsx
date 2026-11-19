"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, doc, getDoc, getDocs, limit, query, where } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { useNow } from "@/lib/use-now";
import { kindLabel, toRequestItem, type RequestItem } from "@/lib/requests";
import { rankLabel, toEntryItem, type EntryItem } from "@/lib/entries";
import PhaseLabel from "@/components/PhaseLabel";
import AnswerCount from "@/components/AnswerCount";

const LIST_LIMIT = 100;

type Profile = { name: string; since: Date | null };
type AnswerRow = { entry: EntryItem; request: RequestItem };
type Loaded = { profile: Profile; fires: RequestItem[]; answers: AnswerRow[] };
type State = { status: "loading" } | { status: "missing" } | { status: "error" } | ({ status: "ready" } & Loaded);

/** Someone's public page: their name, their numbers, their fires and their answers. */
export default function ProfileView({ uid }: { uid: string }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [tab, setTab] = useState<"answers" | "fires">("answers");
  const now = useNow();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const db = getDb();
        const snap = await getDoc(doc(db, "users", uid));
        const data = snap.exists() ? snap.data() : null;
        const name = data && typeof data.displayName === "string" && data.displayName !== "" ? data.displayName : null;
        if (!name) {
          if (!cancelled) setState({ status: "missing" });
          return;
        }
        const created = data?.createdAt as { toDate?: () => Date } | undefined;

        const [requestSnap, entrySnap] = await Promise.all([
          getDocs(
            query(
              collection(db, "requests"),
              where("requesterId", "==", uid),
              where("moderation", "==", "ok"),
              limit(LIST_LIMIT),
            ),
          ),
          getDocs(
            query(
              collection(db, "entries"),
              where("authorId", "==", uid),
              where("moderation", "==", "ok"),
              limit(LIST_LIMIT),
            ),
          ),
        ]);

        const fires = requestSnap.docs
          .map((d) => toRequestItem(d.id, d.data()))
          .filter((r): r is RequestItem => r !== null)
          .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));

        const entries = entrySnap.docs
          .map((d) => toEntryItem(d.id, d.data()))
          .filter((e): e is EntryItem => e !== null && e.reveal !== null);
        const requests = new Map<string, RequestItem | null>();
        await Promise.all(
          [...new Set(entries.map((e) => e.requestId))].map(async (id) => {
            const s = await getDoc(doc(db, "requests", id)).catch(() => null);
            requests.set(id, s && s.exists() ? toRequestItem(s.id, s.data() ?? {}) : null);
          }),
        );
        const answers = entries
          .map((entry): AnswerRow | null => {
            const request = requests.get(entry.requestId) ?? null;
            return request ? { entry, request } : null;
          })
          .filter((a): a is AnswerRow => a !== null)
          .sort((a, b) => (b.request.createdAt?.getTime() ?? 0) - (a.request.createdAt?.getTime() ?? 0));

        if (!cancelled) {
          setState({
            status: "ready",
            profile: { name, since: typeof created?.toDate === "function" ? created.toDate() : null },
            fires,
            answers,
          });
        }
      } catch (err) {
        console.error("Could not load profile", err);
        if (!cancelled) setState({ status: "error" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid]);

  if (state.status === "loading") return <p className="muted page-note" role="status">Loading…</p>;
  if (state.status === "error") {
    return (
      <p className="empty page-note" role="alert">
        Couldn&apos;t load this profile right now. Please try again in a moment.
      </p>
    );
  }
  if (state.status === "missing") {
    return (
      <div className="page-note">
        <h1 className="section-title">Profile not found</h1>
        <p className="muted">
          This person may not exist, or hasn&apos;t chosen a name yet. <Link href="/">Back to Fires</Link>
        </p>
      </div>
    );
  }

  const { profile, fires, answers } = state;
  const finishedFires = fires.filter((f) => f.status === "revealed").length;
  const picks = answers.reduce((sum, a) => sum + (a.entry.reveal?.picks ?? 0), 0);
  const favourites = answers.filter((a) => a.entry.reveal?.favourite).length;
  const since = profile.since
    ? profile.since.toLocaleDateString("en-GB", { month: "long", year: "numeric" })
    : null;

  return (
    <div className="profile-layout">
      <aside className="profile-card" aria-label="About this person">
        <svg width="96" height="96" viewBox="0 0 96 96" role="img" aria-label="Avatar: ember sigil">
          <circle cx="48" cy="48" r="45" fill="var(--chip)" stroke="var(--accent)" strokeWidth="2" />
          <path
            d="M48 22c3 9 12 14 12 26a12 12 0 0 1-24 0c0-6 3-9 6-13 1 5 4 7 6 7-1-7-1-14 0-20z"
            fill="var(--accent)"
          />
          <path
            d="M48 50c2 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-5 3-7 1 2 2 3 3 3z"
            fill="var(--parchment)"
          />
        </svg>
        <div>
          <h1 className="profile-name">{profile.name}</h1>
          {since && <p className="profile-since">Member since {since}</p>}
        </div>
        <dl className="profile-stats">
          <Stat label="Fires lit" value={finishedFires} />
          <Stat label="Answers" value={answers.length} />
          <Stat label="Picks earned" value={picks} />
          <Stat label="Favourites" value={favourites} gold />
        </dl>
        <p className="profile-note">Counts include only fires that have finished voting.</p>
      </aside>

      <section className="profile-content" aria-label="Fires and answers">
        <div className="tabs" role="group" aria-label="Profile sections">
          <button type="button" className="tab" aria-pressed={tab === "answers"} onClick={() => setTab("answers")}>
            Answers
          </button>
          <button type="button" className="tab" aria-pressed={tab === "fires"} onClick={() => setTab("fires")}>
            Fires
          </button>
        </div>

        {tab === "answers" ? (
          answers.length === 0 ? (
            <p className="empty">
              No answers to show yet. Answers appear here once voting on a fire has ended.
            </p>
          ) : (
            <ul className="request-list">
              {answers.map(({ entry, request }) => {
                const r = entry.reveal;
                return (
                  <li key={entry.id}>
                    <Link href={`/requests/${request.id}`} className="request-card">
                      <div className="request-card-top">
                        <div className="sparks">
                          {request.sparks.map((s) => (
                            <span className="spark" key={s}>
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                      <p className="my-answer-name">{entry.name}</p>
                      <div className="meta">
                        <span className="badge">{kindLabel(request.kind)}</span>
                        {r?.favourite && <span className="badge badge-favourite">Community favourite</span>}
                        {r?.rank != null && <span className="badge badge-rank">{rankLabel(r.rank, r.tied)}</span>}
                        <span>
                          {r?.picks ?? 0} {r?.picks === 1 ? "pick" : "picks"}
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )
        ) : fires.length === 0 ? (
          <p className="empty">No fires lit yet.</p>
        ) : (
          <ul className="request-list">
            {fires.map((r) => (
              <li key={r.id}>
                <Link href={`/requests/${r.id}`} className="request-card">
                  <div className="request-card-top">
                    <div className="sparks">
                      {r.sparks.map((s) => (
                        <span className="spark" key={s}>
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="meta">
                    <span className="badge">{kindLabel(r.kind)}</span>
                    <PhaseLabel request={r} now={now} />
                    <AnswerCount requestId={r.id} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, gold }: { label: string; value: number; gold?: boolean }) {
  return (
    <div className="profile-stat">
      <dt>{label}</dt>
      <dd className={gold ? "profile-stat-gold" : undefined}>{value}</dd>
    </div>
  );
}
