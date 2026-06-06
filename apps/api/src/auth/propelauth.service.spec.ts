import { PropelAuthService } from "./propelauth.service";

const mockValidate = jest.fn();
const mockAdmin = {
  fetchOrg: jest.fn(),
  createOrg: jest.fn(),
  addUserToOrg: jest.fn(),
  updateOrg: jest.fn(),
  inviteUserToOrg: jest.fn(),
  revokePendingOrgInvite: jest.fn(),
  validateAccessTokenAndGetUserClass: mockValidate,
};

jest.mock("@propelauth/node", () => ({
  initBaseAuth: jest.fn(() => mockAdmin),
}));

describe("PropelAuthService", () => {
  let service: PropelAuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    const config = {
      get: jest.fn((key: string) => {
        if (key === "PROPELAUTH_ORG_MEMBER_ROLE") return "Member";
        return undefined;
      }),
      getOrThrow: jest.fn((key: string) => {
        if (key === "PROPELAUTH_AUTH_URL") return "https://auth.example.com";
        if (key === "PROPELAUTH_API_KEY") return "test-api-key";
        throw new Error(`missing ${key}`);
      }),
    };
    service = new PropelAuthService(config as never);
    service.onModuleInit();
  });

  it("defaultOrgInviteRole reads config with Member fallback", () => {
    expect(service.defaultOrgInviteRole()).toBe("Member");
  });

  it("defaultOrgOwnerRole defaults to Owner", () => {
    expect(service.defaultOrgOwnerRole()).toBe("Owner");
  });

  it("addUserToOrg delegates to PropelAuth admin API", async () => {
    mockAdmin.addUserToOrg.mockResolvedValue(true);

    await service.addUserToOrg("pa_org_1", "pa_user_1");

    expect(mockAdmin.addUserToOrg).toHaveBeenCalledWith({
      orgId: "pa_org_1",
      userId: "pa_user_1",
      role: "Owner",
    });
  });

  it("updateOrg delegates to PropelAuth admin API", async () => {
    mockAdmin.updateOrg.mockResolvedValue(true);

    await service.updateOrg("pa_org_1", "Renamed Org");

    expect(mockAdmin.updateOrg).toHaveBeenCalledWith({
      orgId: "pa_org_1",
      name: "Renamed Org",
    });
  });

  it("inviteUserToOrg delegates to PropelAuth admin API", async () => {
    mockAdmin.inviteUserToOrg.mockResolvedValue(true);

    await service.inviteUserToOrg("pa_org_1", "new@example.com");

    expect(mockAdmin.inviteUserToOrg).toHaveBeenCalledWith({
      orgId: "pa_org_1",
      email: "new@example.com",
      role: "Member",
    });
  });

  it("validateAuthorizationHeader maps user and first org", async () => {
    mockValidate.mockResolvedValue({
      userId: "usr_1",
      email: "owner@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
      getOrgs: () => [{ orgId: "pa_org_1" }],
    });

    const payload = await service.validateAuthorizationHeader("Bearer token");

    expect(payload).toEqual({
      userId: "usr_1",
      email: "owner@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
      orgId: "pa_org_1",
    });
  });
});
