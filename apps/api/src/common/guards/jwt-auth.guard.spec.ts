import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { JwtAuthGuard } from "./jwt-auth.guard";

const mockTokens = {
  verifyAccessToken: jest.fn(),
};

function mockContext(headers: Record<string, string>) {
  const request = { headers, user: undefined as unknown };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as ExecutionContext;
}

describe("JwtAuthGuard", () => {
  let guard: JwtAuthGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new JwtAuthGuard(mockTokens as never);
  });

  it("rejects requests without Authorization header", async () => {
    await expect(guard.canActivate(mockContext({}))).rejects.toThrow(UnauthorizedException);
  });

  it("rejects non-Bearer authorization schemes", async () => {
    await expect(
      guard.canActivate(mockContext({ authorization: "Basic abc" })),
    ).rejects.toThrow(UnauthorizedException);
  });

  it("attaches user claims on valid Bearer token", async () => {
    const claims = { userId: "usr_1", email: "a@b.c" };
    mockTokens.verifyAccessToken.mockResolvedValue(claims);
    const ctx = mockContext({ authorization: "Bearer valid-token" });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(ctx.switchToHttp().getRequest().user).toEqual(claims);
    expect(mockTokens.verifyAccessToken).toHaveBeenCalledWith("valid-token");
  });

  it("rejects invalid tokens", async () => {
    mockTokens.verifyAccessToken.mockRejectedValue(new Error("bad token"));
    await expect(
      guard.canActivate(mockContext({ authorization: "Bearer invalid" })),
    ).rejects.toThrow(UnauthorizedException);
  });
});
