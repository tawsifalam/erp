import { buildFinancialReportPdf } from "./financial-report-pdf";

describe("buildFinancialReportPdf", () => {
  it("returns a valid PDF buffer with table content", () => {
    const pdf = buildFinancialReportPdf(
      "Trial balance",
      "As of 2026-05-31",
      ["code", "debit", "credit"],
      [
        ["1000", 1000, 0],
        ["2000", 0, 1000],
      ],
    );
    const text = pdf.toString("utf8");
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text).toContain("Trial balance");
    expect(text).toContain("1000");
  });
});
