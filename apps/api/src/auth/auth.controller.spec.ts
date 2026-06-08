import type { Request, Response } from "express";
import { AuthController } from "./auth.controller";
import {
  clearRefreshCookie,
  readRefreshCookie,
  setRefreshCookie,
} from "./auth-cookie.util";

jest.mock("./auth-cookie.util", () => ({
  setRefreshCookie: jest.fn(),
  clearRefreshCookie: jest.fn(),
  readRefreshCookie: jest.fn(),
}));

const mockAuthService = {
  register: jest.fn(),
  login: jest.fn(),
  refresh: jest.fn(),
  logout: jest.fn(),
  forgotPassword: jest.fn(),
  resetPassword: jest.fn(),
  getInvitePreview: jest.fn(),
  acceptInvite: jest.fn(),
  syncUser: jest.fn(),
};

const mockConfig = {
  get: jest.fn((key: string, fallback?: string) => {
    if (key === "AUTH_COOKIE_NAME") return "erp_refresh";
    return fallback;
  }),
  getOrThrow: jest.fn(),
};

const sessionResult = {
  accessToken: "access-token",
  refreshToken: "refresh-token",
  user: { id: "usr_1", email: "user@example.com", name: "Test User" },
};

function mockReq(cookies: Record<string, string> = {}): Request {
  return {
    cookies,
    headers: { "user-agent": "jest" },
    ip: "127.0.0.1",
  } as Request;
}

function mockRes(): Response {
  return {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  } as unknown as Response;
}

describe("AuthController", () => {
  let controller: AuthController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new AuthController(mockAuthService as never, mockConfig as never);
    mockAuthService.register.mockResolvedValue(sessionResult);
    mockAuthService.login.mockResolvedValue(sessionResult);
    mockAuthService.refresh.mockResolvedValue(sessionResult);
    mockAuthService.logout.mockResolvedValue(undefined);
    mockAuthService.forgotPassword.mockResolvedValue({ ok: true });
    mockAuthService.resetPassword.mockResolvedValue({ ok: true });
    mockAuthService.getInvitePreview.mockResolvedValue({
      email: "invite@example.com",
      organizationName: "Org",
      organizationId: "org_1",
    });
    mockAuthService.acceptInvite.mockResolvedValue(sessionResult);
  });

  it("POST register sets refresh cookie and returns session body", async () => {
    const req = mockReq();
    const res = mockRes();
    const body = { email: "user@example.com", password: "password12", name: "Test" };

    const result = await controller.register(body, req, res);

    expect(mockAuthService.register).toHaveBeenCalledWith(body, {
      userAgent: "jest",
      ip: "127.0.0.1",
    });
    expect(setRefreshCookie).toHaveBeenCalledWith(res, mockConfig, "refresh-token");
    expect(result).toEqual({
      accessToken: "access-token",
      user: sessionResult.user,
    });
  });

  it("POST login sets refresh cookie and returns session body", async () => {
    const req = mockReq();
    const res = mockRes();
    const body = { email: "user@example.com", password: "password12" };

    const result = await controller.login(body, req, res);

    expect(mockAuthService.login).toHaveBeenCalledWith(body, {
      userAgent: "jest",
      ip: "127.0.0.1",
    });
    expect(setRefreshCookie).toHaveBeenCalledWith(res, mockConfig, "refresh-token");
    expect(result.accessToken).toBe("access-token");
  });

  it("POST refresh without cookie returns null access token", async () => {
    (readRefreshCookie as jest.Mock).mockReturnValue(undefined);
    const res = mockRes();

    const result = await controller.refresh(mockReq(), res);

    expect(clearRefreshCookie).toHaveBeenCalledWith(res, mockConfig);
    expect(mockAuthService.refresh).not.toHaveBeenCalled();
    expect(result).toEqual({ accessToken: null });
  });

  it("POST refresh with valid cookie rotates session", async () => {
    (readRefreshCookie as jest.Mock).mockReturnValue("existing-refresh");
    const req = mockReq({ erp_refresh: "existing-refresh" });
    const res = mockRes();

    const result = await controller.refresh(req, res);

    expect(mockAuthService.refresh).toHaveBeenCalledWith("existing-refresh", {
      userAgent: "jest",
      ip: "127.0.0.1",
    });
    expect(setRefreshCookie).toHaveBeenCalledWith(res, mockConfig, "refresh-token");
    expect(result).toEqual({
      accessToken: "access-token",
      user: sessionResult.user,
    });
  });

  it("POST refresh clears cookie when session is invalid", async () => {
    (readRefreshCookie as jest.Mock).mockReturnValue("stale-refresh");
    mockAuthService.refresh.mockRejectedValue(new Error("invalid"));
    const res = mockRes();

    const result = await controller.refresh(mockReq({ erp_refresh: "stale-refresh" }), res);

    expect(clearRefreshCookie).toHaveBeenCalledWith(res, mockConfig);
    expect(result).toEqual({ accessToken: null });
  });

  it("POST logout revokes refresh cookie and returns ok", async () => {
    (readRefreshCookie as jest.Mock).mockReturnValue("refresh-token");
    const res = mockRes();

    const result = await controller.logout(mockReq({ erp_refresh: "refresh-token" }), res);

    expect(mockAuthService.logout).toHaveBeenCalledWith("refresh-token");
    expect(clearRefreshCookie).toHaveBeenCalledWith(res, mockConfig);
    expect(result).toEqual({ ok: true });
  });

  it("POST forgot-password delegates to AuthService", async () => {
    const body = { email: "user@example.com" };
    const result = await controller.forgotPassword(body);
    expect(mockAuthService.forgotPassword).toHaveBeenCalledWith(body);
    expect(result).toEqual({ ok: true });
  });

  it("POST reset-password delegates to AuthService", async () => {
    const body = { token: "reset-token", password: "newpass12" };
    const result = await controller.resetPassword(body);
    expect(mockAuthService.resetPassword).toHaveBeenCalledWith(body);
    expect(result).toEqual({ ok: true });
  });

  it("GET invite/:token returns invite preview", async () => {
    const result = await controller.getInvite("invite-token");
    expect(mockAuthService.getInvitePreview).toHaveBeenCalledWith("invite-token");
    expect(result.organizationName).toBe("Org");
  });

  it("POST accept-invite sets refresh cookie and returns session body", async () => {
    const req = mockReq();
    const res = mockRes();
    const body = { token: "invite-token", password: "password12", name: "Invitee" };

    const result = await controller.acceptInvite(body, req, res);

    expect(mockAuthService.acceptInvite).toHaveBeenCalledWith(body, {
      userAgent: "jest",
      ip: "127.0.0.1",
    });
    expect(setRefreshCookie).toHaveBeenCalledWith(res, mockConfig, "refresh-token");
    expect(result.accessToken).toBe("access-token");
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
