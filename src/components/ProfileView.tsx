"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Avatar from "@/components/Avatar";
import { RankBadge } from "@/components/RankBadge";
import { isAvatarId, type AvatarId } from "@/lib/avatars";
import { collection, doc, getDoc, getDocs, limit, query, where } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { useNow } from "@/lib/use-now";
import { useAuth } from "@/lib/auth-context";
import { useDocumentTitle } from "@/lib/use-document-title";
import { describeAge, kindLabel, toRequestItem, type RequestItem } from "@/lib/requests";
import { rankLabel, toEntryItem, type EntryItem } from "@/lib/entries";
import PhaseLabel from "@/components/PhaseLabel";
import AnswerCount from "@/components/AnswerCount";

const LIST_LIMIT = 100;

type Profile = { name: string; since: Date | null; avatar: AvatarId | null; bio: string; xp: number };
type AnswerRow = { entry: EntryItem; request: RequestItem };
type Loaded = { profile: Profile; fires: RequestItem[]; answers: AnswerRow[] };
type State = { status: "loading" } | { status: "missing" } | { status: "error" } | ({ status: "ready" } & Loaded);

/** Someone's public page: their name, their numbers, their fires and their answers. */
export default function ProfileView({ uid }: { uid: string }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [tab, setTab] = useState<"answers" | "fires" | null>(null);
  const now = useNow();
  const { user } = useAuth();
  useDocumentTitle(state.status === "ready" ? state.profile.name : null);

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
          .filter((e): e is EntryItem => e !== null);
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
            profile: {
              name,
              since: typeof created?.toDate === "function" ? created.toDate() : null,
              avatar: isAvatarId(data?.avatar) ? data.avatar : null,
              bio: typeof data?.bio === "string" ? data.bio : "",
              xp: typeof data?.xp === "number" && data.xp > 0 ? data.xp : 0,
            },
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
  const upvotes = answers.reduce((sum, a) => sum + a.entry.upvoteCount, 0);
  const isMe = user?.uid === uid;
  // Open on the tab that has something in it.
  const shownTab = tab ?? (answers.length === 0 && fires.length > 0 ? "fires" : "answers");
  const since = profile.since
    ? profile.since.toLocaleDateString("en-GB", { month: "long", year: "numeric" })
    : null;

  return (
    <div className="profile-layout">
      <aside className="profile-card" aria-label="About this person">
        <Avatar id={profile.avatar} name={profile.name} size="lg" eager />
        <div>
          <h1 className="profile-name">{profile.name}</h1>
          <RankBadge xp={profile.xp} />
          {since && <p className="profile-since">Member since {since}</p>}
        </div>
        {profile.bio && <p className="profile-bio">{profile.bio}</p>}
        <dl className="profile-stats">
          <Stat label="Fires lit" value={fires.length} />
          <Stat label="Answers" value={answers.length} />
          <Stat label="Upvotes" value={upvotes} />
        </dl>
      </aside>

      <section className="profile-content" aria-label="Fires and answers">
        <div className="tabs" role="group" aria-label="Profile sections">
          <button type="button" className="tab" aria-pressed={shownTab === "answers"} onClick={() => setTab("answers")}>
            Answers
          </button>
          <button type="button" className="tab" aria-pressed={shownTab === "fires"} onClick={() => setTab("fires")}>
            Fires
          </button>
        </div>

        {shownTab === "answers" ? (
          answers.length === 0 ? (
            <p className="empty">
              {isMe ? (
                <>
                  You haven&apos;t answered any fires yet. <Link href="/">Browse fires</Link>
                </>
              ) : (
                `${profile.name} hasn't answered any fires yet.`
              )}
            </p>
          ) : (
            <ul className="request-list">
              {answers.map(({ entry, request }) => {
                const r = entry.reveal;
                return (
                  <li key={entry.id}>
                    <Link href={`/fires/${request.id}`} className="request-card">
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
                        <span>
                          {entry.upvoteCount} {entry.upvoteCount === 1 ? "upvote" : "upvotes"}
                        </span>
                        {entry.createdAt && <span>Posted {describeAge(entry.createdAt, now)}</span>}
                        {r?.favourite && <span className="badge badge-favourite">Community favourite</span>}
                        {r?.rank != null && <span className="badge badge-rank">{rankLabel(r.rank, r.tied)}</span>}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )
        ) : fires.length === 0 ? (
          <p className="empty">
            {isMe ? (
              <>
                You haven&apos;t lit a fire yet. <Link href="/fires/new">Light one</Link>
              </>
            ) : (
              `${profile.name} hasn't lit a fire yet.`
            )}
          </p>
        ) : (
          <ul className="request-list">
            {fires.map((r) => (
              <li key={r.id}>
                <Link href={`/fires/${r.id}`} className="request-card">
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

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="profile-stat">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
