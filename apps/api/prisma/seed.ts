import { PrismaClient, Role, AccountType, RoomStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organization.upsert({
    where: { propelAuthOrgId: "demo-org-propelauth" },
    update: {},
    create: {
      propelAuthOrgId: "demo-org-propelauth",
      name: "Demo Hospitality Group",
    },
  });

  const branch = await prisma.branch.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      organizationId: org.id,
      name: "Main Property",
      timezone: "America/New_York",
    },
  });

  const user = await prisma.user.upsert({
    where: { propelAuthUserId: "demo-admin-propelauth" },
    update: {},
    create: {
      propelAuthUserId: "demo-admin-propelauth",
      email: "admin@demo.hospitality",
      name: "Demo Admin",
    },
  });

  await prisma.userOrganization.upsert({
    where: {
      userId_organizationId: { userId: user.id, organizationId: org.id },
    },
    update: { role: Role.OWNER },
    create: {
      userId: user.id,
      organizationId: org.id,
      role: Role.OWNER,
    },
  });

  const roomType = await prisma.roomType.upsert({
    where: { id: "00000000-0000-0000-0000-000000000010" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000010",
      organizationId: org.id,
      name: "Standard Double",
      maxAdults: 2,
      maxChildren: 1,
    },
  });

  for (let i = 101; i <= 103; i++) {
    await prisma.room.upsert({
      where: { branchId_roomNumber: { branchId: branch.id, roomNumber: String(i) } },
      update: {},
      create: {
        branchId: branch.id,
        roomTypeId: roomType.id,
        roomNumber: String(i),
        status: RoomStatus.VACANT,
        basePrice: 120,
      },
    });
  }

  const accounts = [
    { code: "1000", name: "Cash", type: AccountType.ASSET },
    { code: "1200", name: "Inventory", type: AccountType.ASSET },
    { code: "4000", name: "Room Revenue", type: AccountType.REVENUE },
    { code: "4100", name: "F&B Revenue", type: AccountType.REVENUE },
    { code: "5000", name: "COGS", type: AccountType.EXPENSE },
  ];

  for (const acc of accounts) {
    await prisma.account.upsert({
      where: { organizationId_code: { organizationId: org.id, code: acc.code } },
      update: {},
      create: { organizationId: org.id, ...acc },
    });
  }

  const category = await prisma.menuCategory.create({
    data: {
      organizationId: org.id,
      branchId: branch.id,
      name: "Main Menu",
      sortOrder: 0,
    },
  });

  await prisma.menuItem.create({
    data: {
      categoryId: category.id,
      name: "Club Sandwich",
      price: 14.5,
    },
  });

  console.log("Seed complete:", { orgId: org.id, branchId: branch.id });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
