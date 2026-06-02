import { periodContainsDate, periodsOverlap } from "./fiscal-period.utils";

describe("fiscal-period.utils", () => {
  it("periodContainsDate is inclusive on bounds", () => {
    const period = {
      startDate: new Date("2026-06-01T00:00:00.000Z"),
      endDate: new Date("2026-06-30T00:00:00.000Z"),
    };
    expect(periodContainsDate(period, new Date("2026-06-01T12:00:00.000Z"))).toBe(true);
    expect(periodContainsDate(period, new Date("2026-06-30T23:59:00.000Z"))).toBe(true);
    expect(periodContainsDate(period, new Date("2026-05-31T23:59:00.000Z"))).toBe(false);
    expect(periodContainsDate(period, new Date("2026-07-01T00:00:00.000Z"))).toBe(false);
  });

  it("periodsOverlap detects overlapping ranges", () => {
    const a = {
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-06-30"),
    };
    const b = {
      startDate: new Date("2026-06-01"),
      endDate: new Date("2026-12-31"),
    };
    const c = {
      startDate: new Date("2027-01-01"),
      endDate: new Date("2027-12-31"),
    };
    expect(periodsOverlap(a, b)).toBe(true);
    expect(periodsOverlap(a, c)).toBe(false);
  });
});
