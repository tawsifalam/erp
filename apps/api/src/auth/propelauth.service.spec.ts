import { PropelAuthService } from "./propelauth.service";

const mockValidate = jest.fn();
const mockAdmin = {
  fetchOrg: jest.fn(),
  createOrg: jest.fn(),
  addUserToOrg: jest.fn(),
  removeUserFromOrg: jest.fn(),
  updateOrg: jest.fn(),
  inviteUserToOrg: jest.fn(),
  revokePendingOrgInvite: jest.fn(),
  fetchUsersInOrg: jest.fn(),
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

  it("defaultOrgAdminRole defaults to Admin", () => {
    expect(service.defaultOrgAdminRole()).toBe("Admin");
  });

  it("mapPropelAuthRoleToErp maps Owner, Admin, and Member", () => {
    expect(service.mapPropelAuthRoleToErp("Owner")).toBe("OWNER");
    expect(service.mapPropelAuthRoleToErp("Admin")).toBe("ADMIN");
    expect(service.mapPropelAuthRoleToErp("Member")).toBe("FRONT_DESK");
  });

  it("mapErpRoleToPropelAuth maps OWNER, ADMIN, and other roles", () => {
    expect(service.mapErpRoleToPropelAuth("OWNER")).toBe("Owner");
    expect(service.mapErpRoleToPropelAuth("ADMIN")).toBe("Admin");
    expect(service.mapErpRoleToPropelAuth("CASHIER")).toBe("Member");
  });

  it("removeUserFromOrg delegates to PropelAuth admin API", async () => {
    mockAdmin.removeUserFromOrg.mockResolvedValue(true);

    await service.removeUserFromOrg("pa_org_1", "pa_user_1");

    expect(mockAdmin.removeUserFromOrg).toHaveBeenCalledWith({
      orgId: "pa_org_1",
      userId: "pa_user_1",
    });
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

    await service.inviteUserToOrg("pa_org_1", "new@example.com", "Admin");

    expect(mockAdmin.inviteUserToOrg).toHaveBeenCalledWith({
      orgId: "pa_org_1",
      email: "new@example.com",
      role: "Admin",
    });
  });

  it("validateAuthorizationHeader maps user and all orgs", async () => {
    mockValidate.mockResolvedValue({
      userId: "usr_1",
      email: "owner@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
      getOrgs: () => [
        { orgId: "pa_org_1", orgName: "Org One", assignedRole: "Owner" },
        { orgId: "pa_org_2", orgName: "Org Two", assignedRole: "Member" },
      ],
    });

    const payload = await service.validateAuthorizationHeader("Bearer token");

    expect(payload).toEqual({
      userId: "usr_1",
      email: "owner@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
      orgId: "pa_org_1",
      orgs: [
        { orgId: "pa_org_1", orgName: "Org One", role: "Owner" },
        { orgId: "pa_org_2", orgName: "Org Two", role: "Member" },
      ],
    });
  });

  it("fetchAllUsersInOrg paginates through PropelAuth results", async () => {
    mockAdmin.fetchUsersInOrg
      .mockResolvedValueOnce({
        users: [{ userId: "u1", email: "a@b.c" }],
        hasMoreResults: true,
      })
      .mockResolvedValueOnce({
        users: [{ userId: "u2", email: "b@b.c" }],
        hasMoreResults: false,
      });

    const users = await service.fetchAllUsersInOrg("pa_org_1");

    expect(users).toHaveLength(2);
    expect(mockAdmin.fetchUsersInOrg).toHaveBeenCalledTimes(2);
  });
});
