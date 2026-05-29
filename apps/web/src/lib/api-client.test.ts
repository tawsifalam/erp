import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("./auth", () => ({
  getAccessToken: vi.fn().mockResolvedValue("token-123"),
}));

import { apiFetch } from "./api-client";

describe("apiFetch tenant headers", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}),
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
