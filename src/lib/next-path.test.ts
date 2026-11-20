import { test } from "node:test";
import assert from "node:assert/strict";
import { safeNext, signInHref } from "./next-path.ts";

test("a path on this site is kept", () => {
  assert.equal(safeNext("/fires/abc123"), "/fires/abc123");
  assert.equal(safeNext("/library?q=moss"), "/library?q=moss");
});

test("anything that could leave the site, or loop, falls back to home", () => {
  for (const bad of [null, undefined, "", "fires/abc", "//evil.example", "https://evil.example", "/\\evil.example", "/signin", "/signin?next=/x", "/a\nb"]) {
    assert.equal(safeNext(bad), "/", String(bad));
  }
});

test("the sign-in link carries the page, except from home", () => {
  assert.equal(signInHref("/"), "/signin");
  assert.equal(signInHref(null), "/signin");
  assert.equal(signInHref("/fires/abc123"), "/signin?next=%2Ffires%2Fabc123");
  assert.equal(signInHref("//evil.example"), "/signin");
});
