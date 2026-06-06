import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

const mockAuthService = {
  syncUser: jest.fn(),
};

describe("AuthController", () => {
  let controller: AuthController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new AuthController(mockAuthService as never);
  });

  it("POST sync delegates to AuthService with JWT claims", async () => {
    const claims = {
      userId: "pa_1",
      email: "user@example.com",
      firstName: "Test",
      lastName: "User",
    };
    mockAuthService.syncUser.mockResolvedValue({
      hasActiveMembership: false,
      pendingJoinRequest: null,
    });

    const result = await controller.sync(claims);

    expect(mockAuthService.syncUser).toHaveBeenCalledWith(claims);
    expect(result.hasActiveMembership).toBe(false);
  });

  it("GET me returns JWT claims unchanged", () => {
    const claims = { userId: "pa_1", email: "a@b.c", orgId: "pa_org" };

    expect(controller.me(claims)).toEqual(claims);
  });
});
