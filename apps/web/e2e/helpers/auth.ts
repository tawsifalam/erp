import { Page } from "@playwright/test";
import {
  getPmsReservations,
  getPmsRooms,
  handlePmsReservationMutation,
  handlePmsRoomMutation,
  resetPmsState,
} from "./pms-state";

export const FAKE_ORG_ID = "org-test-001";
export const FAKE_ORG_ID_2 = "org-test-002";
export const FAKE_BRANCH_ID = "branch-test-001";
export const FAKE_BRANCH_ID_2 = "branch-test-002";
export const FAKE_BRANCH_ID_2B = "branch-test-003";

/**
 * Mock PropelAuth and backend API auth so pages render as if a user is
 * logged in. Call this BEFORE navigating to any protected page.
 */
export async function mockAuth(page: Page) {
  // 1. PropelAuth client SDK fetches auth info from the hosted auth URL.
  //    Intercept any request to the PropelAuth domain so the AuthProvider
  //    thinks the user is logged in.
  await page.route("**/propelauthtest.com/**", (route) => {
    const url = route.request().url();
    if (url.includes("/api/v1/refresh_token") || url.includes("/api/be/v1/")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          access_token: "mock-access-token",
          user_id: "test-user-id",
          email: "admin@boulevard.cafe",
          org_id_to_org_member_info: {
            [FAKE_ORG_ID]: {
              org_id: FAKE_ORG_ID,
              org_name: "Boulevard Café",
              url_safe_org_name: "boulevard-cafe",
              user_role: "Admin",
            },
          },
        }),
      });
    }
    return route.fulfill({ status: 200, body: "{}" });
  });

  // 2. Intercept /api/auth/userinfo (used by getAccessToken)
  await page.route("**/api/auth/userinfo", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        userinfo: {
          user_id: "test-user-id",
          email: "admin@boulevard.cafe",
        },
        accessToken: "mock-access-token",
      }),
    }),
  );

  // 3. Intercept /api/auth/sync (called by syncUserAfterLogin)
  await page.route("**/api/auth/sync", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );

  // 4. Set the PropelAuth access-token cookie so Next.js middleware passes
  await page.context().addCookies([
    {
      name: "__pa_at",
      value: "mock-token",
      domain: "localhost",
      path: "/",
    },
  ]);
}

/** Seed data: tenant organisations returned by GET /api/tenants/organizations */
export const MOCK_ORGANIZATIONS = [
  {
    organizationId: FAKE_ORG_ID,
    role: "ADMIN",
    organization: {
      id: FAKE_ORG_ID,
      name: "Boulevard Café",
      branches: [
        { id: FAKE_BRANCH_ID, name: "Main Branch" },
        { id: FAKE_BRANCH_ID_2, name: "Annex Branch" },
      ],
    },
  },
  {
    organizationId: FAKE_ORG_ID_2,
    role: "ADMIN",
    organization: {
      id: FAKE_ORG_ID_2,
      name: "Harbor Hotel Group",
      branches: [{ id: FAKE_BRANCH_ID_2B, name: "Harbor Downtown" }],
    },
  },
];

/** Dashboard metrics vary by org/branch for E2E tenant switching */
export const MOCK_DASHBOARD_BY_TENANT: Record<string, Record<string, unknown>> = {
  [`${FAKE_ORG_ID}:${FAKE_BRANCH_ID}`]: {
    occupancyPct: 72,
    activeReservations: 5,
    revenueToday: 12450.0,
    lowStockAlerts: 3,
  },
  [`${FAKE_ORG_ID}:${FAKE_BRANCH_ID_2}`]: {
    occupancyPct: 45,
    activeReservations: 2,
    revenueToday: 3200.0,
    lowStockAlerts: 1,
  },
  [`${FAKE_ORG_ID_2}:${FAKE_BRANCH_ID_2B}`]: {
    occupancyPct: 88,
    activeReservations: 12,
    revenueToday: 28900.0,
    lowStockAlerts: 0,
  },
};

export const MOCK_DASHBOARD: Record<string, unknown> =
  MOCK_DASHBOARD_BY_TENANT[`${FAKE_ORG_ID}:${FAKE_BRANCH_ID}`]!;

/** Static snapshot for tests that assert seed labels */
export const MOCK_RESERVATIONS = [
  {
    id: "res-001",
    status: "CHECKED_IN",
    checkIn: "2026-05-28T14:00:00Z",
    checkOut: "2026-05-31T11:00:00Z",
    totalAmount: "10500",
    paidAmount: "10500",
    guest: { fullName: "Rahim Ahmed" },
    room: { roomNumber: "101" },
  },
  {
    id: "res-002",
    status: "CONFIRMED",
    checkIn: "2026-05-30T14:00:00Z",
    checkOut: "2026-06-02T11:00:00Z",
    totalAmount: "16500",
    paidAmount: "5000",
    guest: { fullName: "Fatima Khan" },
    room: { roomNumber: "204" },
  },
];

export const MOCK_ROOM_TYPES = [
  { id: "rt_001", name: "Standard Double", maxAdults: 2, maxChildren: 1 },
  { id: "rt_002", name: "Deluxe Suite", maxAdults: 3, maxChildren: 2 },
];

/** Seed data: POS orders */
export const MOCK_ORDERS = [
  {
    id: "ord_001",
    status: "SUBMITTED",
    paymentStatus: "UNPAID",
    totalAmount: "2350.00",
    tableNumber: "T-3",
    lines: [{ quantity: 2, menuItem: { name: "Chicken Biryani" } }],
  },
  {
    id: "ord_002",
    status: "COMPLETED",
    paymentStatus: "PAID",
    totalAmount: "870.00",
    tableNumber: "T-7",
    lines: [{ quantity: 1, menuItem: { name: "Tea" } }],
  },
];

export const MOCK_GUESTS = [
  { id: "gst_001", fullName: "Rahim Ahmed", phone: "+8801711000001" },
  { id: "gst_002", fullName: "Fatima Khan", phone: "+8801711000002" },
];

export const MOCK_ROOMS = [
  {
    id: "rm_101",
    roomNumber: "101",
    status: "VACANT",
    basePrice: "3500",
    roomType: { name: "Standard Double" },
  },
  {
    id: "rm_204",
    roomNumber: "204",
    status: "OCCUPIED",
    basePrice: "5500",
    roomType: { name: "Deluxe Suite" },
  },
];

export const MOCK_MENU_CATEGORIES = [
  {
    id: "mc_001",
    name: "Mains",
    items: [{ id: "mi_001", name: "Chicken Biryani", price: "320" }],
  },
];

export const MOCK_ACCOUNTS = [
  { id: "acc_1000", code: "1000", name: "Cash", type: "ASSET" },
  { id: "acc_4000", code: "4000", name: "Room Revenue", type: "REVENUE" },
];

export const MOCK_JOURNALS = [
  {
    id: "je_001",
    description: "Room payment",
    createdAt: "2026-05-28T10:00:00Z",
    lines: [
      { account: { name: "Cash" }, debit: "7000", credit: "0" },
      { account: { name: "Room Revenue" }, debit: "0", credit: "7000" },
    ],
  },
];

export const MOCK_EMPLOYEES = [
  { id: "emp_001", name: "Karim Hossain", designation: "Head Chef", salary: "45000" },
  { id: "emp_002", name: "Nasreen Begum", designation: "Front Desk", salary: "35000" },
];

export const MOCK_PAYROLL_RUNS = [
  {
    id: "pr_001",
    status: "COMPLETED",
    periodStart: "2026-05-01T00:00:00Z",
    periodEnd: "2026-05-31T00:00:00Z",
    createdAt: "2026-05-28T12:00:00Z",
    lines: [{ employee: { name: "Karim Hossain" }, grossPay: "45000", netPay: "45000" }],
  },
];

export const MOCK_REPORT_JOBS = [
  {
    id: "rpt_001",
    type: "summary",
    status: "COMPLETED",
    fileUrl: "https://example.com/report.csv",
    createdAt: "2026-05-28T14:00:00Z",
    completedAt: "2026-05-28T14:01:00Z",
  },
];

/** Seed data: inventory items */
export const MOCK_INVENTORY = [
  { id: "inv-001", name: "Basmati Rice", sku: "RICE-BAS-25", unit: "kg", currentStock: 120 },
  { id: "inv-002", name: "Olive Oil", sku: "OIL-OLV-5L", unit: "litre", currentStock: 34 },
  { id: "inv-003", name: "Chicken Breast", sku: "MEAT-CHK-01", unit: "kg", currentStock: 45 },
];

/**
 * Intercept all backend API calls (localhost:3001) and return seed data so
 * tests work without a running API server.
 */
export async function mockApiRoutes(page: Page) {
  resetPmsState();

  const fulfillJson = (route: import("@playwright/test").Route, body: unknown) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });

  await page.route("**/localhost:3001/api/tenants/organizations**", (route) => {
    const method = route.request().method();
    if (method === "GET") {
      return fulfillJson(route, MOCK_ORGANIZATIONS);
    }
    if (method === "POST") {
      return fulfillJson(route, {
        organization: {
          id: "org-new-001",
          name: "New Org",
          branches: [{ id: "branch-new-001", name: "Main Branch" }],
        },
      });
    }
    return fulfillJson(route, {});
  });

  await page.route("**/localhost:3001/api/tenants/organizations/current**", (route) => {
    if (route.request().method() === "PATCH") {
      return fulfillJson(route, { id: FAKE_ORG_ID, name: "Updated Org Name" });
    }
    return fulfillJson(route, {
      id: FAKE_ORG_ID,
      name: "Boulevard Café",
      propelAuthOrgId: "demo-org-propelauth",
      branches: MOCK_ORGANIZATIONS[0]!.organization.branches,
    });
  });

  await page.route("**/localhost:3001/api/tenants/branches**", (route) => {
    const method = route.request().method();
    if (method === "GET") {
      return fulfillJson(route, MOCK_ORGANIZATIONS[0]!.organization.branches);
    }
    if (method === "POST") {
      return fulfillJson(route, {
        id: "branch-new-002",
        name: "New Branch",
        timezone: "Asia/Dhaka",
      });
    }
    return fulfillJson(route, {});
  });

  await page.route("**/localhost:3001/api/tenants/branches/**", (route) => {
    if (route.request().method() === "PATCH") {
      return fulfillJson(route, { id: FAKE_BRANCH_ID, name: "Renamed Branch", timezone: "Asia/Dhaka" });
    }
    return fulfillJson(route, {});
  });

  await page.route("**/localhost:3001/api/reporting/dashboard**", (route) => {
    const orgId = route.request().headers()["x-organization-id"];
    const branchId = route.request().headers()["x-branch-id"];
    const key = `${orgId ?? FAKE_ORG_ID}:${branchId ?? FAKE_BRANCH_ID}`;
    const body =
      MOCK_DASHBOARD_BY_TENANT[key] ?? MOCK_DASHBOARD_BY_TENANT[`${FAKE_ORG_ID}:${FAKE_BRANCH_ID}`];
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });

  await page.route("**/localhost:3001/api/pms/reservations**", async (route) => {
    const method = route.request().method();
    const url = route.request().url();
    if (method === "GET") return fulfillJson(route, getPmsReservations());
    const body = route.request().postDataJSON() as Record<string, unknown> | null;
    const result = handlePmsReservationMutation(method, url, body);
    return fulfillJson(route, result);
  });

  await page.route("**/localhost:3001/api/pms/guests**", (route) => {
    const method = route.request().method();
    if (method === "GET") return fulfillJson(route, MOCK_GUESTS);
    if (method === "POST") {
      return fulfillJson(route, { id: "gst-new", fullName: "New Guest" });
    }
    return fulfillJson(route, MOCK_GUESTS[0]);
  });

  await page.route("**/localhost:3001/api/pms/room-types**", (route) => {
    const method = route.request().method();
    if (method === "GET") return fulfillJson(route, MOCK_ROOM_TYPES);
    if (method === "DELETE") return fulfillJson(route, { id: "deleted" });
    return fulfillJson(route, MOCK_ROOM_TYPES[0]);
  });

  await page.route("**/localhost:3001/api/pms/availability**", (route) =>
    fulfillJson(route, getPmsRooms().filter((r) => r.status === "VACANT")),
  );

  await page.route("**/localhost:3001/api/pms/rooms**", async (route) => {
    const method = route.request().method();
    const url = route.request().url();
    if (method === "GET" && !url.match(/\/rooms\/[^/?]+$/)) {
      return fulfillJson(route, getPmsRooms());
    }
    const body = route.request().postDataJSON() as Record<string, unknown> | null;
    const result = handlePmsRoomMutation(method, url, body);
    return fulfillJson(route, result);
  });

  await page.route("**/localhost:3001/api/pos/orders**", (route) => {
    if (route.request().method() !== "GET") return fulfillJson(route, {});
    return fulfillJson(route, MOCK_ORDERS);
  });

  await page.route("**/localhost:3001/api/pos/menu/categories**", (route) =>
    fulfillJson(route, MOCK_MENU_CATEGORIES),
  );

  await page.route("**/localhost:3001/api/inventory/items**", (route) => {
    if (route.request().method() !== "GET") return fulfillJson(route, {});
    return fulfillJson(route, MOCK_INVENTORY);
  });

  await page.route("**/localhost:3001/api/accounting/journals**", (route) => {
    if (route.request().method() !== "GET") return fulfillJson(route, {});
    return fulfillJson(route, MOCK_JOURNALS);
  });

  await page.route("**/localhost:3001/api/accounting/accounts**", (route) => {
    if (route.request().method() !== "GET") return fulfillJson(route, {});
    return fulfillJson(route, MOCK_ACCOUNTS);
  });

  await page.route("**/localhost:3001/api/hr/employees**", (route) => {
    if (route.request().method() !== "GET") return fulfillJson(route, {});
    return fulfillJson(route, MOCK_EMPLOYEES);
  });

  await page.route("**/localhost:3001/api/payroll/runs**", (route) =>
    fulfillJson(route, MOCK_PAYROLL_RUNS),
  );

  await page.route("**/localhost:3001/api/reporting/jobs**", (route) =>
    fulfillJson(route, MOCK_REPORT_JOBS),
  );

  await page.route("**/localhost:3001/api/reporting/export**", (route) =>
    fulfillJson(route, { id: "rpt_new" }),
  );
}
