import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime, shortId } from "./format";

describe("format", () => {
  it("formatDate returns locale date string", () => {
    const s = formatDate("2026-05-28T12:00:00.000Z");
    expect(s).toMatch(/2026|28|5/);
  });

  it("formatDateTime includes time components", () => {
    const s = formatDateTime("2026-05-28T14:30:00.000Z");
    expect(s.length).toBeGreaterThan(8);
  });

  it("shortId strips prefix and truncates", () => {
    expect(shortId("ord_550e8400-e29b-41d4-a716-446655440000", 8)).toBe("550e8400…");
  });

  it("shortId handles ids without prefix", () => {
    expect(shortId("abcdefgh", 4)).toBe("abcd…");
  });
});
