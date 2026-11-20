// Helpers for the moderator review queue.

export type ReportRow = {
  id: string;
  entryId: string;
  reason: string;
  details: string;
  createdMs: number;
};

/**
 * Group open reports by the answer they are about. The answer with the most reports
 * comes first, then the one reported most recently.
 */
export function groupReports(rows: ReportRow[]): { entryId: string; reports: ReportRow[] }[] {
  const byEntry = new Map<string, ReportRow[]>();
  for (const row of rows) {
    const list = byEntry.get(row.entryId);
    if (list) list.push(row);
    else byEntry.set(row.entryId, [row]);
  }
  const latest = (reports: ReportRow[]) => Math.max(...reports.map((r) => r.createdMs));
  return [...byEntry.entries()]
    .map(([entryId, reports]) => ({
      entryId,
      reports: [...reports].sort((a, b) => b.createdMs - a.createdMs),
    }))
    .sort((a, b) => b.reports.length - a.reports.length || latest(b.reports) - latest(a.reports));
}
