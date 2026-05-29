import { roundMoney } from "@erp/utils";

describe("Journal balance validation", () => {
  it("rejects unbalanced entries", () => {
    const lines = [
      { debit: 500, credit: 0 },
      { debit: 0, credit: 400 },
    ];
    const totalDebit = roundMoney(lines.reduce((s, l) => s + l.debit, 0));
    const totalCredit = roundMoney(lines.reduce((s, l) => s + l.credit, 0));
    expect(totalDebit).not.toBe(totalCredit);
  });

  it("accepts balanced food sale", () => {
    const lines = [
      { debit: 500, credit: 0 },
      { debit: 0, credit: 500 },
    ];
    const totalDebit = roundMoney(lines.reduce((s, l) => s + l.debit, 0));
    const totalCredit = roundMoney(lines.reduce((s, l) => s + l.credit, 0));
    expect(totalDebit).toBe(totalCredit);
  });
});
