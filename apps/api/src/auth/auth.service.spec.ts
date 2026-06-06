import { JoinRequestStatus, Role } from "@erp/types";
import { AuthService } from "./auth.service";

const mockPrisma = {
  user: {
    upsert: jest.fn(),
    findUnique: jest.fn(),
  },
  userOrganization: {
    count: jest.fn(),
  },
  organizationJoinRequest: {
    findFirst: jest.fn(),
  },
};

const mockTenants = {
  fulfillPendingInvitesForUser: jest.fn().mockResolvedValue([]),
  syncUserPropelAuthOrgMemberships: jest.fn().mockResolvedValue(undefined),
  syncPropelAuthOrgUsersToDb: jest.fn().mockResolvedValue({ usersSynced: 0, membershipsAdded: 0 }),
};

describe("AuthService", () => {
  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockTenants.fulfillPendingInvitesForUser.mockResolvedValue([]);
    service = new AuthService(mockPrisma as never, mockTenants as never);
  });

  it("syncUser upserts user only without creating org membership", async () => {
    mockPrisma.user.upsert.mockResolvedValue({
      id: "usr_1",
      email: "test@example.com",
      propelAuthUserId: "pa_1",
    });
    mockPrisma.userOrganization.count.mockResolvedValue(0);
    mockPrisma.organizationJoinRequest.findFirst.mockResolvedValue(null);
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "usr_1",
      memberships: [],
    });

    const result = await service.syncUser({
      userId: "pa_1",
      email: "test@example.com",
    });

    expect(mockPrisma.user.upsert).toHaveBeenCalled();
    expect(mockTenants.fulfillPendingInvitesForUser).toHaveBeenCalledWith(
      "usr_1",
      "test@example.com",
    );
    expect(result.hasActiveMembership).toBe(false);
    expect(result.pendingJoinRequest).toBeNull();
  });

  it("syncUser returns pending join request when present", async () => {
    mockPrisma.user.upsert.mockResolvedValue({ id: "usr_1" });
    mockPrisma.userOrganization.count.mockResolvedValue(0);
    mockPrisma.organizationJoinRequest.findFirst.mockResolvedValue({
      id: "ojr_1",
      organizationId: "org_1",
      message: null,
      createdAt: new Date(),
      organization: { id: "org_1", name: "Test Org" },
    });
    mockPrisma.user.findUnique.mockResolvedValue({ id: "usr_1", memberships: [] });

    const result = await service.syncUser({ userId: "pa_1", email: "a@b.c" });

    expect(result.pendingJoinRequest?.organizationName).toBe("Test Org");
  });

  it("syncUser reports active membership", async () => {
    mockPrisma.user.upsert.mockResolvedValue({ id: "usr_1" });
    mockPrisma.userOrganization.count.mockResolvedValue(1);
    mockPrisma.organizationJoinRequest.findFirst.mockResolvedValue(null);
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "usr_1",
      memberships: [{ role: Role.ADMIN }],
    });

    const result = await service.syncUser({ userId: "pa_1", email: "a@b.c" });
    expect(result.hasActiveMembership).toBe(true);
  });

  it("syncUser syncs PropelAuth org memberships and org users", async () => {
    mockPrisma.user.upsert.mockResolvedValue({ id: "usr_1", email: "a@b.c" });
    mockPrisma.userOrganization.count.mockResolvedValue(1);
    mockPrisma.organizationJoinRequest.findFirst.mockResolvedValue(null);
    mockPrisma.user.findUnique.mockResolvedValue({ id: "usr_1", memberships: [] });

    await service.syncUser({
      userId: "pa_1",
      email: "a@b.c",
      orgs: [{ orgId: "pa_org_1", role: "Member" }],
    });

    expect(mockTenants.syncUserPropelAuthOrgMemberships).toHaveBeenCalledWith(
      "usr_1",
      "a@b.c",
      [{ orgId: "pa_org_1", role: "Member" }],
    );
    expect(mockTenants.syncPropelAuthOrgUsersToDb).toHaveBeenCalledWith("pa_org_1");
  });
});
