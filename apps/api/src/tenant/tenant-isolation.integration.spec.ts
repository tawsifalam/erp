import { INestApplication } from "@nestjs/common";
import {
  cleanupIntegrationFixture,
  createIntegrationApp,
  disconnectHarnessPrisma,
  getHarnessPrisma,
  INTEGRATION_PREFIX,
  integrationRequest,
  seedIntegrationFixture,
  type IntegrationFixture,
} from "../test/integration-harness";

const runIntegration =
  process.env.RUN_INTEGRATION === "1" && Boolean(process.env.DATABASE_URL);

(runIntegration ? describe : describe.skip)("Tenant isolation (integration)", () => {
  let app: INestApplication;
  let fixture: IntegrationFixture;

  beforeAll(async () => {
    const prisma = getHarnessPrisma();
    app = await createIntegrationApp();
    fixture = await seedIntegrationFixture(prisma);
  });

  afterAll(async () => {
    await cleanupIntegrationFixture(getHarnessPrisma());
    if (app) await app.close();
    await disconnectHarnessPrisma();
  });

  it("rejects foreign branchId on inventory list", async () => {
    const res = await integrationRequest(app, fixture.tokens.ownerA, {
      path: `/api/inventory/items?branchId=${fixture.branchB1Id}`,
      orgId: fixture.orgAId,
      branchId: fixture.branchA1Id,
    });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/Branch does not belong/);
  });

  it("rejects foreign accountId on journal create", async () => {
    const res = await integrationRequest(app, fixture.tokens.ownerA, {
      method: "post",
      path: "/api/accounting/journals",
      orgId: fixture.orgAId,
      branchId: fixture.branchA1Id,
      body: {
        lines: [
          { accountId: fixture.accountBId, debit: 10, credit: 0 },
          {
            accountId: `${INTEGRATION_PREFIX}-acc-a-rev`,
            debit: 0,
            credit: 10,
          },
        ],
      },
    });

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/Account not found/);
  });

  it("rejects foreign roomId on PMS pricing quote", async () => {
    const res = await integrationRequest(app, fixture.tokens.ownerA, {
      path: `/api/pms/pricing/quote?roomId=${fixture.roomBId}&checkIn=2026-06-01T14:00:00Z&checkOut=2026-06-03T11:00:00Z`,
      orgId: fixture.orgAId,
      branchId: fixture.branchA1Id,
    });

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/Room not found/);
  });

  it("rejects FRONT_DESK without branch grant on another branch in same org", async () => {
    const res = await integrationRequest(app, fixture.tokens.frontDeskA, {
      path: `/api/pms/rooms?branchId=${fixture.branchA2Id}`,
      orgId: fixture.orgAId,
      branchId: fixture.branchA1Id,
    });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/do not have access/);
  });
});
