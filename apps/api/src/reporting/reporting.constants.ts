export const REPORT_TYPE_BRANCH_SUMMARY = "branch_summary";
export const REPORT_TYPE_LOW_STOCK = "low_stock";
export const REPORT_TYPE_REVENUE_TODAY = "revenue_today";

/** Legacy alias kept for backward compatibility. */
export const REPORT_TYPE_SUMMARY_ALIAS = "summary";

export const REPORT_TYPES = [
  REPORT_TYPE_BRANCH_SUMMARY,
  REPORT_TYPE_LOW_STOCK,
  REPORT_TYPE_REVENUE_TODAY,
] as const;

export type ReportType = (typeof REPORT_TYPES)[number];

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  [REPORT_TYPE_BRANCH_SUMMARY]: "Branch summary",
  [REPORT_TYPE_LOW_STOCK]: "Low stock items",
  [REPORT_TYPE_REVENUE_TODAY]: "Today's revenue (POS)",
};

export const BRANCH_SCOPED_REPORT_TYPES = new Set<string>(REPORT_TYPES);

export function normalizeReportType(type: string): ReportType {
  if (type === REPORT_TYPE_SUMMARY_ALIAS) return REPORT_TYPE_BRANCH_SUMMARY;
  if ((REPORT_TYPES as readonly string[]).includes(type)) return type as ReportType;
  throw new Error(`Unknown report type: ${type}`);
}

export function isValidReportType(type: string): type is ReportType | typeof REPORT_TYPE_SUMMARY_ALIAS {
  return type === REPORT_TYPE_SUMMARY_ALIAS || (REPORT_TYPES as readonly string[]).includes(type);
}

export function escapeCsv(value: unknown): string {
  const s = String(value ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [
    headers.map(escapeCsv).join(","),
    ...rows.map((row) => row.map(escapeCsv).join(",")),
  ];
  return lines.join("\n") + "\n";
}
