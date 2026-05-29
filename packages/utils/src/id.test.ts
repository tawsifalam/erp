import { describe, expect, it } from "vitest";
import { generateId, generatePrefixedId, getIdPrefix, getModelPrefix } from "./id";

describe("id utilities", () => {
  it("generateId uses model prefix", () => {
    const id = generateId("Order");
    expect(id.startsWith("ord_")).toBe(true);
    expect(id.length).toBeGreaterThan(10);
  });

  it("generatePrefixedId uses custom prefix", () => {
    const id = generatePrefixedId("jl");
    expect(id.startsWith("jl_")).toBe(true);
  });

  it("getModelPrefix returns known prefixes", () => {
    expect(getModelPrefix("Organization")).toBe("org");
    expect(getModelPrefix("Reservation")).toBe("rsv");
  });

  it("getIdPrefix extracts prefix from id", () => {
    expect(getIdPrefix("rm_abc-123")).toBe("rm");
    expect(getIdPrefix("nounderscore")).toBeUndefined();
  });

  it("generateId throws for unknown model", () => {
    expect(() => generateId("UnknownModel")).toThrow();
  });
});
