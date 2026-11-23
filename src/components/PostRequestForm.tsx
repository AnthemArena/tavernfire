"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { SparkError, buildSparkFields } from "@/lib/sparks";
import { sparksFromParam } from "@/lib/library";
import { displayWord, fireCount } from "@/lib/spark-suggestions";
import { useSparkSuggestions } from "@/lib/use-spark-suggestions";
import { NAME_CHANGE_DAYS, NAME_MAX, NameError } from "@/lib/names";
import type { RequestKind } from "@/lib/requests";
import {
  DEFAULT_NOTE_PLACEHOLDER,
  LAUNCHED_CATEGORIES,
  getCategory,
  groupedCategories,
  isCompactPicker,
} from "@/lib/categories";

const NOTE_MAX = 300;
// If the server hasn't confirmed the request after this long, say so.
const SLOW_AFTER_MS = 8_000;
const NOTICE_DELAY_MS = 700;

export default function PostRequestForm() {
  const router = useRouter();
  const { user, displayName, avatar, chooseName, nameChangeOn, loading } = useAuth();
  // True while a named person has opened the field to change their name.
  const [changingName, setChangingName] = useState(false);
  const showNameField = !displayName || changingName;

  // Arriving from a search that found nothing fills in the words that were searched (?s=a,b).
  const params = useSearchParams();
  const [sparks, setSparks] = useState(() => sparksFromParam(params.get("s")));
  const [kind, setKind] = useState<RequestKind>("npc");
  const [note, setNote] = useState("");
  // Asked for once, the first time someone posts a request.
  const [nameInput, setNameInput] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const nameField = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  // When the problem is with one spark box, which one, and a suggested fix.
  const [sparkProblem, setSparkProblem] = useState<{ index: number; message: string; fix: string | null } | null>(null);
  const sparkInputs = useRef<(HTMLInputElement | null)[]>([]);
  const [busy, setBusy] = useState(false);
  const [slow, setSlow] = useState(false);
  // The id of the request we just posted, once the server has confirmed it.
  const [postedId, setPostedId] = useState<string | null>(null);
  // The "Request posted" notice only appears if opening the request takes a
  // moment (the first visit to a page can be slow in development), so it never
  // flashes up just before a quick navigation.
  const [showPosted, setShowPosted] = useState(false);

  // Sparks already in use that match the box being typed in. Suggestions are optional.
  const {
    focused: focusedSpark,
    setFocused: setFocusedSpark,
    suggestions,
    typed: typedInFocused,
  } = useSparkSuggestions(sparks);

  function pickSuggestion(index: number, word: string) {
    setSpark(index, displayWord(word));
    const next = sparkInputs.current[index + 1];
    if (next && sparks[index + 1] === "") next.focus();
  }

  function setSpark(index: number, value: string) {
    setSparks((current) => current.map((s, i) => (i === index ? value : s)));
    if (sparkProblem?.index === index) setSparkProblem(null);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!user) return;
    setError(null);
    setSparkProblem(null);

    let fields;
    try {
      fields = buildSparkFields(sparks);
    } catch (err) {
      if (err instanceof SparkError && err.index !== null) {
        // Point at the box that is wrong, and move focus to it.
        setSparkProblem({ index: err.index, message: err.message, fix: err.fix });
        sparkInputs.current[err.index]?.focus();
      } else {
        setError(err instanceof Error ? err.message : "Check your sparks and try again.");
      }
      return;
    }

    setBusy(true);
    setSlow(false);
    const slowTimer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);

    try {
      let requesterName = displayName;
      if (showNameField) {
        try {
          requesterName = await chooseName(nameInput);
          setChangingName(false);
        } catch (err) {
          clearTimeout(slowTimer);
          setSlow(false);
          setBusy(false);
          setNameError(
            err instanceof NameError ? err.message : "Couldn't save that name. Try again.",
          );
          nameField.current?.focus();
          return;
        }
      }
      // addDoc only finishes once the server has accepted the request.
      const ref = await addDoc(collection(getDb(), "requests"), {
        ...fields,
        kind,
        note: note.trim(),
        requesterId: user.uid,
        requesterName,
        ...(avatar ? { requesterAvatar: avatar } : {}),
        status: "open",
        moderation: "ok",
        answerCount: 0,
        stokeCount: 0,
        createdAt: serverTimestamp(),
      });
      clearTimeout(slowTimer);
      setSlow(false);
      setPostedId(ref.id);
      setTimeout(() => setShowPosted(true), NOTICE_DELAY_MS);
      router.push(`/fires/${ref.id}`);
    } catch (err) {
      clearTimeout(slowTimer);
      console.error("Could not post request", err);
      setError("Couldn't light your fire. Check you're signed in and try again.");
      setSlow(false);
      setBusy(false);
    }
  }

  function postAnother() {
    setPostedId(null);
    setShowPosted(false);
    setSparks(["", "", ""]);
    setNote("");
    setBusy(false);
  }

  return (
    <div className="card">
      {loading ? (
        <p className="muted">One moment…</p>
      ) : !user ? (
        <>
          <div className="example-sparks">
            <p className="example-label">Example fire</p>
            <div className="sparks">
              {["Statue", "Time", "Glowing"].map((word) => (
                <span className="spark" key={word}>
                  {word}
                </span>
              ))}
            </div>
          </div>
          <p className="card-lede">
            Sign in to light a fire. It takes a few seconds and you can use
            your Google account.
          </p>
          <Link className="btn btn-primary btn-block" href="/signin?next=%2Ffires%2Fnew">
            Sign in to light a fire
          </Link>
        </>
      ) : postedId && showPosted ? (
        <div className="notice notice-success" role="status">
          <p className="notice-title">Fire lit</p>
          <p>Opening your fire now.</p>
          <div className="notice-actions">
            <Link className="btn btn-outline" href={`/fires/${postedId}`}>
              Open your fire
            </Link>
            <button type="button" className="btn btn-outline" onClick={postAnother}>
              Light another
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate>
          <div className="form-row">
            {sparks.map((value, index) => (
              <div className="field field-spark" key={index}>
                <label className="label" htmlFor={`spark-${index}`}>
                  {["Spark one", "Spark two", "Spark three"][index]}
                </label>
                <input
                  id={`spark-${index}`}
                  ref={(el) => {
                    sparkInputs.current[index] = el;
                  }}
                  className={
                    sparkProblem?.index === index ? "input input-spark input-error" : "input input-spark"
                  }
                  type="text"
                  autoComplete="off"
                  placeholder={["Statue", "Time", "Glowing"][index]}
                  value={value}
                  aria-invalid={sparkProblem?.index === index ? true : undefined}
                  aria-describedby={sparkProblem?.index === index ? "spark-problem" : undefined}
                  onChange={(e) => setSpark(index, e.target.value)}
                  onFocus={() => setFocusedSpark(index)}
                  onBlur={() => setFocusedSpark((current) => (current === index ? null : current))}
                />
              </div>
            ))}
          </div>
          {focusedSpark !== null && suggestions.length > 0 && (
            <div className="spark-suggestions" role="group" aria-label="Sparks already in use">
              <span className="muted">
                {typedInFocused.trim() === "" ? "Popular sparks:" : "Already in use:"}
              </span>
              {suggestions.map((s) => (
                <button
                  type="button"
                  key={s.word}
                  className="spark-suggestion"
                  // Keep the cursor in the box so it does not close the list before the click lands.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pickSuggestion(focusedSpark, s.word)}
                >
                  {displayWord(s.word)} <span className="muted">· {fireCount(s.count)}</span>
                </button>
              ))}
            </div>
          )}
          {sparkProblem && (
            <div className="error spark-problem" id="spark-problem" role="alert">
              <p>{sparkProblem.message}</p>
              {sparkProblem.fix && (
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => {
                    setSpark(sparkProblem.index, sparkProblem.fix ?? "");
                    setSparkProblem(null);
                    sparkInputs.current[sparkProblem.index]?.focus();
                  }}
                >
                  Use {sparkProblem.fix}
                </button>
              )}
            </div>
          )}
          <p className="hint">
            Broad words invite surprises. Narrow words get you closer to what
            you need. Check your spelling: sparks are matched exactly.
          </p>

          {isCompactPicker(LAUNCHED_CATEGORIES.length) ? (
            <div className="field">
              <label className="label" htmlFor="kind">
                What do you need?
              </label>
              <select
                id="kind"
                className="input select"
                value={kind}
                aria-describedby="kind-description"
                onChange={(e) => setKind(e.target.value as RequestKind)}
              >
                {groupedCategories(LAUNCHED_CATEGORIES).map((g) => (
                  <optgroup key={g.group} label={g.group}>
                    {g.items.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.fullLabel}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <p className="hint kind-description" id="kind-description" aria-live="polite">
                {getCategory(kind).description}
              </p>
            </div>
          ) : (
            <fieldset className="field kind-picker">
              <legend className="label">What do you need?</legend>
              <div className="kind-options">
                {LAUNCHED_CATEGORIES.map((c) => (
                  <label
                    key={c.id}
                    className={kind === c.id ? "kind-option kind-option-selected" : "kind-option"}
                  >
                    <input
                      type="radio"
                      name="kind"
                      value={c.id}
                      checked={kind === c.id}
                      onChange={() => setKind(c.id as RequestKind)}
                    />
                    <span className="kind-text">
                      <span className="kind-name">{c.fullLabel}</span>
                      <span className="kind-desc">{c.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <div className="field">
            <label className="label" htmlFor="note">
              Anything the table should know (optional)
            </label>
            <textarea
              id="note"
              className="input textarea"
              rows={3}
              maxLength={NOTE_MAX}
              placeholder={getCategory(kind).notePlaceholder ?? DEFAULT_NOTE_PLACEHOLDER}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {showNameField ? (
            <div className="field">
              <label className="label" htmlFor="display-name">
                {displayName ? "New name on the board" : "Your name on the board"}
              </label>
              <input
                id="display-name"
                ref={nameField}
                className={nameError ? "input input-error" : "input"}
                type="text"
                maxLength={NAME_MAX}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                placeholder="e.g. Marrow"
                value={nameInput}
                aria-invalid={nameError ? true : undefined}
                aria-describedby={nameError ? "name-error name-hint" : "name-hint"}
                onChange={(e) => {
                  setNameInput(e.target.value);
                  setNameError(null);
                }}
              />
              {nameError && (
                <p className="error" id="name-error" role="alert">
                  {nameError}
                </p>
              )}
              <p className="hint" id="name-hint">
                Shown next to your fires and on your answers.
                Pick something that isn&apos;t your real name; you can change it once
                every {NAME_CHANGE_DAYS} days.
              </p>
              {displayName && (
                <p className="hint">
                  Choosing a new name starts a new {NAME_CHANGE_DAYS}-day wait
                  before you can change it again.
                </p>
              )}
              {displayName && (
                <button
                  type="button"
                  className="link-button link-button-block"
                  onClick={() => {
                    setChangingName(false);
                    setNameError(null);
                    setNameInput("");
                  }}
                >
                  Keep {displayName}
                </button>
              )}
            </div>
          ) : (
            <p className="hint posting-as">
              Posting as <strong>{displayName}</strong>.{" "}
              {(() => {
                const on = nameChangeOn();
                return on ? (
                  `You can change your display name again on ${on.toLocaleDateString(undefined, { day: "numeric", month: "long" })}.`
                ) : (
                  <button type="button" className="link-button" onClick={() => setChangingName(true)}>
                    Change
                  </button>
                );
              })()}
            </p>
          )}

          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}

          {slow && (
            <p className="notice notice-warn" role="status">
              This is taking longer than usual, so your fire may not have
              reached the server yet. If you&apos;re running the site locally,
              check that the Firebase emulators are still running.
            </p>
          )}

          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? "Lighting…" : "Light the fire"}
          </button>
        </form>
      )}
    </div>
  );
}
