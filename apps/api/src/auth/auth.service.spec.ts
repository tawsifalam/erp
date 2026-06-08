import { Role } from "@erp/types";
import { AuthService } from "./auth.service";

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  userOrganization: {
    count: jest.fn(),
  },
  organizationJoinRequest: {
    findFirst: jest.fn(),
  },
  organizationInvite: {
    findFirst: jest.fn(),
  },
};

const mockTenants = {
  fulfillPendingInvitesForUser: jest.fn().mockResolvedValue([]),
};

const mockPasswords = {
  hash: jest.fn().mockResolvedValue("hash"),
  verify: jest.fn().mockResolvedValue(true),
};

const mockTokens = {
  signAccessToken: jest.fn().mockResolvedValue("access-token"),
  signInviteToken: jest.fn().mockResolvedValue("invite-token"),
  signPasswordResetToken: jest.fn().mockResolvedValue("reset-token"),
  verifyInviteToken: jest.fn(),
  verifyPasswordResetToken: jest.fn(),
};

const mockSessions = {
  createRefreshToken: jest.fn().mockReturnValue("refresh-token"),
  storeRefreshToken: jest.fn().mockResolvedValue(undefined),
  validateRefreshToken: jest.fn(),
  revokeRefreshToken: jest.fn().mockResolvedValue(undefined),
  rotateRefreshToken: jest.fn().mockResolvedValue(undefined),
};

const mockEmailAuth = {
  sendInviteEmail: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
};

describe("AuthService", () => {
  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(
      mockPrisma as never,
      mockTenants as never,
      mockPasswords as never,
      mockTokens as never,
      mockSessions as never,
      mockEmailAuth as never,
    );
  });

  it("syncUser fulfills invites and returns membership status", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "usr_1",
      email: "test@example.com",
      memberships: [],
    });
    mockPrisma.userOrganization.count.mockResolvedValue(0);
    mockPrisma.organizationJoinRequest.findFirst.mockResolvedValue(null);

    const result = await service.syncUser({
      userId: "usr_1",
      email: "test@example.com",
    });

    expect(mockTenants.fulfillPendingInvitesForUser).toHaveBeenCalledWith(
      "usr_1",
      "test@example.com",
    );
    expect(result.hasActiveMembership).toBe(false);
    expect(result.pendingJoinRequest).toBeNull();
  });

  it("syncUser reports active membership", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "usr_1",
      email: "a@b.c",
      memberships: [{ role: Role.ADMIN }],
    });
    mockPrisma.userOrganization.count.mockResolvedValue(1);
    mockPrisma.organizationJoinRequest.findFirst.mockResolvedValue(null);

    const result = await service.syncUser({ userId: "usr_1", email: "a@b.c" });
    expect(result.hasActiveMembership).toBe(true);
  });

  it("login returns access and refresh tokens", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "usr_1",
      email: "a@b.c",
      name: "Test User",
      passwordHash: "hash",
    });

    const result = await service.login({ email: "a@b.c", password: "secret" });

    expect(mockPasswords.verify).toHaveBeenCalled();
    expect(result.accessToken).toBe("access-token");
    expect(result.refreshToken).toBe("refresh-token");
  });
});
