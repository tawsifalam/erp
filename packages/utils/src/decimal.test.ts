import { describe, expect, it } from "vitest";
import { roundMoney, toNumber } from "./decimal";

describe("decimal helpers", () => {
  it("toNumber parses Prisma-style decimal strings", () => {
    expect(toNumber("12.50")).toBe(12.5);
    expect(toNumber(42)).toBe(42);
  });

  it("roundMoney rounds to two decimal places", () => {
    expect(roundMoney(10.123456)).toBe(10.12);
    expect(roundMoney((20 * 10 + 10 * 16) / 30)).toBe(12);
  });
});
