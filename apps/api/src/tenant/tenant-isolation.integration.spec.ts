import { INestApplication } from "@nestjs/common";
import { MovementDirection, MovementType } from "@erp/types";
import {
  cleanupIntegrationFixture,
  createIntegrationApp,
  disconnectHarnessPrisma,
  getHarnessPrisma,
  INTEGRATION_PREFIX,
  integrationRequest,
  integrationRequestWithoutOrg,
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

  it("rejects foreign itemId on inventory movement", async () => {
    const res = await integrationRequest(app, fixture.tokens.ownerA, {
      method: "post",
      path: "/api/inventory/movements",
      orgId: fixture.orgAId,
      branchId: fixture.branchA1Id,
      body: {
        itemId: fixture.itemA2Id,
        movementType: MovementType.ADJUSTMENT,
        quantity: 1,
        direction: MovementDirection.OUT,
      },
    });

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/Inventory item not found/);
  });

  it("rejects foreign menuItemId on POS order create", async () => {
    const res = await integrationRequest(app, fixture.tokens.ownerA, {
      method: "post",
      path: "/api/pos/orders",
      orgId: fixture.orgAId,
      branchId: fixture.branchA1Id,
      body: {
        lines: [{ menuItemId: fixture.menuItemB1Id, quantity: 1, unitPrice: 10 }],
      },
    });

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/Menu item not found/);
  });

  it("rejects procurement purchase orders without branch header", async () => {
    const res = await integrationRequest(app, fixture.tokens.ownerA, {
      path: "/api/procurement/purchase-orders",
      orgId: fixture.orgAId,
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/branchId is required/);
  });

  it("rejects tenant routes without X-Organization-Id header", async () => {
    const res = await integrationRequestWithoutOrg(app, fixture.tokens.ownerA, {
      path: `/api/inventory/items?branchId=${fixture.branchA1Id}`,
      branchId: fixture.branchA1Id,
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/X-Organization-Id header is required/);
  });

  it("rejects foreign guestId on reservation create", async () => {
    const res = await integrationRequest(app, fixture.tokens.ownerA, {
      method: "post",
      path: "/api/pms/reservations",
      orgId: fixture.orgAId,
      branchId: fixture.branchA1Id,
      body: {
        branchId: fixture.branchA1Id,
        guestId: fixture.guestBId,
        roomId: fixture.roomAId,
        checkIn: "2026-07-01T14:00:00.000Z",
        checkOut: "2026-07-03T11:00:00.000Z",
        totalAmount: 200,
      },
    });

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/Guest not found/);
  });

  it("rejects foreign employeeId on HR attendance clock", async () => {
    const res = await integrationRequest(app, fixture.tokens.ownerA, {
      method: "post",
      path: "/api/hr/attendance/clock",
      orgId: fixture.orgAId,
      branchId: fixture.branchA1Id,
      body: {
        employeeId: fixture.employeeBId,
        type: "CLOCK_IN",
      },
    });

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/Employee not found/);
  });

  it("does not return payroll run from another organization", async () => {
    const res = await integrationRequest(app, fixture.tokens.ownerA, {
      path: `/api/payroll/runs/${fixture.payrollRunBId}`,
      orgId: fixture.orgAId,
      branchId: fixture.branchA1Id,
    });

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/Payroll run not found/);
  });

  it("lists guests only for the active organization", async () => {
    const orgA = await integrationRequest(app, fixture.tokens.ownerA, {
      path: "/api/pms/guests",
      orgId: fixture.orgAId,
      branchId: fixture.branchA1Id,
    });
    const orgB = await integrationRequest(app, fixture.tokens.ownerB, {
      path: "/api/pms/guests",
      orgId: fixture.orgBId,
      branchId: fixture.branchB1Id,
    });

    expect(orgA.status).toBe(200);
    expect(orgB.status).toBe(200);
    const aIds = (orgA.body as { id: string }[]).map((g) => g.id);
    const bIds = (orgB.body as { id: string }[]).map((g) => g.id);
    expect(aIds).toContain(fixture.guestAId);
    expect(bIds).toContain(fixture.guestBId);
    expect(aIds).not.toContain(fixture.guestBId);
  });

  it("rejects foreign reservation on inclusions allowances", async () => {
    const res = await integrationRequest(app, fixture.tokens.ownerA, {
      path: `/api/inclusions/reservations/${fixture.reservationBId}/allowances?branchId=${fixture.branchA1Id}`,
      orgId: fixture.orgAId,
      branchId: fixture.branchA1Id,
    });

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/Reservation not found/);
  });

  it("rejects foreign integration connection webhook events", async () => {
    const res = await integrationRequest(app, fixture.tokens.ownerA, {
      path: `/api/integrations/connections/${fixture.connectionBId}/webhook-events`,
      orgId: fixture.orgAId,
      branchId: fixture.branchA1Id,
    });

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/Integration connection not found/);
  });

  it("rejects journal reverse for entry outside active organization", async () => {
    const res = await integrationRequest(app, fixture.tokens.ownerB, {
      method: "post",
      path: `/api/accounting/journals/${fixture.journalAId}/reverse`,
      orgId: fixture.orgBId,
      branchId: fixture.branchB1Id,
      body: {},
    });

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/Journal entry not found/);
  });

  it("rejects purchase order from another branch in same organization", async () => {
    const res = await integrationRequest(app, fixture.tokens.ownerA, {
      path: `/api/procurement/purchase-orders/${fixture.purchaseOrderA2Id}`,
      orgId: fixture.orgAId,
      branchId: fixture.branchA1Id,
    });

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/Purchase order not found/);
  });

  it("rejects foreign excludeReservationId on PMS availability", async () => {
    const res = await integrationRequest(app, fixture.tokens.ownerA, {
      path: `/api/pms/availability?branchId=${fixture.branchA1Id}&checkIn=2026-09-01T14:00:00Z&checkOut=2026-09-03T11:00:00Z&excludeReservationId=${fixture.reservationBId}`,
      orgId: fixture.orgAId,
      branchId: fixture.branchA1Id,
    });

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/Reservation not found/);
  });

  it("rejects mark-read for notification outside active organization", async () => {
    const res = await integrationRequest(app, fixture.tokens.ownerA, {
      method: "patch",
      path: `/api/notifications/${fixture.notificationBId}/read`,
      orgId: fixture.orgAId,
      branchId: fixture.branchA1Id,
    });

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/Notification not found/);
  });

  it("rejects fiscal period close outside active organization", async () => {
    const res = await integrationRequest(app, fixture.tokens.ownerB, {
      method: "patch",
      path: `/api/accounting/fiscal-periods/${INTEGRATION_PREFIX}-fp-a/close`,
      orgId: fixture.orgBId,
      branchId: fixture.branchB1Id,
    });

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/Fiscal period not found/);
  });

  it("rejects report job download outside active organization", async () => {
    const res = await integrationRequest(app, fixture.tokens.ownerA, {
      path: `/api/reporting/jobs/${fixture.reportJobBId}/download`,
      orgId: fixture.orgAId,
      branchId: fixture.branchA1Id,
    });

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/Report file not available/);
  });

  it("rejects foreign reservation on inclusions consume", async () => {
    const res = await integrationRequest(app, fixture.tokens.ownerA, {
      method: "post",
      path: `/api/inclusions/reservations/${fixture.reservationBId}/consume?branchId=${fixture.branchA1Id}`,
      orgId: fixture.orgAId,
      branchId: fixture.branchA1Id,
      body: {
        inclusionType: "MEAL",
        inclusionRecipeId: `${INTEGRATION_PREFIX}-recipe-dummy`,
        quantity: 1,
      },
    });

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/Reservation not found/);
  });

  it("lists vendors only for the active organization", async () => {
    const orgA = await integrationRequest(app, fixture.tokens.ownerA, {
      path: "/api/procurement/vendors",
      orgId: fixture.orgAId,
      branchId: fixture.branchA1Id,
    });
    const orgB = await integrationRequest(app, fixture.tokens.ownerB, {
      path: "/api/procurement/vendors",
      orgId: fixture.orgBId,
      branchId: fixture.branchB1Id,
    });

    expect(orgA.status).toBe(200);
    expect(orgB.status).toBe(200);
    const aIds = (orgA.body as { id: string }[]).map((v) => v.id);
    const bIds = (orgB.body as { id: string }[]).map((v) => v.id);
    expect(aIds).toContain(`${INTEGRATION_PREFIX}-ven-a`);
    expect(bIds).toContain(fixture.vendorBId);
    expect(aIds).not.toContain(fixture.vendorBId);
  });
});
