export const REPORT_TYPE_BRANCH_SUMMARY = "branch_summary";
export const REPORT_TYPE_LOW_STOCK = "low_stock";
export const REPORT_TYPE_REVENUE_TODAY = "revenue_today";

export const REPORT_TYPE_TRIAL_BALANCE = "trial_balance";
export const REPORT_TYPE_PROFIT_AND_LOSS = "profit_and_loss";
export const REPORT_TYPE_BALANCE_SHEET = "balance_sheet";
export const REPORT_TYPE_GENERAL_LEDGER = "general_ledger";

/** Legacy alias kept for backward compatibility. */
export const REPORT_TYPE_SUMMARY_ALIAS = "summary";

export const BRANCH_REPORT_TYPES = [
  REPORT_TYPE_BRANCH_SUMMARY,
  REPORT_TYPE_LOW_STOCK,
  REPORT_TYPE_REVENUE_TODAY,
] as const;

export const FINANCIAL_REPORT_TYPES = [
  REPORT_TYPE_TRIAL_BALANCE,
  REPORT_TYPE_PROFIT_AND_LOSS,
  REPORT_TYPE_BALANCE_SHEET,
  REPORT_TYPE_GENERAL_LEDGER,
] as const;

export const REPORT_TYPES = [...BRANCH_REPORT_TYPES, ...FINANCIAL_REPORT_TYPES] as const;

export type BranchReportType = (typeof BRANCH_REPORT_TYPES)[number];
export type FinancialReportType = (typeof FINANCIAL_REPORT_TYPES)[number];
export type ReportType = (typeof REPORT_TYPES)[number];

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  [REPORT_TYPE_BRANCH_SUMMARY]: "Branch summary",
  [REPORT_TYPE_LOW_STOCK]: "Low stock items",
  [REPORT_TYPE_REVENUE_TODAY]: "Today's revenue (POS)",
  [REPORT_TYPE_TRIAL_BALANCE]: "Trial balance",
  [REPORT_TYPE_PROFIT_AND_LOSS]: "Profit & loss",
  [REPORT_TYPE_BALANCE_SHEET]: "Balance sheet",
  [REPORT_TYPE_GENERAL_LEDGER]: "General ledger",
};

export const BRANCH_SCOPED_REPORT_TYPES = new Set<string>(BRANCH_REPORT_TYPES);
export const FINANCIAL_SCOPED_REPORT_TYPES = new Set<string>(FINANCIAL_REPORT_TYPES);

export type ReportExportParams = {
  from?: string;
  to?: string;
  asOf?: string;
  accountCode?: string;
};

export function normalizeReportType(type: string): ReportType {
  if (type === REPORT_TYPE_SUMMARY_ALIAS) return REPORT_TYPE_BRANCH_SUMMARY;
  if ((REPORT_TYPES as readonly string[]).includes(type)) return type as ReportType;
  throw new Error(`Unknown report type: ${type}`);
}

export function isValidReportType(
  type: string,
): type is ReportType | typeof REPORT_TYPE_SUMMARY_ALIAS {
  return type === REPORT_TYPE_SUMMARY_ALIAS || (REPORT_TYPES as readonly string[]).includes(type);
}

export function isFinancialReportType(type: string): boolean {
  return FINANCIAL_SCOPED_REPORT_TYPES.has(type);
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

export function parseReportDate(value: string | undefined, fallback: Date): Date {
  if (!value?.trim()) return fallback;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: ${value}`);
  return d;
}
