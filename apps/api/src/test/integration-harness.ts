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

  await prisma.fiscalPeriod.upsert({
    where: { id: `${INTEGRATION_PREFIX}-fp-a` },
    create: {
      id: `${INTEGRATION_PREFIX}-fp-a`,
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
      // Drop branches first so reservations/rooms cascade before org removal.
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
