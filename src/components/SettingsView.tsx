"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { useNow } from "@/lib/use-now";
import Avatar from "@/components/Avatar";
import { RankProgress } from "@/components/RankBadge";
import { AVATARS, PACKS, describeWhen, nextAvatarChange, type AvatarId, type PackId } from "@/lib/avatars";
import { AvatarError } from "@/lib/display-name";
import { BIO_MAX, BioError } from "@/lib/bio";
import { NAME_CHANGE_DAYS, NAME_MAX, NameError } from "@/lib/names";
import { kindLabel, toRequestItem, type RequestItem } from "@/lib/requests";
import { toEntryItem, type EntryItem } from "@/lib/entries";
import { answerStatus } from "@/lib/my-answers";
import PhaseLabel from "@/components/PhaseLabel";
import AnswerCount from "@/components/AnswerCount";

/** Your own page: your name, and the requests you have posted. Only you see it. */
export default function SettingsView() {
  const { user, displayName, xp, bio, chooseBio, avatar, avatarChangedAt, chooseAvatar, chooseName, nameChangeOn, signOut, loading, emailVerified, resendVerification, refreshVerification } =
    useAuth();

  if (loading) return <p className="muted page-note">Loading…</p>;
  if (!user) {
    return (
      <div className="card">
        <h1 className="card-title">Settings</h1>
        <p className="card-lede">Sign in to see your settings and your fires.</p>
        <Link className="btn btn-primary btn-block" href="/signin">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="account">
      <h1 className="page-title">Settings</h1>
      <NameCard
        displayName={displayName}
        chooseName={chooseName}
        waitUntil={displayName ? nameChangeOn() : null}
      />
      <section className="card" aria-labelledby="rank-heading">
        <h2 className="card-title" id="rank-heading">
          Your rank
        </h2>
        <RankProgress xp={xp} />
        <p className="hint">
          You earn XP by lighting fires and answering, and more when people upvote your answers or stoke your fires.
        </p>
      </section>
      <AvatarCard
        name={displayName ?? user.email ?? "You"}
        current={avatar}
        changedAt={avatarChangedAt}
        choose={chooseAvatar}
      />
      <BioCard key={bio} bio={bio} save={chooseBio} />
      <EmailCard
        email={user.email}
        verified={emailVerified}
        google={user.providerData.some((p) => p.providerId === "google.com")}
        resend={resendVerification}
        refresh={refreshVerification}
      />
      <MyRequests uid={user.uid} />
      <MyAnswers uid={user.uid} />
      <button type="button" className="btn btn-outline account-signout" onClick={() => signOut()}>
        Sign out
      </button>
    </div>
  );
}

function AvatarCard({
  name,
  current,
  changedAt,
  choose,
}: {
  name: string;
  current: AvatarId | null;
  changedAt: Date | null;
  choose: (avatar: AvatarId) => Promise<void>;
}) {
  const [picked, setPicked] = useState<AvatarId | null>(current);
  const [pack, setPack] = useState<PackId>(current ? (current.split("-")[0] as PackId) : PACKS[0].id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const waitUntil = nextAvatarChange(changedAt, new Date());

  async function save() {
    if (!picked) return;
    setBusy(true);
    setError(null);
    try {
      await choose(picked);
      setSaved(true);
    } catch (err) {
      setError(err instanceof AvatarError ? err.message : "Couldn't save that avatar. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card" aria-labelledby="avatar-heading">
      <h2 className="card-title" id="avatar-heading">
        Avatar
      </h2>
      <p className="hint">Shown next to your name on your fires and answers.</p>
      <div className="tabs" role="group" aria-label="Avatar packs">
        {PACKS.map((p) => (
          <button key={p.id} type="button" className="tab" aria-pressed={pack === p.id} onClick={() => setPack(p.id)}>
            {p.label}
          </button>
        ))}
      </div>
      <div className="avatar-grid" role="group" aria-label="Choose an avatar">
        {AVATARS.filter((a) => a.pack === pack).map((a) => (
          <button
            key={a.id}
            type="button"
            className="avatar-choice"
            aria-pressed={picked === a.id}
            aria-label={a.label}
            title={a.label}
            onClick={() => {
              setPicked(a.id);
              setSaved(false);
              setError(null);
            }}
          >
            <Avatar id={a.id} name={name} size="lg" />
          </button>
        ))}
      </div>
      {waitUntil && picked !== current && (
        <p className="hint">
          You can change your avatar again {describeWhen(waitUntil, new Date())}.
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button type="button" className="btn btn-primary" disabled={busy || !picked || picked === current} onClick={save}>
        {busy ? "Saving…" : "Save avatar"}
      </button>
      {saved && (
        <p className="notice notice-success" role="status">
          Avatar saved.
        </p>
      )}
    </section>
  );
}

function BioCard({ bio, save }: { bio: string; save: (bio: string) => Promise<void> }) {
  const [value, setValue] = useState(bio);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await save(value);
      setSaved(true);
    } catch (err) {
      setError(err instanceof BioError ? err.message : "Couldn't save that. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card" aria-labelledby="bio-heading">
      <h2 className="card-title" id="bio-heading">
        About you
      </h2>
      <form onSubmit={onSubmit} noValidate>
        <div className="field">
          <label className="label" htmlFor="account-bio">
            Bio{" "}
            <span className="counter" aria-hidden="true">
              {value.length} of {BIO_MAX} characters
            </span>
          </label>
          <textarea
            id="account-bio"
            className={error ? "input textarea input-error" : "input textarea"}
            rows={4}
            maxLength={BIO_MAX}
            placeholder="e.g. I run a Friday night table and collect odd NPCs."
            value={value}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "account-bio-error account-bio-hint" : "account-bio-hint"}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
              setSaved(false);
            }}
          />
          {error && (
            <p className="error field-error" id="account-bio-error" role="alert">
              {error}
            </p>
          )}
          <p className="hint" id="account-bio-hint">
            Shown on your profile. Plain text, no links.
          </p>
        </div>
        <button type="submit" className="btn btn-primary" disabled={busy || value.trim() === bio}>
          {busy ? "Saving…" : "Save bio"}
        </button>
      </form>
      {saved && (
        <p className="notice notice-success" role="status">
          Bio saved.
        </p>
      )}
    </section>
  );
}

function EmailCard({
  email,
  verified,
  google,
  resend,
  refresh,
}: {
  email: string | null;
  verified: boolean;
  google: boolean;
  resend: () => Promise<void>;
  refresh: () => Promise<boolean>;
}) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function run(action: () => Promise<string | null>) {
    setBusy(true);
    setNote(null);
    try {
      setNote(await action());
    } catch {
      setNote("Couldn't do that just now. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card" aria-labelledby="email-heading">
      <h2 className="card-title" id="email-heading">
        Email
      </h2>
      <p className="account-name">
        <strong>{email ?? "No email on this account"}</strong>{" "}
        <span className="muted">{verified ? "(verified)" : "(not verified)"}</span>
      </p>
      {!verified && (
        <>
          <p className="hint">Verify your email to stoke fires and upvote answers.</p>
          <div className="notice-actions">
            <button
              type="button"
              className="btn btn-outline"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await resend();
                  return "Sent. Check your inbox and spam folder.";
                })
              }
            >
              Resend the email
            </button>
            <button
              type="button"
              className="btn btn-outline"
              disabled={busy}
              onClick={() =>
                run(async () =>
                  (await refresh()) ? null : "We can't see that it's verified yet. Open the link in the email, then try again.",
                )
              }
            >
              I&apos;ve verified it
            </button>
          </div>
        </>
      )}
      {google && <p className="hint">You signed in with Google. We don&apos;t show your Google name.</p>}
      {note && (
        <p className="hint" role="status">
          {note}
        </p>
      )}
    </section>
  );
}

function NameCard({
  displayName,
  chooseName,
  waitUntil,
}: {
  displayName: string | null;
  chooseName: (name: string) => Promise<string>;
  waitUntil: Date | null;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    setBusy(true);
    try {
      await chooseName(value);
      setValue("");
      setSaved(true);
    } catch (err) {
      setError(err instanceof NameError ? err.message : "Couldn't save that name. Try again.");
      input.current?.focus();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card" aria-labelledby="name-heading">
      <h2 className="card-title" id="name-heading">
        Display name
      </h2>
      <p className="account-name">
        {displayName ? <strong>{displayName}</strong> : <span className="muted">You haven&apos;t chosen a display name yet.</span>}
      </p>
      <p className="hint">
        {displayName
          ? "Shown next to your fires and on your answers."
          : "You'll be asked for one when you light your first fire or write your first answer. You can also choose it here."}
      </p>

      {waitUntil ? (
        <p className="hint">
          You can change your display name again on{" "}
          {waitUntil.toLocaleDateString(undefined, { day: "numeric", month: "long" })}.
        </p>
      ) : (
        <form onSubmit={onSubmit} noValidate>
          <div className="field">
            <label className="label" htmlFor="account-name">
              {displayName ? "New display name" : "Choose a display name"}
            </label>
            <input
              id="account-name"
              ref={input}
              className={error ? "input input-error" : "input"}
              type="text"
              maxLength={NAME_MAX}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder="e.g. Marrow"
              value={value}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "account-name-error account-name-hint" : "account-name-hint"}
              onChange={(e) => {
                setValue(e.target.value);
                setError(null);
                setSaved(false);
              }}
            />
            {error && (
              <p className="error" id="account-name-error" role="alert">
                {error}
              </p>
            )}
            <p className="hint" id="account-name-hint">
              Pick a name that isn&apos;t your real name. You can change it once every {NAME_CHANGE_DAYS} days.
                          </p>
          </div>
          <button type="submit" className="btn btn-primary" disabled={busy || value.trim() === ""}>
            {busy ? "Saving…" : displayName ? "Change display name" : "Save display name"}
          </button>
        </form>
      )}
      {saved && (
        <p className="notice notice-success" role="status">
          Display name saved.
        </p>
      )}
    </section>
  );
}

function MyRequests({ uid }: { uid: string }) {
  const [items, setItems] = useState<RequestItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const now = useNow();

  useEffect(() => {
    const q = query(
      collection(getDb(), "requests"),
      where("requesterId", "==", uid),
      where("moderation", "==", "ok"),
      orderBy("createdAt", "desc"),
    );
    return onSnapshot(
      q,
      (snap) => {
        setItems(
          snap.docs
            .map((d) => toRequestItem(d.id, d.data({ serverTimestamps: "estimate" })))
            .filter((r): r is RequestItem => r !== null),
        );
        setFailed(false);
      },
      (err) => {
        console.error("Could not load your requests", err);
        setFailed(true);
      },
    );
  }, [uid]);

  return (
    <section aria-labelledby="my-requests">
      <h2 className="section-title" id="my-requests">
        Your fires
      </h2>
      {failed ? (
        <p className="empty" role="alert">
          Couldn&apos;t load your fires right now. Please try again in a moment.
        </p>
      ) : items === null ? (
        <p className="empty" role="status">
          Loading…
        </p>
      ) : items.length === 0 ? (
        <p className="empty">
          You haven&apos;t lit a fire yet. <Link href="/fires/new">Light one now.</Link>
        </p>
      ) : (
        <ul className="request-list">
          {items.map((r) => (
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
  );
}

type AnswerRow = {
  entryId: string;
  request: RequestItem;
  entry: EntryItem | null;
  /** The private marker exists but the entry never finished saving. */
  unfinished: boolean;
  at: number;
};

/** Your answers, across all requests. Only you can see this list. */
function MyAnswers({ uid }: { uid: string }) {
  const [rows, setRows] = useState<AnswerRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const now = useNow();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const db = getDb();
        const markers = await getDocs(
          query(collectionGroup(db, "answerLocks"), where("authorId", "==", uid)),
        );
        const found = await Promise.all(
          markers.docs.map(async (m): Promise<AnswerRow | null> => {
            const requestId = m.get("requestId") as string;
            const entryId = m.get("entryId") as string;
            const requestSnap = await getDoc(doc(db, "requests", requestId)).catch(() => null);
            const request =
              requestSnap && requestSnap.exists()
                ? toRequestItem(requestSnap.id, requestSnap.data() ?? {})
                : null;
            if (!request) return null; // a hidden or removed request
            // A hidden entry is refused to its own author, so treat any failure as "not shown".
            const entrySnap = await getDoc(doc(db, "entries", entryId)).catch(() => null);
            const entry =
              entrySnap && entrySnap.exists() ? toEntryItem(entrySnap.id, entrySnap.data() ?? {}) : null;
            const created = m.get("createdAt") as { toDate?: () => Date } | undefined;
            return {
              entryId,
              request,
              entry,
              unfinished: entrySnap !== null && !entrySnap.exists(),
              at: created?.toDate?.().getTime() ?? 0,
            };
          }),
        );
        if (cancelled) return;
        setRows(found.filter((r): r is AnswerRow => r !== null).sort((a, b) => b.at - a.at));
      } catch (err) {
        console.error("Could not load your answers", err);
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid]);

  return (
    <section aria-labelledby="my-answers">
      <h2 className="section-title" id="my-answers">
        Your answers
      </h2>
      {failed ? (
        <p className="empty" role="alert">
          Couldn&apos;t load your answers right now. Please try again in a moment.
        </p>
      ) : rows === null ? (
        <p className="empty" role="status">
          Loading…
        </p>
      ) : rows.length === 0 ? (
        <p className="empty">
          You haven&apos;t answered any fires yet. <Link href="/">Find a fire to answer.</Link>
        </p>
      ) : (
        <ul className="request-list">
          {rows.map((r) => (
            <li key={r.entryId}>
              <Link href={`/fires/${r.request.id}`} className="request-card">
                <div className="request-card-top">
                  <div className="sparks">
                    {r.request.sparks.map((s) => (
                      <span className="spark" key={s}>
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
                <p className="my-answer-name">
                  {r.entry ? r.entry.name : r.unfinished ? "This answer didn't finish saving" : "Answer not shown"}
                </p>
                <div className="meta">
                  <span className="badge">{kindLabel(r.request.kind)}</span>
                  <span>
                    {r.unfinished ? "Open the request to send it again" : answerStatus(r.entry, now)}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="hint account-note">
        Only you can see this page. Your fires and answers are also shown on your public profile.
      </p>
    </section>
  );
}
