import { Page } from "@playwright/test";
import {
  getPmsGuests,
  getPmsReservations,
  getPmsRooms,
  getPmsRoomTypes,
  handlePmsGuestMutation,
  handlePmsReservationMutation,
  handlePmsRoomMutation,
  handlePmsRoomTypeMutation,
  resetPmsState,
} from "./pms-state";
import {
  getPosCategories,
  getPosOrders,
  handlePosCategoryMutation,
  handlePosMenuItemMutation,
  handlePosOrderMutation,
  resetPosState,
} from "./pos-state";
import {
  getInventoryItems,
  handleInventoryItemMutation,
  handleInventoryMovementMutation,
  handleInventoryPoolMutation,
  resetInventoryState,
} from "./inventory-state";
import {
  getAccountingAccounts,
  getAccountingJournals,
  handleAccountingMutation,
  resetAccountingState,
} from "./accounting-state";
import {
  getHrEmployees,
  handleHrMutation,
  resetHrState,
} from "./hr-state";
import {
  getReportJobs,
  handleReportingMutation,
  resetReportingState,
} from "./reporting-state";
import {
  handleInclusionsMutation,
  resetInclusionsState,
} from "./inclusions-state";
import {
  getOrgName,
  getTenantBranches,
  handleTenantMutation,
  resetTenantState,
} from "./tenant-state";

/** Nest API on port 3001 (localhost or 127.0.0.1). */
export function isBackendApiUrl(url: string): boolean {
  return /https?:\/\/(localhost|127\.0\.0\.1):3001\/api\//.test(url);
}

export function backendApiRoute(pathContains: string) {
  return (url: URL) => isBackendApiUrl(url.href) && url.href.includes(pathContains);
}

/** Match a single list endpoint (avoids swallowing `/organizations/current`, etc.). */
export function backendApiListRoute(pathSuffix: string) {
  return (url: URL) => {
    if (!isBackendApiUrl(url.href)) return false;
    const pathname = new URL(url.href).pathname;
    return pathname === `/api/${pathSuffix}` || pathname.endsWith(`/api/${pathSuffix}`);
  };
}

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
  const fulfillPropelAuth = (route: import("@playwright/test").Route) => {
    const url = route.request().url();
    if (
      url.includes("/api/v1/refresh_token") ||
      url.includes("/api/be/v1/") ||
      url.includes("/api/v1/whoami")
    ) {
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
  };

  await page.route(/propelauth/i, fulfillPropelAuth);

  // Intercept /api/auth/userinfo (PropelAuth AuthProvider session refresh)
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
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ hasActiveMembership: true, pendingJoinRequest: null }),
    }),
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

/** Organizations list for GET /api/tenants/organizations (branches stay in sync with tenant-state). */
export function getMockOrganizations() {
  return [
    {
      organizationId: FAKE_ORG_ID,
      role: "ADMIN",
      organization: {
        id: FAKE_ORG_ID,
        name: getOrgName(),
        branches: getTenantBranches().map((b) => ({ id: b.id, name: b.name })),
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
}

/** Dashboard metrics vary by org/branch for E2E tenant switching */
const emptyLowStock: unknown[] = [];

export const MOCK_DASHBOARD_BY_TENANT: Record<string, Record<string, unknown>> = {
  [`${FAKE_ORG_ID}:${FAKE_BRANCH_ID}`]: {
    occupancyPct: 72,
    activeReservations: 5,
    revenueToday: 12450.0,
    lowStockAlerts: 3,
    lowStockItems: emptyLowStock,
  },
  [`${FAKE_ORG_ID}:${FAKE_BRANCH_ID_2}`]: {
    occupancyPct: 45,
    activeReservations: 2,
    revenueToday: 3200.0,
    lowStockAlerts: 1,
    lowStockItems: emptyLowStock,
  },
  [`${FAKE_ORG_ID_2}:${FAKE_BRANCH_ID_2B}`]: {
    occupancyPct: 88,
    activeReservations: 12,
    revenueToday: 28900.0,
    lowStockAlerts: 0,
    lowStockItems: emptyLowStock,
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

/** Seed data: POS orders — use getPosOrders() from pos-state */

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

/** Seed data: menu categories — use getPosCategories() from pos-state */

export const MOCK_ACCOUNTS = getAccountingAccounts();

export const MOCK_JOURNALS = getAccountingJournals();

export const MOCK_EMPLOYEES = getHrEmployees();

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

export const MOCK_REPORT_JOBS = getReportJobs();

/** In-memory recipe store for E2E mocks */
const mockRecipes: Record<
  string,
  { menuItemId: string; lines: { inventoryItemId: string; quantity: number }[] }
> = {};

function resetRecipeState() {
  for (const key of Object.keys(mockRecipes)) delete mockRecipes[key];
}

/** Seed data: inventory items (initial snapshot; use getInventoryItems() after mutations) */
export const MOCK_INVENTORY = getInventoryItems();

/**
 * Intercept all backend API calls (localhost:3001) and return seed data so
 * tests work without a running API server.
 */
export async function mockApiRoutes(page: Page) {
  resetPmsState();
  resetPosState();
  resetRecipeState();
  resetInventoryState();
  resetAccountingState();
  resetHrState();
  resetInclusionsState();
  resetReportingState();
  resetTenantState();

  const fulfillJson = (route: import("@playwright/test").Route, body: unknown) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });

  const fulfillTenantMutation = (route: import("@playwright/test").Route, result: unknown) => {
    if (result && typeof result === "object" && "status" in result) {
      const err = result as { status: number; message: string };
      if (err.status >= 400) {
        return route.fulfill({
          status: err.status,
          contentType: "application/json",
          body: JSON.stringify({ message: err.message }),
        });
      }
    }
    return fulfillJson(route, result);
  };

  await page.route(backendApiRoute("tenants/onboarding/status"), (route) =>
    fulfillJson(route, {
      hasMembership: true,
      canAccessApp: true,
      pendingRequest: null,
    }),
  );

  await page.route(backendApiRoute("tenants/join-requests"), async (route) => {
    const method = route.request().method();
    if (method === "GET") return fulfillJson(route, []);
    return fulfillJson(route, {});
  });

  await page.route(backendApiRoute("tenants/members"), (route) =>
    fulfillJson(route, []),
  );

  await page.route(backendApiRoute("tenants/organizations/search"), (route) =>
    fulfillJson(route, []),
  );

  await page.route(backendApiRoute("tenants/organizations/by-join-code/"), (route) =>
    fulfillJson(route, null),
  );

  await page.route(backendApiRoute("tenants/organizations/current"), async (route) => {
    const method = route.request().method();
    const body = route.request().postDataJSON() as Record<string, unknown> | null;
    const result = handleTenantMutation(method, route.request().url(), body);
    return fulfillTenantMutation(route, result);
  });

  await page.route(backendApiRoute("tenants/branches/"), async (route) => {
    const method = route.request().method();
    const body = route.request().postDataJSON() as Record<string, unknown> | null;
    const result = handleTenantMutation(method, route.request().url(), body);
    return fulfillTenantMutation(route, result);
  });

  await page.route(backendApiListRoute("tenants/branches"), async (route) => {
    const method = route.request().method();
    const url = route.request().url();
    const body = route.request().postDataJSON() as Record<string, unknown> | null;
    const result = handleTenantMutation(method, url, body);
    return fulfillJson(route, result);
  });

  await page.route(backendApiListRoute("tenants/organizations"), async (route) => {
    const method = route.request().method();
    const url = route.request().url();
    if (method === "GET") {
      return fulfillJson(route, getMockOrganizations());
    }
    if (method === "POST") {
      const body = route.request().postDataJSON() as Record<string, unknown> | null;
      return fulfillJson(route, handleTenantMutation(method, url, body));
    }
    return fulfillJson(route, {});
  });

  await page.route(backendApiRoute("reporting/dashboard"), (route) => {
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

  await page.route(backendApiRoute("pms/reservations"), async (route) => {
    const method = route.request().method();
    const url = route.request().url();
    if (method === "GET") return fulfillJson(route, getPmsReservations());
    const body = route.request().postDataJSON() as Record<string, unknown> | null;
    const result = handlePmsReservationMutation(method, url, body);
    return fulfillJson(route, result);
  });

  await page.route(backendApiRoute("pms/guests"), async (route) => {
    const method = route.request().method();
    const url = route.request().url();
    if (method === "GET") return fulfillJson(route, getPmsGuests());
    const body = route.request().postDataJSON() as Record<string, unknown> | null;
    const result = handlePmsGuestMutation(method, url, body);
    return fulfillJson(route, result);
  });

  await page.route(backendApiRoute("pms/room-types"), async (route) => {
    const method = route.request().method();
    const url = route.request().url();
    if (method === "GET") return fulfillJson(route, getPmsRoomTypes());
    const result = handlePmsRoomTypeMutation(method, url);
    return fulfillJson(route, result);
  });

  await page.route(backendApiRoute("pms/availability"), (route) =>
    fulfillJson(route, getPmsRooms().filter((r) => r.status === "VACANT")),
  );

  await page.route(backendApiRoute("pms/rooms"), async (route) => {
    const method = route.request().method();
    const url = route.request().url();
    if (method === "GET" && !url.match(/\/rooms\/[^/?]+$/)) {
      return fulfillJson(route, getPmsRooms());
    }
    const body = route.request().postDataJSON() as Record<string, unknown> | null;
    const result = handlePmsRoomMutation(method, url, body);
    return fulfillJson(route, result);
  });

  await page.route(backendApiRoute("inclusions/"), async (route) => {
    const method = route.request().method();
    const url = route.request().url();
    const body = route.request().postDataJSON() as Record<string, unknown> | null;
    const result = handleInclusionsMutation(method, url, body);
    return fulfillJson(route, result);
  });

  await page.route(backendApiRoute("pos/orders"), async (route) => {
    const method = route.request().method();
    const url = route.request().url();
    if (method === "GET" && !url.match(/\/orders\/[^/?]+$/)) {
      return fulfillJson(route, getPosOrders());
    }
    const body = route.request().postDataJSON() as Record<string, unknown> | null;
    const result = handlePosOrderMutation(method, url, body);
    return fulfillJson(route, result);
  });

  await page.route(backendApiRoute("pos/menu/categories"), async (route) => {
    const method = route.request().method();
    const url = route.request().url();
    if (method === "GET" && !url.match(/\/categories\/[^/?]+$/)) {
      return fulfillJson(route, getPosCategories());
    }
    const body = route.request().postDataJSON() as Record<string, unknown> | null;
    const result = handlePosCategoryMutation(method, url, body);
    return fulfillJson(route, result);
  });

  await page.route(backendApiRoute("pos/menu/items"), async (route) => {
    const method = route.request().method();
    const url = route.request().url();
    const body = route.request().postDataJSON() as Record<string, unknown> | null;
    const result = handlePosMenuItemMutation(method, url, body);
    return fulfillJson(route, result);
  });

  await page.route(backendApiRoute("inventory/pools"), async (route) => {
    const method = route.request().method();
    const url = route.request().url();
    const body = route.request().postDataJSON() as Record<string, unknown> | null;
    const result = handleInventoryPoolMutation(method, url, body);
    return fulfillJson(route, result);
  });

  await page.route(backendApiRoute("inventory/items"), async (route) => {
    const method = route.request().method();
    const url = route.request().url();
    const body = route.request().postDataJSON() as Record<string, unknown> | null;
    const result = handleInventoryItemMutation(method, url, body);
    return fulfillJson(route, result);
  });

  await page.route(backendApiRoute("inventory/movements"), async (route) => {
    const method = route.request().method();
    const url = route.request().url();
    const body = route.request().postDataJSON() as Record<string, unknown> | null;
    const result = handleInventoryMovementMutation(method, url, body);
    return fulfillJson(route, result);
  });

  await page.route(
    (url) =>
      isBackendApiUrl(url.href) &&
      /\/inventory\/items\/[^/]+\/movements/.test(new URL(url.href).pathname),
    async (route) => {
      const method = route.request().method();
      const url = route.request().url();
      const body = route.request().postDataJSON() as Record<string, unknown> | null;
      const result = handleInventoryMovementMutation(method, url, body);
      return fulfillJson(route, result);
    },
  );

  await page.route(backendApiRoute("inventory/recipes"), async (route) => {
    const method = route.request().method();
    const url = route.request().url();
    const idMatch = url.match(/\/recipes\/([^/?]+)/);
    if (method === "GET" && idMatch) {
      const stored = mockRecipes[idMatch[1]];
      if (!stored) return fulfillJson(route, null);
      return fulfillJson(route, {
        menuItemId: stored.menuItemId,
        lines: stored.lines.map((l) => ({
          ...l,
          quantity: String(l.quantity),
          inventoryItem: getInventoryItems().find((i) => i.id === l.inventoryItemId),
        })),
      });
    }
    if (method === "POST") {
      const body = route.request().postDataJSON() as {
        menuItemId: string;
        lines: { inventoryItemId: string; quantity: number }[];
      };
      mockRecipes[body.menuItemId] = body;
      return fulfillJson(route, body);
    }
    return fulfillJson(route, {});
  });

  await page.route(backendApiRoute("accounting/"), async (route) => {
    const method = route.request().method();
    const url = route.request().url();
    const body = route.request().postDataJSON() as Record<string, unknown> | null;
    const result = handleAccountingMutation(method, url, body);
    if (result && typeof result === "object" && "status" in result && result.status === 400) {
      return route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ message: (result as { message: string }).message }),
      });
    }
    return fulfillJson(route, result);
  });

  await page.route(backendApiRoute("hr/"), async (route) => {
    const method = route.request().method();
    const url = route.request().url();
    const body = route.request().postDataJSON() as Record<string, unknown> | null;
    const result = handleHrMutation(method, url, body);
    if (result && typeof result === "object" && "status" in result) {
      const err = result as { status: number; message: string };
      if (err.status === 404 || err.status === 400) {
        return route.fulfill({
          status: err.status,
          contentType: "application/json",
          body: JSON.stringify({ message: err.message }),
        });
      }
    }
    return fulfillJson(route, result);
  });

  await page.route(backendApiRoute("payroll/runs"), async (route) => {
    const method = route.request().method();
    const url = route.request().url();
    const body = route.request().postDataJSON() as Record<string, unknown> | null;
    const result = handleHrMutation(method, url, body);
    return fulfillJson(route, result);
  });

  await page.route(backendApiRoute("reporting/types"), async (route) => {
    const result = handleReportingMutation(route.request().method(), route.request().url(), null);
    return fulfillJson(route, result);
  });

  await page.route(backendApiRoute("reporting/jobs"), async (route) => {
    const result = handleReportingMutation(route.request().method(), route.request().url(), null);
    return fulfillJson(route, result);
  });

  await page.route(backendApiRoute("reporting/export"), async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown> | null;
    const result = handleReportingMutation(route.request().method(), route.request().url(), body);
    return fulfillJson(route, result);
  });
}
