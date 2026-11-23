import { test } from "node:test";
import assert from "node:assert/strict";
import { addToast, MAX_TOASTS, toNotification, type NotificationItem, type Toast } from "./notifications.ts";

const item = (id: string, type: NotificationItem["type"], text = "t"): NotificationItem => ({
  id, type, text, href: `/fires/${id}`, createdAt: null, read: false,
});

test("each kind reads naturally and links to the right place", () => {
  const stoke = toNotification("1", { type: "stoke", requestId: "r1", sparks: "Statue, Time, Glowing" }, "me");
  assert.equal(stoke?.text, 'Your fire "Statue, Time, Glowing" was stoked.');
  assert.equal(stoke?.href, "/fires/r1");
  assert.equal(toNotification("2", { type: "upvote", requestId: "r1", entryName: "Vhane" }, "me")?.text, 'Your answer "Vhane" was upvoted.');
  const ans = toNotification("3", { type: "answer", requestId: "r1", sparks: "A, B, C", actorName: "Marrow" }, "me");
  assert.equal(ans?.text, 'Marrow answered your fire "A, B, C".');
  const ach = toNotification("4", { type: "achievement", achievement: "first_fire" }, "me");
  assert.equal(ach?.text, 'Achievement unlocked: "First fire"');
  assert.equal(ach?.href, "/profile/me");
  assert.equal(toNotification("5", { type: "levelup", level: 2 }, "me")?.text, "You reached Flamebearer.");
});

test("stokes and upvotes name nobody", () => {
  const s = toNotification("1", { type: "stoke", requestId: "r", actorName: "Secret" }, "me");
  assert.ok(!s?.text.includes("Secret"));
});

test("unknown kinds and unknown achievements are skipped", () => {
  assert.equal(toNotification("1", { type: "mystery" }, "me"), null);
  assert.equal(toNotification("1", {}, "me"), null);
  assert.equal(toNotification("1", { type: "achievement", achievement: "nope" }, "me"), null);
});

test("read state and time come through", () => {
  const n = toNotification("1", { type: "levelup", level: 3, read: true, createdAt: { toDate: () => new Date("2026-11-20T10:00:00Z") } }, "me");
  assert.equal(n?.read, true);
  assert.equal(n?.createdAt?.toISOString(), "2026-11-20T10:00:00.000Z");
});

test("a burst of upvotes becomes one toast with a count", () => {
  let toasts: Toast[] = [];
  toasts = addToast(toasts, item("a", "upvote", 'Your answer "X" was upvoted.'), 1000);
  assert.equal(toasts[0].text, 'Your answer "X" was upvoted.');
  toasts = addToast(toasts, item("b", "upvote"), 2000);
  toasts = addToast(toasts, item("c", "upvote"), 3000);
  assert.equal(toasts.length, 1);
  assert.equal(toasts[0].text, "3 upvotes on your answers.");
  assert.deepEqual(toasts[0].ids, ["a", "b", "c"]);
  assert.equal(toasts[0].at, 3000);
});

test("different kinds get their own toasts, and only the newest few stay", () => {
  let toasts: Toast[] = [];
  toasts = addToast(toasts, item("a", "answer"), 1);
  toasts = addToast(toasts, item("b", "stoke"), 2);
  assert.equal(toasts.length, 2);
  toasts = addToast(toasts, item("c", "achievement"), 3);
  toasts = addToast(toasts, item("d", "levelup"), 4);
  assert.equal(toasts.length, MAX_TOASTS);
  assert.deepEqual(toasts.map((t) => t.key), ["b", "c", "d"]);
});

test("answer and upvote notifications open the answer when they know which one", () => {
  assert.equal(toNotification("1", { type: "answer", requestId: "r1", entryId: "e9", actorName: "Marrow" }, "me")?.href, "/fires/r1#entry-e9");
  assert.equal(toNotification("2", { type: "upvote", requestId: "r1", entryId: "e9", entryName: "Vhane" }, "me")?.href, "/fires/r1#entry-e9");
  // Older notifications have no entry id and still open the fire.
  assert.equal(toNotification("3", { type: "answer", requestId: "r1", actorName: "Marrow" }, "me")?.href, "/fires/r1");
});
