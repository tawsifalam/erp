import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

const mockAuthService = {
  syncUser: jest.fn(),
};

const mockConfig = {
  get: jest.fn((key: string, fallback?: string) => fallback),
  getOrThrow: jest.fn(),
};

describe("AuthController", () => {
  let controller: AuthController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new AuthController(mockAuthService as never, mockConfig as never);
  });

  it("POST sync delegates to AuthService with JWT claims", async () => {
    const claims = {
      userId: "usr_1",
      email: "user@example.com",
    };
    mockAuthService.syncUser.mockResolvedValue({
      hasActiveMembership: false,
      pendingJoinRequest: null,
    });

    const result = await controller.sync(claims);

    expect(mockAuthService.syncUser).toHaveBeenCalledWith(claims);
    expect(result.hasActiveMembership).toBe(false);
  });

  it("POST me returns JWT claims unchanged", () => {
    const claims = { userId: "usr_1", email: "a@b.c" };
    expect(controller.me(claims)).toEqual(claims);
  });
});
