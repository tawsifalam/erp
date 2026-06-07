import {
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
import { AppModule } from "../app.module";
import { PropelAuthGuard } from "../common/guards/propelauth.guard";
import { UserBranchStatus } from "../tenants/branch-access.constants";

/** Plain client — PrismaService rewrites ids that lack model prefixes on create/upsert. */
let harnessPrisma: PrismaClient | undefined;

export function getHarnessPrisma(): PrismaClient {
  if (!harnessPrisma) {
    harnessPrisma = new PrismaClient();
  }
  return harnessPrisma;
}

export async function disconnectHarnessPrisma(): Promise<void> {
  if (harnessPrisma) {
    await harnessPrisma.$disconnect();
    harnessPrisma = undefined;
  }
}

export const INTEGRATION_PREFIX = "int-tenant-iso";

export type IntegrationFixture = {
  orgAId: string;
  orgBId: string;
  branchA1Id: string;
  branchA2Id: string;
  branchB1Id: string;
  ownerAUserId: string;
  frontDeskUserId: string;
  ownerBUserId: string;
  roomAId: string;
  roomBId: string;
  accountAId: string;
  accountBId: string;
  itemA1Id: string;
  itemA2Id: string;
  menuItemA1Id: string;
  menuItemB1Id: string;
  guestAId: string;
  guestBId: string;
  employeeAId: string;
  employeeBId: string;
  payrollRunBId: string;
  reservationAId: string;
  reservationBId: string;
  connectionAId: string;
  connectionBId: string;
  journalAId: string;
  purchaseOrderA2Id: string;
  vendorBId: string;
  notificationBId: string;
  reportJobBId: string;
  fiscalPeriodBId: string;
  joinRequestAId: string;
  tokens: {
    ownerA: string;
    frontDeskA: string;
    ownerB: string;
  };
};

const TOKEN_TO_PROPEL: Record<string, string> = {
  "Bearer int-owner-a": `${INTEGRATION_PREFIX}-pa-owner-a`,
  "Bearer int-front-desk": `${INTEGRATION_PREFIX}-pa-front`,
  "Bearer int-owner-b": `${INTEGRATION_PREFIX}-pa-owner-b`,
};

let integrationBaseUrl: string | undefined;

export async function createIntegrationApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideGuard(PropelAuthGuard)
    .useValue({
      canActivate: (context: import("@nestjs/common").ExecutionContext) => {
        const req = context.switchToHttp().getRequest();
        const auth = req.headers.authorization as string | undefined;
        const propelId = auth ? TOKEN_TO_PROPEL[auth] : undefined;
        if (!propelId) {
          throw new UnauthorizedException("Invalid or missing access token");
        }
        req.user = { userId: propelId };
        return true;
      },
    })
    .compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );
  app.setGlobalPrefix("api");
  await app.init();
  await app.listen(0);
  const server = app.getHttpServer();
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 3001;
  integrationBaseUrl = `http://127.0.0.1:${port}`;
  return app;
}

export async function seedIntegrationFixture(
  prisma: PrismaClient,
): Promise<IntegrationFixture> {
  const orgAId = `${INTEGRATION_PREFIX}-org-a`;
  const orgBId = `${INTEGRATION_PREFIX}-org-b`;
  const branchA1Id = `${INTEGRATION_PREFIX}-br-a1`;
  const branchA2Id = `${INTEGRATION_PREFIX}-br-a2`;
  const branchB1Id = `${INTEGRATION_PREFIX}-br-b1`;

  await cleanupIntegrationFixture(prisma);

  await prisma.organization.upsert({
    where: { id: orgAId },
    create: {
      id: orgAId,
      name: "Integration Org A",
      propelAuthOrgId: `${INTEGRATION_PREFIX}-pa-org-a`,
      joinCode: `${INTEGRATION_PREFIX}-join-a`,
    },
    update: {
      name: "Integration Org A",
      propelAuthOrgId: `${INTEGRATION_PREFIX}-pa-org-a`,
      joinCode: `${INTEGRATION_PREFIX}-join-a`,
    },
  });
  await prisma.organization.upsert({
    where: { id: orgBId },
    create: {
      id: orgBId,
      name: "Integration Org B",
      propelAuthOrgId: `${INTEGRATION_PREFIX}-pa-org-b`,
      joinCode: `${INTEGRATION_PREFIX}-join-b`,
    },
    update: {
      name: "Integration Org B",
      propelAuthOrgId: `${INTEGRATION_PREFIX}-pa-org-b`,
      joinCode: `${INTEGRATION_PREFIX}-join-b`,
    },
  });

  for (const branch of [
    { id: branchA1Id, organizationId: orgAId, name: "Branch A1" },
    { id: branchA2Id, organizationId: orgAId, name: "Branch A2" },
    { id: branchB1Id, organizationId: orgBId, name: "Branch B1" },
  ]) {
    await prisma.branch.upsert({
      where: { id: branch.id },
      create: { ...branch, timezone: "UTC" },
      update: { organizationId: branch.organizationId, name: branch.name, timezone: "UTC" },
    });
  }

  const ownerA = await prisma.user.upsert({
    where: { id: `${INTEGRATION_PREFIX}-usr-owner-a` },
    create: {
      id: `${INTEGRATION_PREFIX}-usr-owner-a`,
      email: `${INTEGRATION_PREFIX}-owner-a@test.local`,
      propelAuthUserId: TOKEN_TO_PROPEL["Bearer int-owner-a"],
    },
    update: {
      email: `${INTEGRATION_PREFIX}-owner-a@test.local`,
      propelAuthUserId: TOKEN_TO_PROPEL["Bearer int-owner-a"],
    },
  });
  const frontDesk = await prisma.user.upsert({
    where: { id: `${INTEGRATION_PREFIX}-usr-front` },
    create: {
      id: `${INTEGRATION_PREFIX}-usr-front`,
      email: `${INTEGRATION_PREFIX}-front@test.local`,
      propelAuthUserId: TOKEN_TO_PROPEL["Bearer int-front-desk"],
    },
    update: {
      email: `${INTEGRATION_PREFIX}-front@test.local`,
      propelAuthUserId: TOKEN_TO_PROPEL["Bearer int-front-desk"],
    },
  });
  const ownerB = await prisma.user.upsert({
    where: { id: `${INTEGRATION_PREFIX}-usr-owner-b` },
    create: {
      id: `${INTEGRATION_PREFIX}-usr-owner-b`,
      email: `${INTEGRATION_PREFIX}-owner-b@test.local`,
      propelAuthUserId: TOKEN_TO_PROPEL["Bearer int-owner-b"],
    },
    update: {
      email: `${INTEGRATION_PREFIX}-owner-b@test.local`,
      propelAuthUserId: TOKEN_TO_PROPEL["Bearer int-owner-b"],
    },
  });
  const applicant = await prisma.user.upsert({
    where: { id: `${INTEGRATION_PREFIX}-usr-applicant` },
    create: {
      id: `${INTEGRATION_PREFIX}-usr-applicant`,
      email: `${INTEGRATION_PREFIX}-applicant@test.local`,
      propelAuthUserId: `${INTEGRATION_PREFIX}-pa-applicant`,
    },
    update: {
      email: `${INTEGRATION_PREFIX}-applicant@test.local`,
      propelAuthUserId: `${INTEGRATION_PREFIX}-pa-applicant`,
    },
  });

  for (const membership of [
    { userId: ownerA.id, organizationId: orgAId, role: "OWNER" },
    { userId: frontDesk.id, organizationId: orgAId, role: "FRONT_DESK" },
    { userId: ownerB.id, organizationId: orgBId, role: "OWNER" },
  ]) {
    await prisma.userOrganization.upsert({
      where: {
        userId_organizationId: {
          userId: membership.userId,
          organizationId: membership.organizationId,
        },
      },
      create: membership,
      update: { role: membership.role },
    });
  }

  await prisma.userBranch.upsert({
    where: {
      userId_branchId: { userId: frontDesk.id, branchId: branchA1Id },
    },
    create: {
      organizationId: orgAId,
      userId: frontDesk.id,
      branchId: branchA1Id,
      status: UserBranchStatus.ACTIVE,
      grantedByUserId: ownerA.id,
    },
    update: {
      organizationId: orgAId,
      status: UserBranchStatus.ACTIVE,
      grantedByUserId: ownerA.id,
    },
  });

  const roomTypeA = await prisma.roomType.upsert({
    where: { id: `${INTEGRATION_PREFIX}-rt-a` },
    create: {
      id: `${INTEGRATION_PREFIX}-rt-a`,
      organizationId: orgAId,
      name: "Standard",
      maxAdults: 2,
      maxChildren: 1,
    },
    update: { organizationId: orgAId, name: "Standard", maxAdults: 2, maxChildren: 1 },
  });
  const roomTypeB = await prisma.roomType.upsert({
    where: { id: `${INTEGRATION_PREFIX}-rt-b` },
    create: {
      id: `${INTEGRATION_PREFIX}-rt-b`,
      organizationId: orgBId,
      name: "Standard",
      maxAdults: 2,
      maxChildren: 1,
    },
    update: { organizationId: orgBId, name: "Standard", maxAdults: 2, maxChildren: 1 },
  });

  const roomA = await prisma.room.upsert({
    where: { id: `${INTEGRATION_PREFIX}-room-a` },
    create: {
      id: `${INTEGRATION_PREFIX}-room-a`,
      branchId: branchA1Id,
      roomTypeId: roomTypeA.id,
      roomNumber: "A-101",
      status: "VACANT",
      basePrice: 100,
    },
    update: {
      branchId: branchA1Id,
      roomTypeId: roomTypeA.id,
      roomNumber: "A-101",
      status: "VACANT",
      basePrice: 100,
    },
  });
  const roomB = await prisma.room.upsert({
    where: { id: `${INTEGRATION_PREFIX}-room-b` },
    create: {
      id: `${INTEGRATION_PREFIX}-room-b`,
      branchId: branchB1Id,
      roomTypeId: roomTypeB.id,
      roomNumber: "B-101",
      status: "VACANT",
      basePrice: 120,
    },
    update: {
      branchId: branchB1Id,
      roomTypeId: roomTypeB.id,
      roomNumber: "B-101",
      status: "VACANT",
      basePrice: 120,
    },
  });

  const accountA = await prisma.account.upsert({
    where: {
      organizationId_code: { organizationId: orgAId, code: "1000" },
    },
    create: {
      id: `${INTEGRATION_PREFIX}-acc-a`,
      organizationId: orgAId,
      code: "1000",
      name: "Cash A",
      type: "ASSET",
    },
    update: { name: "Cash A", type: "ASSET" },
  });
  const accountB = await prisma.account.upsert({
    where: {
      organizationId_code: { organizationId: orgBId, code: "1000" },
    },
    create: {
      id: `${INTEGRATION_PREFIX}-acc-b`,
      organizationId: orgBId,
      code: "1000",
      name: "Cash B",
      type: "ASSET",
    },
    update: { name: "Cash B", type: "ASSET" },
  });
  await prisma.account.upsert({
    where: {
      organizationId_code: { organizationId: orgAId, code: "4000" },
    },
    create: {
      id: `${INTEGRATION_PREFIX}-acc-a-rev`,
      organizationId: orgAId,
      code: "4000",
      name: "Revenue A",
      type: "REVENUE",
    },
    update: { name: "Revenue A", type: "REVENUE" },
  });
  await prisma.account.upsert({
    where: {
      organizationId_code: { organizationId: orgBId, code: "4000" },
    },
    create: {
      id: `${INTEGRATION_PREFIX}-acc-b-rev`,
      organizationId: orgBId,
      code: "4000",
      name: "Revenue B",
      type: "REVENUE",
    },
    update: { name: "Revenue B", type: "REVENUE" },
  });

  const fiscalPeriodAId = `${INTEGRATION_PREFIX}-fp-a`;
  const fiscalPeriodBId = `${INTEGRATION_PREFIX}-fp-b`;
  await prisma.fiscalPeriod.upsert({
    where: { id: fiscalPeriodAId },
    create: {
      id: fiscalPeriodAId,
      organizationId: orgAId,
      name: "FY Integration A",
      startDate: new Date("2020-01-01"),
      endDate: new Date("2030-12-31"),
      status: "OPEN",
    },
    update: {
      organizationId: orgAId,
      name: "FY Integration A",
      startDate: new Date("2020-01-01"),
      endDate: new Date("2030-12-31"),
      status: "OPEN",
    },
  });
  await prisma.fiscalPeriod.upsert({
    where: { id: fiscalPeriodBId },
    create: {
      id: fiscalPeriodBId,
      organizationId: orgBId,
      name: "FY Integration B",
      startDate: new Date("2020-01-01"),
      endDate: new Date("2030-12-31"),
      status: "OPEN",
    },
    update: {
      organizationId: orgBId,
      name: "FY Integration B",
      startDate: new Date("2020-01-01"),
      endDate: new Date("2030-12-31"),
      status: "OPEN",
    },
  });

  const poolA = await prisma.inventoryPool.upsert({
    where: { organizationId_code: { organizationId: orgAId, code: "guest" } },
    create: {
      id: `${INTEGRATION_PREFIX}-pool-a`,
      organizationId: orgAId,
      code: "guest",
      name: "Guest",
      isSystem: true,
    },
    update: { name: "Guest" },
  });

  const itemA1 = await prisma.inventoryItem.upsert({
    where: { branchId_sku: { branchId: branchA1Id, sku: "INT-A1" } },
    create: {
      id: `${INTEGRATION_PREFIX}-inv-a1`,
      branchId: branchA1Id,
      poolId: poolA.id,
      name: "Item A1",
      sku: "INT-A1",
      unit: "kg",
    },
    update: { name: "Item A1" },
  });

  const itemA2 = await prisma.inventoryItem.upsert({
    where: { branchId_sku: { branchId: branchA2Id, sku: "INT-A2" } },
    create: {
      id: `${INTEGRATION_PREFIX}-inv-a2`,
      branchId: branchA2Id,
      poolId: poolA.id,
      name: "Item A2",
      sku: "INT-A2",
      unit: "kg",
    },
    update: { name: "Item A2" },
  });

  const catA1 = await prisma.menuCategory.upsert({
    where: { id: `${INTEGRATION_PREFIX}-mc-a1` },
    create: {
      id: `${INTEGRATION_PREFIX}-mc-a1`,
      organizationId: orgAId,
      branchId: branchA1Id,
      name: "Mains",
      sortOrder: 1,
    },
    update: { name: "Mains" },
  });

  const menuItemA1 = await prisma.menuItem.upsert({
    where: { id: `${INTEGRATION_PREFIX}-mi-a1` },
    create: {
      id: `${INTEGRATION_PREFIX}-mi-a1`,
      categoryId: catA1.id,
      name: "Burger",
      price: 10,
    },
    update: { name: "Burger" },
  });

  const catB1 = await prisma.menuCategory.upsert({
    where: { id: `${INTEGRATION_PREFIX}-mc-b1` },
    create: {
      id: `${INTEGRATION_PREFIX}-mc-b1`,
      organizationId: orgBId,
      branchId: branchB1Id,
      name: "Mains",
      sortOrder: 1,
    },
    update: { name: "Mains" },
  });

  const menuItemB1 = await prisma.menuItem.upsert({
    where: { id: `${INTEGRATION_PREFIX}-mi-b1` },
    create: {
      id: `${INTEGRATION_PREFIX}-mi-b1`,
      categoryId: catB1.id,
      name: "Pasta",
      price: 12,
    },
    update: { name: "Pasta" },
  });

  const guestA = await prisma.guest.upsert({
    where: { id: `${INTEGRATION_PREFIX}-guest-a` },
    create: {
      id: `${INTEGRATION_PREFIX}-guest-a`,
      organizationId: orgAId,
      fullName: "Integration Guest A",
    },
    update: { organizationId: orgAId, fullName: "Integration Guest A" },
  });
  const guestB = await prisma.guest.upsert({
    where: { id: `${INTEGRATION_PREFIX}-guest-b` },
    create: {
      id: `${INTEGRATION_PREFIX}-guest-b`,
      organizationId: orgBId,
      fullName: "Integration Guest B",
    },
    update: { organizationId: orgBId, fullName: "Integration Guest B" },
  });

  const employeeA = await prisma.employee.upsert({
    where: { id: `${INTEGRATION_PREFIX}-emp-a` },
    create: {
      id: `${INTEGRATION_PREFIX}-emp-a`,
      organizationId: orgAId,
      branchId: branchA1Id,
      name: "Integration Employee A",
      salary: 1000,
      designation: "Staff",
    },
    update: {
      organizationId: orgAId,
      branchId: branchA1Id,
      name: "Integration Employee A",
      salary: 1000,
      designation: "Staff",
    },
  });
  const employeeB = await prisma.employee.upsert({
    where: { id: `${INTEGRATION_PREFIX}-emp-b` },
    create: {
      id: `${INTEGRATION_PREFIX}-emp-b`,
      organizationId: orgBId,
      branchId: branchB1Id,
      name: "Integration Employee B",
      salary: 1000,
      designation: "Staff",
    },
    update: {
      organizationId: orgBId,
      branchId: branchB1Id,
      name: "Integration Employee B",
      salary: 1000,
      designation: "Staff",
    },
  });

  const payrollRunB = await prisma.payrollRun.upsert({
    where: { id: `${INTEGRATION_PREFIX}-pr-b` },
    create: {
      id: `${INTEGRATION_PREFIX}-pr-b`,
      organizationId: orgBId,
      periodStart: new Date("2026-01-01"),
      periodEnd: new Date("2026-01-31"),
      status: "COMPLETED",
    },
    update: {
      organizationId: orgBId,
      periodStart: new Date("2026-01-01"),
      periodEnd: new Date("2026-01-31"),
      status: "COMPLETED",
    },
  });

  const reservationA = await prisma.reservation.upsert({
    where: { id: `${INTEGRATION_PREFIX}-res-a` },
    create: {
      id: `${INTEGRATION_PREFIX}-res-a`,
      branchId: branchA1Id,
      guestId: guestA.id,
      roomId: roomA.id,
      checkIn: new Date("2026-08-01T14:00:00Z"),
      checkOut: new Date("2026-08-03T11:00:00Z"),
      status: "CONFIRMED",
      totalAmount: 200,
      paidAmount: 0,
    },
    update: {
      branchId: branchA1Id,
      guestId: guestA.id,
      roomId: roomA.id,
      checkIn: new Date("2026-08-01T14:00:00Z"),
      checkOut: new Date("2026-08-03T11:00:00Z"),
      status: "CONFIRMED",
      totalAmount: 200,
      paidAmount: 0,
    },
  });
  const reservationB = await prisma.reservation.upsert({
    where: { id: `${INTEGRATION_PREFIX}-res-b` },
    create: {
      id: `${INTEGRATION_PREFIX}-res-b`,
      branchId: branchB1Id,
      guestId: guestB.id,
      roomId: roomB.id,
      checkIn: new Date("2026-08-01T14:00:00Z"),
      checkOut: new Date("2026-08-03T11:00:00Z"),
      status: "CONFIRMED",
      totalAmount: 240,
      paidAmount: 0,
    },
    update: {
      branchId: branchB1Id,
      guestId: guestB.id,
      roomId: roomB.id,
      checkIn: new Date("2026-08-01T14:00:00Z"),
      checkOut: new Date("2026-08-03T11:00:00Z"),
      status: "CONFIRMED",
      totalAmount: 240,
      paidAmount: 0,
    },
  });

  const connectionA = await prisma.integrationConnection.upsert({
    where: { id: `${INTEGRATION_PREFIX}-conn-a` },
    create: {
      id: `${INTEGRATION_PREFIX}-conn-a`,
      organizationId: orgAId,
      branchId: branchA1Id,
      adapterKey: "generic_webhook",
      name: "Integration Webhook A",
      webhookSecret: `${INTEGRATION_PREFIX}-secret-a`,
    },
    update: {
      organizationId: orgAId,
      branchId: branchA1Id,
      adapterKey: "generic_webhook",
      name: "Integration Webhook A",
      webhookSecret: `${INTEGRATION_PREFIX}-secret-a`,
    },
  });
  const connectionB = await prisma.integrationConnection.upsert({
    where: { id: `${INTEGRATION_PREFIX}-conn-b` },
    create: {
      id: `${INTEGRATION_PREFIX}-conn-b`,
      organizationId: orgBId,
      branchId: branchB1Id,
      adapterKey: "generic_webhook",
      name: "Integration Webhook B",
      webhookSecret: `${INTEGRATION_PREFIX}-secret-b`,
    },
    update: {
      organizationId: orgBId,
      branchId: branchB1Id,
      adapterKey: "generic_webhook",
      name: "Integration Webhook B",
      webhookSecret: `${INTEGRATION_PREFIX}-secret-b`,
    },
  });

  const vendorA = await prisma.vendor.upsert({
    where: { id: `${INTEGRATION_PREFIX}-ven-a` },
    create: {
      id: `${INTEGRATION_PREFIX}-ven-a`,
      organizationId: orgAId,
      name: "Integration Vendor A",
    },
    update: { organizationId: orgAId, name: "Integration Vendor A" },
  });
  const vendorB = await prisma.vendor.upsert({
    where: { id: `${INTEGRATION_PREFIX}-ven-b` },
    create: {
      id: `${INTEGRATION_PREFIX}-ven-b`,
      organizationId: orgBId,
      name: "Integration Vendor B",
    },
    update: { organizationId: orgBId, name: "Integration Vendor B" },
  });

  const purchaseOrderA2 = await prisma.purchaseOrder.upsert({
    where: { id: `${INTEGRATION_PREFIX}-po-a2` },
    create: {
      id: `${INTEGRATION_PREFIX}-po-a2`,
      organizationId: orgAId,
      branchId: branchA2Id,
      vendorId: vendorA.id,
      status: "DRAFT",
      lines: {
        create: [
          {
            inventoryItemId: itemA2.id,
            quantity: 5,
            unitPrice: 10,
          },
        ],
      },
    },
    update: {
      organizationId: orgAId,
      branchId: branchA2Id,
      vendorId: vendorA.id,
      status: "DRAFT",
    },
  });

  const joinRequestAId = `${INTEGRATION_PREFIX}-ojr-a`;
  await prisma.organizationJoinRequest.upsert({
    where: { id: joinRequestAId },
    create: {
      id: joinRequestAId,
      organizationId: orgAId,
      userId: applicant.id,
      status: "PENDING",
      message: "Integration applicant join request",
    },
    update: {
      organizationId: orgAId,
      userId: applicant.id,
      status: "PENDING",
      message: "Integration applicant join request",
      reviewedByUserId: null,
      reviewedAt: null,
      assignedRole: null,
    },
  });

  const notificationBId = `${INTEGRATION_PREFIX}-ntf-b`;
  await prisma.notification.upsert({
    where: { id: notificationBId },
    create: {
      id: notificationBId,
      organizationId: orgBId,
      userId: ownerB.id,
      type: "LOW_STOCK",
      title: "Integration notification B",
      body: "Org B only",
    },
    update: {
      organizationId: orgBId,
      userId: ownerB.id,
      type: "LOW_STOCK",
      title: "Integration notification B",
      body: "Org B only",
      readAt: null,
    },
  });

  const reportJobBId = `${INTEGRATION_PREFIX}-rpt-b`;
  await prisma.reportJob.upsert({
    where: { id: reportJobBId },
    create: {
      id: reportJobBId,
      organizationId: orgBId,
      branchId: branchB1Id,
      requestedByUserId: ownerB.id,
      type: "branch_summary",
      status: "COMPLETED",
      fileUrl: `erp-files/${reportJobBId}.csv`,
      completedAt: new Date("2026-06-01T12:00:00Z"),
    },
    update: {
      organizationId: orgBId,
      branchId: branchB1Id,
      requestedByUserId: ownerB.id,
      type: "branch_summary",
      status: "COMPLETED",
      fileUrl: `erp-files/${reportJobBId}.csv`,
      completedAt: new Date("2026-06-01T12:00:00Z"),
    },
  });

  const journalAId = `${INTEGRATION_PREFIX}-je-a`;
  const existingJournal = await prisma.journalEntry.findUnique({
    where: { id: journalAId },
  });
  if (!existingJournal) {
    await prisma.journalEntry.create({
      data: {
        id: journalAId,
        organizationId: orgAId,
        fiscalPeriodId: fiscalPeriodAId,
        description: "Integration journal A",
        entryDate: new Date("2026-06-01T12:00:00Z"),
        lines: {
          create: [
            { accountId: accountA.id, debit: 10, credit: 0 },
            {
              accountId: `${INTEGRATION_PREFIX}-acc-a-rev`,
              debit: 0,
              credit: 10,
            },
          ],
        },
      },
    });
  }

  return {
    orgAId,
    orgBId,
    branchA1Id,
    branchA2Id,
    branchB1Id,
    ownerAUserId: ownerA.id,
    frontDeskUserId: frontDesk.id,
    ownerBUserId: ownerB.id,
    roomAId: roomA.id,
    roomBId: roomB.id,
    accountAId: accountA.id,
    accountBId: accountB.id,
    itemA1Id: itemA1.id,
    itemA2Id: itemA2.id,
    menuItemA1Id: menuItemA1.id,
    menuItemB1Id: menuItemB1.id,
    guestAId: guestA.id,
    guestBId: guestB.id,
    employeeAId: employeeA.id,
    employeeBId: employeeB.id,
    payrollRunBId: payrollRunB.id,
    reservationAId: reservationA.id,
    reservationBId: reservationB.id,
    connectionAId: connectionA.id,
    connectionBId: connectionB.id,
    journalAId,
    purchaseOrderA2Id: purchaseOrderA2.id,
    vendorBId: vendorB.id,
    notificationBId,
    reportJobBId,
    fiscalPeriodBId,
    joinRequestAId,
    tokens: {
      ownerA: "Bearer int-owner-a",
      frontDeskA: "Bearer int-front-desk",
      ownerB: "Bearer int-owner-b",
    },
  };
}

async function findFixtureOrgIds(prisma: PrismaClient): Promise<string[]> {
  const orgs = await prisma.organization.findMany({
    where: {
      OR: [
        { id: { startsWith: INTEGRATION_PREFIX } },
        { propelAuthOrgId: { startsWith: INTEGRATION_PREFIX } },
        { joinCode: { startsWith: INTEGRATION_PREFIX } },
      ],
    },
    select: { id: true },
  });
  return orgs.map((o) => o.id);
}

async function findFixtureUserIds(prisma: PrismaClient): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { id: { startsWith: INTEGRATION_PREFIX } },
        { propelAuthUserId: { startsWith: INTEGRATION_PREFIX } },
        { email: { contains: `${INTEGRATION_PREFIX}-` } },
      ],
    },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

export async function cleanupIntegrationFixture(prisma: PrismaClient): Promise<void> {
  const orgIds = await findFixtureOrgIds(prisma);
  const userIds = await findFixtureUserIds(prisma);

  const branches = await prisma.branch.findMany({
    where: {
      OR: [
        { id: { startsWith: INTEGRATION_PREFIX } },
        ...(orgIds.length > 0 ? [{ organizationId: { in: orgIds } }] : []),
      ],
    },
    select: { id: true },
  });
  const branchIds = branches.map((b) => b.id);

  if (orgIds.length > 0 || branchIds.length > 0) {
    // Tables that reference organizationId without an Organization FK cascade.
    if (orgIds.length > 0) {
      await prisma.reportJob.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.auditLog.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.notification.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.notificationPreference.deleteMany({
        where: { organizationId: { in: orgIds } },
      });
      await prisma.journalEntry.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.organizationJoinRequest.deleteMany({
        where: { organizationId: { in: orgIds } },
      });
      await prisma.userBranch.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.userOrganization.deleteMany({ where: { organizationId: { in: orgIds } } });

      const payrollRuns = await prisma.payrollRun.findMany({
        where: { organizationId: { in: orgIds } },
        select: { id: true },
      });
      const payrollRunIds = payrollRuns.map((r) => r.id);
      if (payrollRunIds.length > 0) {
        await prisma.payrollLine.deleteMany({
          where: { payrollRunId: { in: payrollRunIds } },
        });
        await prisma.payrollRun.deleteMany({ where: { id: { in: payrollRunIds } } });
      }
    }

    if (branchIds.length > 0) {
      await prisma.reportJob.deleteMany({ where: { branchId: { in: branchIds } } });

      const purchaseOrders = await prisma.purchaseOrder.findMany({
        where: { branchId: { in: branchIds } },
        select: { id: true },
      });
      const purchaseOrderIds = purchaseOrders.map((po) => po.id);
      if (purchaseOrderIds.length > 0) {
        await prisma.goodsReceipt.deleteMany({
          where: { purchaseOrderId: { in: purchaseOrderIds } },
        });
        await prisma.vendorPayment.deleteMany({
          where: { purchaseOrderId: { in: purchaseOrderIds } },
        });
        await prisma.purchaseOrderLine.deleteMany({
          where: { purchaseOrderId: { in: purchaseOrderIds } },
        });
        await prisma.purchaseOrder.deleteMany({ where: { id: { in: purchaseOrderIds } } });
      }

      // Drop branches so reservations/rooms/inventory cascade before org removal.
      await prisma.branch.deleteMany({ where: { id: { in: branchIds } } });
    }

    if (orgIds.length > 0) {
      await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
    }
  }

  if (userIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
}

export async function integrationRequest(
  _app: INestApplication,
  token: string,
  opts: {
    method?: "get" | "post" | "patch" | "delete";
    path: string;
    orgId: string;
    branchId?: string;
    body?: Record<string, unknown>;
  },
) {
  if (!integrationBaseUrl) {
    throw new Error("Integration app not initialized");
  }

  const headers: Record<string, string> = {
    Authorization: token,
    "X-Organization-Id": opts.orgId,
  };
  if (opts.branchId) headers["X-Branch-Id"] = opts.branchId;

  const method = (opts.method ?? "get").toUpperCase();
  if (opts.body) headers["Content-Type"] = "application/json";

  const res = await fetch(`${integrationBaseUrl}${opts.path}`, {
    method,
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  const text = await res.text();
  let body: { message?: string } = {};
  try {
    body = text ? (JSON.parse(text) as { message?: string }) : {};
  } catch {
    body = {};
  }

  return { status: res.status, body };
}

export async function integrationRequestWithoutOrg(
  _app: INestApplication,
  token: string,
  opts: {
    method?: "get" | "post" | "patch" | "delete";
    path: string;
    branchId?: string;
    body?: Record<string, unknown>;
  },
) {
  if (!integrationBaseUrl) {
    throw new Error("Integration app not initialized");
  }

  const headers: Record<string, string> = {
    Authorization: token,
  };
  if (opts.branchId) headers["X-Branch-Id"] = opts.branchId;

  const method = (opts.method ?? "get").toUpperCase();
  if (opts.body) headers["Content-Type"] = "application/json";

  const res = await fetch(`${integrationBaseUrl}${opts.path}`, {
    method,
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  const text = await res.text();
  let body: { message?: string } = {};
  try {
    body = text ? (JSON.parse(text) as { message?: string }) : {};
  } catch {
    body = {};
  }

  return { status: res.status, body };
}
