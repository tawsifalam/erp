import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("./auth", () => ({
  getAccessToken: vi.fn().mockResolvedValue("token-123"),
}));

import { apiFetch, apiFetchBlob } from "./api-client";

describe("apiFetch tenant headers", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => "{}",
      }),
    );
  });

  afterEach(() => {
    vi.stubGlobal("fetch", originalFetch);
  });

  it("sends X-Organization-Id and X-Branch-Id when tenant is provided", async () => {
    await apiFetch("/pms/rooms", {
      tenant: { organizationId: "org_a", branchId: "br_a1" },
    });

    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["X-Organization-Id"]).toBe("org_a");
    expect(headers["X-Branch-Id"]).toBe("br_a1");
    expect(headers.Authorization).toBe("Bearer token-123");
  });

  it("handles empty successful responses (e.g. DELETE)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => "",
      }),
    );

    const result = await apiFetch<void>("/inventory/items/inv-1", { method: "DELETE" });
    expect(result).toBeUndefined();
  });

  it("omits branch header when branchId is undefined", async () => {
    await apiFetch("/accounting/journals", {
      tenant: { organizationId: "org_a" },
    });

    const fetchMock = global.fetch as ReturnType< typeof vi.fn>;
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["X-Organization-Id"]).toBe("org_a");
    expect(headers["X-Branch-Id"]).toBeUndefined();
  });
});

describe("apiFetchBlob", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        blob: async () => new Blob(["%PDF-1.4"], { type: "application/pdf" }),
      }),
    );
  });

  afterEach(() => {
    vi.stubGlobal("fetch", originalFetch);
  });

  it("returns blob without forcing Content-Type header", async () => {
    const blob = await apiFetchBlob("/payroll/runs/pr_001/payslip", {
      tenant: { organizationId: "org_a", branchId: "br_a1" },
    });

    expect(blob.type).toBe("application/pdf");
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBeUndefined();
    expect(headers.Authorization).toBe("Bearer token-123");
  });

  it("throws with API message when response is not ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ message: "Payslip not found" }),
      }),
    );

    await expect(apiFetchBlob("/payroll/runs/missing/payslip")).rejects.toThrow(
      "Payslip not found",
    );
  });
});
