import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import * as cookieParser from "cookie-parser";
import { AppModule } from "../app.module";
import { TokenService } from "./token.service";
import {
  cleanupIntegrationFixture,
  disconnectHarnessPrisma,
  getHarnessPrisma,
  INTEGRATION_PREFIX,
} from "../test/integration-harness";

const runIntegration =
  process.env.RUN_INTEGRATION === "1" && Boolean(process.env.DATABASE_URL);

(runIntegration ? describe : describe.skip)("Auth (integration)", () => {
  let app: INestApplication;
  let baseUrl: string;
  const testEmail = `${INTEGRATION_PREFIX}-auth-user@test.local`;
  const testPassword = "IntegrationTest1!";
  const newPassword = "IntegrationTest2!";

  beforeAll(async () => {
    const prisma = getHarnessPrisma();
    await cleanupIntegrationFixture(prisma);
    await prisma.user.deleteMany({ where: { email: testEmail } });

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
    );
    app.setGlobalPrefix("api");
    await app.init();
    await app.listen(0);
    const server = app.getHttpServer();
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 3001;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    const prisma = getHarnessPrisma();
    await prisma.user.deleteMany({ where: { email: testEmail } });
    if (app) await app.close();
    await disconnectHarnessPrisma();
  });

  it("registers, logs in, and refreshes session", async () => {
    const registerRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testEmail, password: testPassword, name: "Auth Test" }),
    });
    expect(registerRes.status).toBe(200);
    const registerBody = (await registerRes.json()) as {
      accessToken: string;
      user: { id: string; email: string };
    };
    expect(registerBody.accessToken).toBeTruthy();
    expect(registerBody.user.email).toBe(testEmail);

    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testEmail, password: testPassword }),
    });
    expect(loginRes.status).toBe(200);
    const setCookie = loginRes.headers.get("set-cookie") ?? "";
    expect(setCookie).toMatch(/erp_refresh=/);

    const refreshRes = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: "POST",
      headers: { Cookie: setCookie.split(";")[0] ?? "" },
    });
    expect(refreshRes.status).toBe(200);
    const refreshBody = (await refreshRes.json()) as { accessToken: string | null };
    expect(refreshBody.accessToken).toBeTruthy();
  });

  it("returns 401 for protected route without token", async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status).toBe(401);
  });

  it("logs out and clears refresh session", async () => {
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testEmail, password: testPassword }),
    });
    expect(loginRes.status).toBe(200);
    const setCookie = loginRes.headers.get("set-cookie") ?? "";
    const refreshCookie = setCookie.split(";")[0] ?? "";

    const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
      method: "POST",
      headers: { Cookie: refreshCookie },
    });
    expect(logoutRes.status).toBe(200);

    const refreshRes = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: "POST",
      headers: { Cookie: refreshCookie },
    });
    expect(refreshRes.status).toBe(200);
    const refreshBody = (await refreshRes.json()) as { accessToken: string | null };
    expect(refreshBody.accessToken).toBeNull();
  });

  it("rejects duplicate registration", async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testEmail, password: testPassword, name: "Duplicate" }),
    });
    expect(res.status).toBe(409);
  });

  it("resets password and allows login with new password", async () => {
    const prisma = getHarnessPrisma();
    const user = await prisma.user.findUnique({ where: { email: testEmail } });
    expect(user).toBeTruthy();

    const tokenService = app.get(TokenService);
    const resetToken = await tokenService.signPasswordResetToken(user!.id, testEmail);

    const resetRes = await fetch(`${baseUrl}/api/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: resetToken, password: newPassword }),
    });
    expect(resetRes.status).toBe(200);

    const oldLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testEmail, password: testPassword }),
    });
    expect(oldLoginRes.status).toBe(401);

    const newLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testEmail, password: newPassword }),
    });
    expect(newLoginRes.status).toBe(200);

    // Restore password for other integration cases in this file.
    const restoreToken = await tokenService.signPasswordResetToken(user!.id, testEmail);
    await fetch(`${baseUrl}/api/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: restoreToken, password: testPassword }),
    });
  });
});
