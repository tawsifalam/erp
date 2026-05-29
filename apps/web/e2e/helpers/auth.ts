import { Page } from "@playwright/test";

const FAKE_ORG_ID = "org-test-001";
const FAKE_BRANCH_ID = "branch-test-001";

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
    role: "Admin",
    organization: {
      id: FAKE_ORG_ID,
      name: "Boulevard Café",
      branches: [{ id: FAKE_BRANCH_ID, name: "Main Branch" }],
    },
  },
];

/** Seed data: dashboard summary */
export const MOCK_DASHBOARD: Record<string, unknown> = {
  occupancyPct: 72,
  activeReservations: 5,
  revenueToday: 12450.0,
  lowStockAlerts: 3,
};

/** Seed data: PMS reservations */
export const MOCK_RESERVATIONS = [
  {
    id: "res-001",
    status: "CHECKED_IN",
    checkIn: "2026-05-28T14:00:00Z",
    checkOut: "2026-05-31T11:00:00Z",
    guest: { fullName: "Rahim Ahmed" },
    room: { roomNumber: "101" },
  },
  {
    id: "res-002",
    status: "CONFIRMED",
    checkIn: "2026-05-30T14:00:00Z",
    checkOut: "2026-06-02T11:00:00Z",
    guest: { fullName: "Fatima Khan" },
    room: { roomNumber: "204" },
  },
];

/** Seed data: POS orders */
export const MOCK_ORDERS = [
  {
    id: "ord-001",
    status: "OPEN",
    paymentStatus: "UNPAID",
    totalAmount: "2350.00",
    tableNumber: "T-3",
  },
  {
    id: "ord-002",
    status: "CLOSED",
    paymentStatus: "PAID",
    totalAmount: "870.00",
    tableNumber: "T-7",
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
  await page.route("**/localhost:3001/api/tenants/organizations**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_ORGANIZATIONS),
    }),
  );

  await page.route("**/localhost:3001/api/reporting/dashboard**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_DASHBOARD),
    }),
  );

  await page.route("**/localhost:3001/api/pms/reservations**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_RESERVATIONS),
    }),
  );

  await page.route("**/localhost:3001/api/pos/orders**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_ORDERS),
    }),
  );

  await page.route("**/localhost:3001/api/inventory/items**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_INVENTORY),
    }),
  );
}
