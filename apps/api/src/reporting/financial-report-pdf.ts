import { buildMinimalPdf } from "@erp/utils";

/** Fixed-width columns for minimal PDF tables (Helvetica, no external deps). */
export function buildFinancialReportPdf(
  title: string,
  periodLabel: string,
  headers: string[],
  rows: (string | number)[][],
): Buffer {
  const colWidths = headers.map((h, i) =>
    Math.max(
      h.length,
      ...rows.map((r) => String(r[i] ?? "").length),
      6,
    ),
  );
  const pad = (value: string, width: number) => value.slice(0, width).padEnd(width);
  const headerLine = headers.map((h, i) => pad(h, colWidths[i])).join("  ");
  const rule = colWidths.map((w) => "-".repeat(w)).join("  ");
  const dataLines = rows.map((row) =>
    row.map((cell, i) => pad(String(cell ?? ""), colWidths[i])).join("  "),
  );

  const lines = [periodLabel, "", headerLine, rule, ...(dataLines.length ? dataLines : ["(no activity in period)"])];

  return buildMinimalPdf(title, lines);
}
