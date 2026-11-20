import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BIO_LINK, BIO_MAX, BioError, tidyBio, validateBio } from "./bio.ts";

const rules = readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8");

test("a bio is tidied", () => {
  assert.equal(tidyBio("  I run  a table\n\n\n  on Fridays.  "), "I run a table\non Fridays.");
  assert.equal(tidyBio("   "), "");
});

test("an empty bio is allowed (it clears the bio)", () => {
  assert.equal(validateBio(""), "");
});

test("a bio over the limit is refused", () => {
  assert.equal(validateBio("a".repeat(BIO_MAX)).length, BIO_MAX);
  assert.throws(() => validateBio("a".repeat(BIO_MAX + 1)), BioError);
});

test("links are refused", () => {
  assert.throws(() => validateBio("Find me at https://example.com"), BioError);
  assert.throws(() => validateBio("see WWW.example.com"), BioError);
  assert.equal(validateBio("DM me on the table"), "DM me on the table");
});

test("the limits in the security rules match this file", () => {
  const max = rules.match(/b\.size\(\) <= (\d+)/);
  assert.ok(max, "bio length not found in firestore.rules");
  assert.equal(Number(max[1]), BIO_MAX);
  const link = rules.match(/function validBio\(b\) \{[^}]*?matches\('([^']+)'\)/);
  assert.ok(link, "bio link check not found in firestore.rules");
  // Firestore uses RE2: (?is) flags and the pattern must match the whole text.
  const re = new RegExp(`^(?:${link[1].replace("(?is)", "")})$`, "is");
  for (const s of ["x https://a.b", "www.a.b", "see\nhttp://x"]) {
    assert.ok(re.test(s), `${s} should be refused by the rules`);
    assert.ok(BIO_LINK.test(s));
  }
  assert.equal(re.test("A plain bio\nwith two lines."), false);
});
