import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { TenantGuard } from "./tenant.guard";

const mockPrisma = {
  user: { findUnique: jest.fn() },
  branch: { findFirst: jest.fn() },
  userBranch: { findUnique: jest.fn() },
};

function mockContext(headers: Record<string, string>, userId = "pa_user") {
  const request = {
    user: { userId },
    headers,
    tenant: undefined as unknown,
  };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  };
}

describe("TenantGuard", () => {
  let guard: TenantGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new TenantGuard(mockPrisma as never);
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "usr_1",
      memberships: [{ organizationId: "org_1", role: "OWNER" }],
    });
    mockPrisma.branch.findFirst.mockResolvedValue({ id: "br_1", organizationId: "org_1" });
  });

  it("requires X-Organization-Id header", async () => {
    const ctx = mockContext({});
    await expect(guard.canActivate(ctx as never)).rejects.toThrow(BadRequestException);
  });

  it("rejects users without membership", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "usr_1",
      memberships: [],
    });
    const ctx = mockContext({ "x-organization-id": "org_1" });
    await expect(guard.canActivate(ctx as never)).rejects.toThrow(ForbiddenException);
  });

  it("allows org-scoped access without branch header", async () => {
    const ctx = mockContext({ "x-organization-id": "org_1" });
    await expect(guard.canActivate(ctx as never)).resolves.toBe(true);
  });

  it("rejects branch header from another organization", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "usr_1",
      memberships: [{ organizationId: "org_new", role: "OWNER" }],
    });
    mockPrisma.branch.findFirst.mockResolvedValue(null);
    const ctx = mockContext({
      "x-organization-id": "org_new",
      "x-branch-id": "br_old",
    });
    await expect(guard.canActivate(ctx as never)).rejects.toThrow(
      /Branch does not belong/,
    );
  });

  it("rejects non-admin without branch grant", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "usr_1",
      memberships: [{ organizationId: "org_1", role: "CASHIER" }],
    });
    mockPrisma.branch.findFirst.mockResolvedValue({ id: "br_1", organizationId: "org_1" });
    mockPrisma.userBranch.findUnique.mockResolvedValue(null);
    const ctx = mockContext({
      "x-organization-id": "org_1",
      "x-branch-id": "br_1",
    });
    await expect(guard.canActivate(ctx as never)).rejects.toThrow(
      /You do not have access to this branch/,
    );
  });

  it("attaches tenant context with role for valid org and branch", async () => {
    const ctx = mockContext({
      "x-organization-id": "org_1",
      "x-branch-id": "br_1",
    });
    const request = ctx.switchToHttp().getRequest();

    await guard.canActivate(ctx as never);

    expect(request.tenant).toEqual({
      organizationId: "org_1",
      branchId: "br_1",
      userId: "usr_1",
      role: "OWNER",
    });
  });
});
