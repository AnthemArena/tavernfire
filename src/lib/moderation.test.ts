import { test } from "node:test";
import assert from "node:assert/strict";
import { groupReports, type ReportRow } from "./moderation.ts";

const row = (id: string, entryId: string, createdMs: number): ReportRow => ({
  id,
  entryId,
  reason: "spam",
  details: "",
  createdMs,
});

test("reports are grouped by answer, most reported first, then most recent", () => {
  const groups = groupReports([
    row("1", "a", 100),
    row("2", "b", 300),
    row("3", "a", 200),
    row("4", "c", 400),
  ]);
  assert.deepEqual(groups.map((g) => g.entryId), ["a", "c", "b"]);
  assert.deepEqual(groups[0].reports.map((r) => r.id), ["3", "1"]); // newest first inside a group
});

test("no reports gives no groups", () => {
  assert.deepEqual(groupReports([]), []);
});
