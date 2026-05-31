import { PrismaClient } from "@prisma/client";
import {
  Role,
  AccountType,
  RoomStatus,
  ReservationStatus,
  OrderStatus,
  PaymentStatus,
  MovementType,
  MovementDirection,
  AttendanceType,
} from "@erp/types";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();

/** Generate a prefixed ID for seed data */
function sid(prefix: string, suffix?: string): string {
  return `${prefix}_${suffix ?? randomUUID()}`;
}

async function main() {
  // ─── Organization ───────────────────────────────────────────────────────────
  const org = await prisma.organization.upsert({
    where: { propelAuthOrgId: "demo-org-propelauth" },
    update: {},
    create: {
      id: sid("org", "00000000-0000-0000-0000-000000000100"),
      propelAuthOrgId: "demo-org-propelauth",
      name: "Boulevard Hospitality Group",
      joinCode: "ov_demoseed",
    },
  });

  // ─── Branches ───────────────────────────────────────────────────────────────
  const mainBranch = await prisma.branch.upsert({
    where: { id: sid("br", "00000000-0000-0000-0000-000000000001") },
    update: {},
    create: {
      id: sid("br", "00000000-0000-0000-0000-000000000001"),
      organizationId: org.id,
      name: "Main Hotel & Restaurant",
      timezone: "Asia/Dhaka",
    },
  });

  const cafeBranch = await prisma.branch.upsert({
    where: { id: sid("br", "00000000-0000-0000-0000-000000000002") },
    update: {},
    create: {
      id: sid("br", "00000000-0000-0000-0000-000000000002"),
      organizationId: org.id,
      name: "Boulevard Café",
      timezone: "Asia/Dhaka",
    },
  });

  // ─── Admin User ─────────────────────────────────────────────────────────────
  const admin = await prisma.user.upsert({
    where: { propelAuthUserId: "demo-admin-propelauth" },
    update: {},
    create: {
      id: sid("usr", "00000000-0000-0000-0000-000000000200"),
      propelAuthUserId: "demo-admin-propelauth",
      email: "admin@boulevard.cafe",
      name: "Admin User",
    },
  });

  await prisma.userOrganization.upsert({
    where: { userId_organizationId: { userId: admin.id, organizationId: org.id } },
    update: { role: Role.OWNER },
    create: { id: sid("uo"), userId: admin.id, organizationId: org.id, role: Role.OWNER },
  });

  // ─── Room Types ─────────────────────────────────────────────────────────────
  const standardRoom = await prisma.roomType.upsert({
    where: { id: sid("rt", "00000000-0000-0000-0000-000000000010") },
    update: {},
    create: {
      id: sid("rt", "00000000-0000-0000-0000-000000000010"),
      organizationId: org.id,
      name: "Standard Double",
      maxAdults: 2,
      maxChildren: 1,
    },
  });

  const deluxeRoom = await prisma.roomType.upsert({
    where: { id: sid("rt", "00000000-0000-0000-0000-000000000011") },
    update: {},
    create: {
      id: sid("rt", "00000000-0000-0000-0000-000000000011"),
      organizationId: org.id,
      name: "Deluxe Suite",
      maxAdults: 3,
      maxChildren: 2,
    },
  });

  // ─── Rooms ──────────────────────────────────────────────────────────────────
  const roomDefs = [
    { number: "101", typeId: standardRoom.id, price: 3500 },
    { number: "102", typeId: standardRoom.id, price: 3500 },
    { number: "103", typeId: standardRoom.id, price: 3500 },
    { number: "104", typeId: standardRoom.id, price: 3500 },
    { number: "201", typeId: deluxeRoom.id, price: 6000 },
    { number: "202", typeId: deluxeRoom.id, price: 6000 },
    { number: "203", typeId: deluxeRoom.id, price: 7500 },
  ];

  const rooms: Record<string, string> = {};
  for (const r of roomDefs) {
    const room = await prisma.room.upsert({
      where: { branchId_roomNumber: { branchId: mainBranch.id, roomNumber: r.number } },
      update: {},
      create: {
        id: sid("rm"),
        branchId: mainBranch.id,
        roomTypeId: r.typeId,
        roomNumber: r.number,
        status: RoomStatus.VACANT,
        basePrice: r.price,
      },
    });
    rooms[r.number] = room.id;
  }

  // ─── Guests ─────────────────────────────────────────────────────────────────
  const guestData = [
    { id: sid("gst", "00000000-0000-0000-0000-000000000301"), fullName: "Rahim Ahmed", phone: "+8801711000001", email: "rahim@example.com" },
    { id: sid("gst", "00000000-0000-0000-0000-000000000302"), fullName: "Fatima Khan", phone: "+8801711000002", email: "fatima@example.com" },
    { id: sid("gst", "00000000-0000-0000-0000-000000000303"), fullName: "John Smith", phone: "+14155551234", email: "john.smith@example.com" },
    { id: sid("gst", "00000000-0000-0000-0000-000000000304"), fullName: "Maria Garcia", phone: "+34612345678", email: "maria@example.com" },
    { id: sid("gst", "00000000-0000-0000-0000-000000000305"), fullName: "Chen Wei", phone: "+8613800138000", email: "chen.wei@example.com" },
  ];

  const guests: Record<string, string> = {};
  for (const g of guestData) {
    const guest = await prisma.guest.upsert({
      where: { id: g.id },
      update: {},
      create: { ...g, organizationId: org.id },
    });
    guests[g.fullName] = guest.id;
  }

  // ─── Reservations ───────────────────────────────────────────────────────────
  const today = new Date();
  today.setHours(14, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const dayAfter = new Date(today);
  dayAfter.setDate(dayAfter.getDate() + 2);

  const threeDays = new Date(today);
  threeDays.setDate(threeDays.getDate() + 3);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const reservations = [
    { guestId: guests["Rahim Ahmed"], roomId: rooms["101"], checkIn: yesterday, checkOut: tomorrow, status: ReservationStatus.CHECKED_IN, totalAmount: 7000 },
    { guestId: guests["Fatima Khan"], roomId: rooms["201"], checkIn: today, checkOut: threeDays, status: ReservationStatus.CONFIRMED, totalAmount: 18000 },
    { guestId: guests["John Smith"], roomId: rooms["102"], checkIn: tomorrow, checkOut: dayAfter, status: ReservationStatus.CONFIRMED, totalAmount: 3500 },
    { guestId: guests["Maria Garcia"], roomId: rooms["203"], checkIn: today, checkOut: dayAfter, status: ReservationStatus.CONFIRMED, totalAmount: 15000 },
    { guestId: guests["Chen Wei"], roomId: rooms["103"], checkIn: dayAfter, checkOut: threeDays, status: ReservationStatus.INQUIRY, totalAmount: 3500 },
  ];

  for (const r of reservations) {
    await prisma.reservation.create({
      data: { id: sid("rsv"), branchId: mainBranch.id, ...r },
    });
  }

  // Mark room 101 as occupied (matches CHECKED_IN reservation)
  await prisma.room.update({ where: { id: rooms["101"] }, data: { status: RoomStatus.OCCUPIED } });

  // ─── Accounts (Chart of Accounts) ──────────────────────────────────────────
  const accountDefs = [
    { code: "1000", name: "Cash", type: AccountType.ASSET },
    { code: "1100", name: "Bank Account", type: AccountType.ASSET },
    { code: "1200", name: "Inventory", type: AccountType.ASSET },
    { code: "1300", name: "Accounts Receivable", type: AccountType.ASSET },
    { code: "2000", name: "Accounts Payable", type: AccountType.LIABILITY },
    { code: "2100", name: "Salary Payable", type: AccountType.LIABILITY },
    { code: "3000", name: "Owner Equity", type: AccountType.EQUITY },
    { code: "4000", name: "Room Revenue", type: AccountType.REVENUE },
    { code: "4100", name: "F&B Revenue", type: AccountType.REVENUE },
    { code: "4200", name: "Other Revenue", type: AccountType.REVENUE },
    { code: "5000", name: "Cost of Goods Sold", type: AccountType.EXPENSE },
    { code: "5100", name: "Salary Expense", type: AccountType.EXPENSE },
    { code: "5200", name: "Utilities Expense", type: AccountType.EXPENSE },
    { code: "5300", name: "Maintenance Expense", type: AccountType.EXPENSE },
  ];

  const accounts: Record<string, string> = {};
  for (const acc of accountDefs) {
    const a = await prisma.account.upsert({
      where: { organizationId_code: { organizationId: org.id, code: acc.code } },
      update: {},
      create: { id: sid("acc"), organizationId: org.id, ...acc },
    });
    accounts[acc.code] = a.id;
  }

  // ─── Sample Journal Entry (room payment) ───────────────────────────────────
  await prisma.journalEntry.create({
    data: {
      id: sid("je"),
      organizationId: org.id,
      description: "Room 101 advance payment - Rahim Ahmed",
      referenceType: "Reservation",
      lines: {
        create: [
          { id: sid("jl"), accountId: accounts["1000"], debit: 7000, credit: 0 },
          { id: sid("jl"), accountId: accounts["4000"], debit: 0, credit: 7000 },
        ],
      },
    },
  });

  // ─── Menu Categories & Items ────────────────────────────────────────────────
  const breakfastCat = await prisma.menuCategory.create({
    data: { id: sid("mc"), organizationId: org.id, branchId: mainBranch.id, name: "Breakfast", sortOrder: 1 },
  });

  const mainsCat = await prisma.menuCategory.create({
    data: { id: sid("mc"), organizationId: org.id, branchId: mainBranch.id, name: "Mains", sortOrder: 2 },
  });

  const beveragesCat = await prisma.menuCategory.create({
    data: { id: sid("mc"), organizationId: org.id, branchId: mainBranch.id, name: "Beverages", sortOrder: 3 },
  });

  const menuItems = [
    { categoryId: breakfastCat.id, name: "Paratha & Egg", price: 120 },
    { categoryId: breakfastCat.id, name: "Toast & Butter", price: 80 },
    { categoryId: breakfastCat.id, name: "Omelette", price: 100 },
    { categoryId: mainsCat.id, name: "Chicken Biryani", price: 320 },
    { categoryId: mainsCat.id, name: "Grilled Fish", price: 450 },
    { categoryId: mainsCat.id, name: "Club Sandwich", price: 250 },
    { categoryId: mainsCat.id, name: "Beef Curry with Rice", price: 350 },
    { categoryId: beveragesCat.id, name: "Fresh Juice", price: 120 },
    { categoryId: beveragesCat.id, name: "Tea", price: 50 },
    { categoryId: beveragesCat.id, name: "Coffee", price: 100 },
  ];

  const createdMenuItems: Record<string, string> = {};
  for (const item of menuItems) {
    const mi = await prisma.menuItem.create({ data: { id: sid("mi"), ...item } });
    createdMenuItems[item.name] = mi.id;
  }

  // ─── Inventory Pools ───────────────────────────────────────────────────────
  const poolDefs = [
    { code: "guest", name: "Guest / Kitchen", isSystem: true, sortOrder: 0 },
    { code: "staff", name: "Staff pantry", isSystem: true, sortOrder: 1 },
  ];
  const poolIds: Record<string, string> = {};
  for (const p of poolDefs) {
    const pool = await prisma.inventoryPool.upsert({
      where: { organizationId_code: { organizationId: org.id, code: p.code } },
      update: {},
      create: { id: sid("ivp"), organizationId: org.id, ...p },
    });
    poolIds[p.code] = pool.id;
  }

  // ─── Inventory Items ────────────────────────────────────────────────────────
  const invItems = [
    { name: "Rice", sku: "INV-001", unit: "kg", lowStockThreshold: 10 },
    { name: "Chicken", sku: "INV-002", unit: "kg", lowStockThreshold: 5 },
    { name: "Cooking Oil", sku: "INV-003", unit: "liter", lowStockThreshold: 5 },
    { name: "Eggs", sku: "INV-004", unit: "piece", lowStockThreshold: 30 },
    { name: "Bread", sku: "INV-005", unit: "loaf", lowStockThreshold: 5 },
    { name: "Fish (Rohu)", sku: "INV-006", unit: "kg", lowStockThreshold: 3 },
    { name: "Butter", sku: "INV-007", unit: "kg", lowStockThreshold: 2 },
    { name: "Tea Leaves", sku: "INV-008", unit: "kg", lowStockThreshold: 1 },
    { name: "Coffee Beans", sku: "INV-009", unit: "kg", lowStockThreshold: 1 },
    { name: "Sugar", sku: "INV-010", unit: "kg", lowStockThreshold: 5 },
    { name: "Beef", sku: "INV-011", unit: "kg", lowStockThreshold: 3 },
    { name: "Fresh Oranges", sku: "INV-012", unit: "kg", lowStockThreshold: 5 },
  ];

  const inventoryIds: Record<string, string> = {};
  for (const item of invItems) {
    const inv = await prisma.inventoryItem.upsert({
      where: { branchId_sku: { branchId: mainBranch.id, sku: item.sku } },
      update: {},
      create: { id: sid("inv"), branchId: mainBranch.id, poolId: poolIds.guest, ...item },
    });
    inventoryIds[item.name] = inv.id;
  }

  const staffInvItems = [
    { name: "Staff Rice", sku: "STAFF-001", unit: "kg", lowStockThreshold: 5 },
    { name: "Staff Chicken", sku: "STAFF-002", unit: "kg", lowStockThreshold: 3 },
    { name: "Staff Cooking Oil", sku: "STAFF-003", unit: "liter", lowStockThreshold: 2 },
  ];
  const staffInventoryIds: Record<string, string> = {};
  for (const item of staffInvItems) {
    const inv = await prisma.inventoryItem.upsert({
      where: { branchId_sku: { branchId: mainBranch.id, sku: item.sku } },
      update: {},
      create: { id: sid("inv"), branchId: mainBranch.id, poolId: poolIds.staff, ...item },
    });
    staffInventoryIds[item.name] = inv.id;
    await prisma.inventoryMovement.create({
      data: {
        id: sid("im"),
        itemId: inv.id,
        branchId: mainBranch.id,
        direction: MovementDirection.IN,
        movementType: MovementType.PURCHASE,
        quantity: 20,
        notes: "Initial staff pantry stock",
      },
    });
  }

  // ─── Initial Stock (Purchase movements) ────────────────────────────────────
  const purchases = [
    { name: "Rice", qty: 50 },
    { name: "Chicken", qty: 20 },
    { name: "Cooking Oil", qty: 15 },
    { name: "Eggs", qty: 120 },
    { name: "Bread", qty: 10 },
    { name: "Fish (Rohu)", qty: 8 },
    { name: "Butter", qty: 5 },
    { name: "Tea Leaves", qty: 3 },
    { name: "Coffee Beans", qty: 2 },
    { name: "Sugar", qty: 10 },
    { name: "Beef", qty: 10 },
    { name: "Fresh Oranges", qty: 15 },
  ];

  for (const p of purchases) {
    await prisma.inventoryMovement.create({
      data: {
        id: sid("im"),
        itemId: inventoryIds[p.name],
        branchId: mainBranch.id,
        direction: MovementDirection.IN,
        movementType: MovementType.PURCHASE,
        quantity: p.qty,
        notes: "Initial stock purchase",
      },
    });
  }

  // ─── Recipes (BOM) ─────────────────────────────────────────────────────────
  const recipes = [
    {
      menuItem: "Chicken Biryani",
      lines: [
        { item: "Rice", qty: 0.3 },
        { item: "Chicken", qty: 0.25 },
        { item: "Cooking Oil", qty: 0.05 },
      ],
    },
    {
      menuItem: "Grilled Fish",
      lines: [
        { item: "Fish (Rohu)", qty: 0.3 },
        { item: "Cooking Oil", qty: 0.03 },
      ],
    },
    {
      menuItem: "Club Sandwich",
      lines: [
        { item: "Bread", qty: 0.25 },
        { item: "Chicken", qty: 0.1 },
        { item: "Eggs", qty: 1 },
        { item: "Butter", qty: 0.02 },
      ],
    },
    {
      menuItem: "Omelette",
      lines: [
        { item: "Eggs", qty: 3 },
        { item: "Cooking Oil", qty: 0.02 },
      ],
    },
    {
      menuItem: "Tea",
      lines: [
        { item: "Tea Leaves", qty: 0.005 },
        { item: "Sugar", qty: 0.015 },
      ],
    },
    {
      menuItem: "Coffee",
      lines: [
        { item: "Coffee Beans", qty: 0.015 },
        { item: "Sugar", qty: 0.01 },
      ],
    },
    {
      menuItem: "Beef Curry with Rice",
      lines: [
        { item: "Beef", qty: 0.25 },
        { item: "Rice", qty: 0.3 },
        { item: "Cooking Oil", qty: 0.04 },
      ],
    },
    {
      menuItem: "Fresh Juice",
      lines: [
        { item: "Fresh Oranges", qty: 0.3 },
        { item: "Sugar", qty: 0.02 },
      ],
    },
  ];

  for (const r of recipes) {
    await prisma.recipe.create({
      data: {
        id: sid("rcp"),
        menuItemId: createdMenuItems[r.menuItem],
        lines: {
          create: r.lines.map((l) => ({
            id: sid("rl"),
            inventoryItemId: inventoryIds[l.item],
            quantity: l.qty,
          })),
        },
      },
    });
  }

  // ─── Sample Orders ──────────────────────────────────────────────────────────
  const order1 = await prisma.order.create({
    data: {
      id: sid("ord"),
      branchId: mainBranch.id,
      tableNumber: "T3",
      status: OrderStatus.COMPLETED,
      paymentStatus: PaymentStatus.PAID,
      totalAmount: 690,
      paidAmount: 690,
      lines: {
        create: [
          { id: sid("ol"), menuItemId: createdMenuItems["Chicken Biryani"], quantity: 2, unitPrice: 320, lineTotal: 640 },
          { id: sid("ol"), menuItemId: createdMenuItems["Tea"], quantity: 1, unitPrice: 50, lineTotal: 50 },
        ],
      },
    },
  });

  await prisma.order.create({
    data: {
      id: sid("ord"),
      branchId: mainBranch.id,
      tableNumber: "T1",
      status: OrderStatus.SUBMITTED,
      paymentStatus: PaymentStatus.UNPAID,
      totalAmount: 570,
      paidAmount: 0,
      lines: {
        create: [
          { id: sid("ol"), menuItemId: createdMenuItems["Grilled Fish"], quantity: 1, unitPrice: 450, lineTotal: 450 },
          { id: sid("ol"), menuItemId: createdMenuItems["Fresh Juice"], quantity: 1, unitPrice: 120, lineTotal: 120 },
        ],
      },
      kitchenTickets: { create: { id: sid("kt"), status: OrderStatus.SUBMITTED } },
    },
  });

  await prisma.order.create({
    data: {
      id: sid("ord"),
      branchId: mainBranch.id,
      tableNumber: "T5",
      status: OrderStatus.DRAFT,
      paymentStatus: PaymentStatus.UNPAID,
      totalAmount: 350,
      paidAmount: 0,
      lines: {
        create: [
          { id: sid("ol"), menuItemId: createdMenuItems["Beef Curry with Rice"], quantity: 1, unitPrice: 350, lineTotal: 350 },
        ],
      },
    },
  });

  // Record some inventory OUT movements for the completed order
  const outItems = [
    { name: "Rice", qty: 0.6 },
    { name: "Chicken", qty: 0.5 },
    { name: "Cooking Oil", qty: 0.1 },
    { name: "Tea Leaves", qty: 0.005 },
    { name: "Sugar", qty: 0.015 },
  ];
  for (const out of outItems) {
    await prisma.inventoryMovement.create({
      data: {
        id: sid("im"),
        itemId: inventoryIds[out.name],
        branchId: mainBranch.id,
        direction: MovementDirection.OUT,
        movementType: MovementType.SALE,
        quantity: out.qty,
        referenceType: "Order",
        referenceId: order1.id,
      },
    });
  }

  // F&B Revenue journal entry for completed order
  await prisma.journalEntry.create({
    data: {
      id: sid("je"),
      organizationId: org.id,
      description: "F&B Sale - Table T3",
      referenceType: "Order",
      referenceId: order1.id,
      lines: {
        create: [
          { id: sid("jl"), accountId: accounts["1000"], debit: 690, credit: 0 },
          { id: sid("jl"), accountId: accounts["4100"], debit: 0, credit: 690 },
        ],
      },
    },
  });

  // COGS entry
  await prisma.journalEntry.create({
    data: {
      id: sid("je"),
      organizationId: org.id,
      description: "COGS - Order T3 ingredients",
      referenceType: "Order",
      referenceId: order1.id,
      lines: {
        create: [
          { id: sid("jl"), accountId: accounts["5000"], debit: 180, credit: 0 },
          { id: sid("jl"), accountId: accounts["1200"], debit: 0, credit: 180 },
        ],
      },
    },
  });

  // ─── Employees ──────────────────────────────────────────────────────────────
  const employees = [
    { id: sid("emp", "00000000-0000-0000-0000-000000000401"), name: "Karim Hossain", designation: "Head Chef", salary: 45000, branchId: mainBranch.id },
    { id: sid("emp", "00000000-0000-0000-0000-000000000402"), name: "Nasreen Begum", designation: "Front Desk Manager", salary: 35000, branchId: mainBranch.id },
    { id: sid("emp", "00000000-0000-0000-0000-000000000403"), name: "Rashid Islam", designation: "Waiter", salary: 18000, branchId: mainBranch.id },
    { id: sid("emp", "00000000-0000-0000-0000-000000000404"), name: "Ayesha Rahman", designation: "Housekeeper", salary: 16000, branchId: mainBranch.id },
    { id: sid("emp", "00000000-0000-0000-0000-000000000405"), name: "Tanvir Alam", designation: "Accountant", salary: 40000, branchId: mainBranch.id },
  ];

  for (const emp of employees) {
    await prisma.employee.upsert({
      where: { id: emp.id },
      update: {},
      create: { organizationId: org.id, ...emp },
    });
  }

  // ─── Attendance Records (today) ────────────────────────────────────────────
  const todayMorning = new Date();
  todayMorning.setHours(8, 0, 0, 0);

  for (const emp of employees) {
    await prisma.attendanceRecord.create({
      data: {
        id: sid("att"),
        employeeId: emp.id,
        branchId: mainBranch.id,
        type: AttendanceType.CLOCK_IN,
        recordedAt: todayMorning,
      },
    });
  }

  // ─── Staff Meal Recipe & Consumption ───────────────────────────────────────
  const staffLunchRecipe = await prisma.staffMealRecipe.create({
    data: {
      id: sid("smr"),
      branchId: mainBranch.id,
      name: "Staff Lunch",
      lines: {
        create: [
          { id: sid("sml"), inventoryItemId: staffInventoryIds["Staff Rice"], quantity: 0.3 },
          { id: sid("sml"), inventoryItemId: staffInventoryIds["Staff Chicken"], quantity: 0.15 },
          { id: sid("sml"), inventoryItemId: staffInventoryIds["Staff Cooking Oil"], quantity: 0.02 },
        ],
      },
    },
  });

  const staffMealRecord = await prisma.staffMeal.create({
    data: {
      id: sid("sm"),
      employeeId: employees[0].id,
      branchId: mainBranch.id,
      staffMealRecipeId: staffLunchRecipe.id,
      mealCount: 1,
      unitCostPerMeal: 0.47,
      deductFromPayroll: false,
    },
  });

  for (const line of [
    { item: staffInventoryIds["Staff Rice"], qty: 0.3 },
    { item: staffInventoryIds["Staff Chicken"], qty: 0.15 },
    { item: staffInventoryIds["Staff Cooking Oil"], qty: 0.02 },
  ]) {
    await prisma.inventoryMovement.create({
      data: {
        id: sid("im"),
        itemId: line.item,
        branchId: mainBranch.id,
        direction: MovementDirection.OUT,
        movementType: MovementType.STAFF_MEAL,
        quantity: line.qty,
        referenceType: "StaffMeal",
        referenceId: staffMealRecord.id,
      },
    });
  }

  // ─── Waste Record ──────────────────────────────────────────────────────────
  await prisma.inventoryMovement.create({
    data: {
      id: sid("im"),
      itemId: inventoryIds["Eggs"],
      branchId: mainBranch.id,
      direction: MovementDirection.OUT,
      movementType: MovementType.WASTE,
      quantity: 5,
      notes: "Broken during delivery",
    },
  });

  console.log("✅ Seed complete!");
  console.log(`   Organization: ${org.name} (${org.id})`);
  console.log(`   Main Branch:  ${mainBranch.name} (${mainBranch.id})`);
  console.log(`   Café Branch:  ${cafeBranch.name} (${cafeBranch.id})`);
  console.log(`   Admin:        ${admin.email}`);
  console.log(`   Rooms:        ${roomDefs.length}`);
  console.log(`   Guests:       ${guestData.length}`);
  console.log(`   Reservations: ${reservations.length}`);
  console.log(`   Menu Items:   ${menuItems.length}`);
  console.log(`   Inventory:    ${invItems.length} items`);
  console.log(`   Employees:    ${employees.length}`);
  console.log(`   Recipes:      ${recipes.length}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
