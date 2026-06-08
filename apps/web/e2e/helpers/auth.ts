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
  handleRatePlanMutation,
  quoteStay,
  resetRatesState,
} from "./rates-state";
import {
  handleProcurementMutation,
  resetProcurementState,
} from "./procurement-state";
import {
  findMenuItemBranch,
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
  getAccessibleBranchesForUser,
  resetBranchAccessState,
} from "./branch-access-state";
import {
  getCreatedOrganizationMemberships,
  getOrgName,
  getTenantBranches,
  handleTenantMutation,
  listOrgMembers,
  resetTenantState,
} from "./tenant-state";
import { listAuditLogs, resetAuditState } from "./audit-state";
import { handleInviteMutation, resetInviteState } from "./invite-state";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  resetNotificationState,
  unreadNotificationCount,
} from "./notification-state";
import {
  listNotificationPreferences,
  resetNotificationPreferenceState,
  updateNotificationPreference,
} from "./notification-preference-state";
import {
  handleIntegrationsMutation,
  handleIntegrationWebhook,
  resetIntegrationsState,
} from "./integrations-state";
import {
  handleJoinRequestMutation,
  lookupOrgByJoinCode,
  resetJoinRequestState,
} from "./join-request-state";
import {
  actorFromRequestHeaders,
  assertMockOrganizationAccess,
  assertMockReservationInBranch,
  assertMockRoomInOrg,
  branchIdFromRequestUrl,
  resolveMockBranchId,
} from "./tenant-scope-mock";

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

const MOCK_AUTH_USER = {
  id: "test-user-id",
  email: "admin@boulevard.cafe",
  name: "Admin User",
};

const MOCK_ACCESS_TOKEN = "mock-access-token";

/**
 * Mock first-party auth (refresh cookie + API session) so pages render as logged in.
 * Call this BEFORE navigating to any protected page.
 */
export async function mockAuth(page: Page) {
  const sessionBody = JSON.stringify({
    accessToken: MOCK_ACCESS_TOKEN,
    user: MOCK_AUTH_USER,
  });

  await page.route(
    (url) => isBackendApiUrl(url.href) && url.pathname.endsWith("/api/auth/refresh"),
    (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      return route.fulfill({ status: 200, contentType: "application/json", body: sessionBody });
    },
  );

  await page.route(
    (url) => isBackendApiUrl(url.href) && url.pathname.endsWith("/api/auth/login"),
    (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      return route.fulfill({ status: 200, contentType: "application/json", body: sessionBody });
    },
  );

  await page.route("**/api/auth/sync", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ hasActiveMembership: true, pendingJoinRequest: null }),
    }),
  );

  await page.context().addCookies([
    {
      name: "erp_refresh",
      value: "mock-refresh-token",
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

/** Organizations list for GET /api/tenants/organizations (branches stay in sync with tenant-state). */
export function getMockOrganizations() {
  const adminBranches = getTenantBranches().map((b) => ({ id: b.id, name: b.name }));
  const frontBranches = getAccessibleBranchesForUser("usr-front-desk", "FRONT_DESK").map((b) => ({
    id: b.id,
    name: b.name,
  }));

  return [
    {
      organizationId: FAKE_ORG_ID,
      role: "ADMIN",
      organization: {
        id: FAKE_ORG_ID,
        name: getOrgName(),
        branches: adminBranches,
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
    ...getCreatedOrganizationMemberships(),
  ];
}

/** Expose front-desk filtered branches for branch-access E2E (non-admin simulation). */
export function getMockFrontDeskOrganization() {
  return {
    organizationId: FAKE_ORG_ID,
    role: "FRONT_DESK",
    organization: {
      id: FAKE_ORG_ID,
      name: getOrgName(),
      branches: getAccessibleBranchesForUser("usr-front-desk", "FRONT_DESK").map((b) => ({
        id: b.id,
        name: b.name,
      })),
    },
  };
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
  resetRatesState();
  resetProcurementState();
  resetPosState();
  resetRecipeState();
  resetInventoryState();
  resetAccountingState();
  resetHrState();
  resetInclusionsState();
  resetReportingState();
  resetTenantState();
  resetInviteState();
  resetAuditState();
  resetNotificationState();
  resetNotificationPreferenceState();
  resetIntegrationsState();
  resetJoinRequestState();

  const fulfillJson = (route: import("@playwright/test").Route, body: unknown) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });

  const isMockApiError = (
    result: unknown,
  ): result is { status: number; message: string } =>
    !!result &&
    typeof result === "object" &&
    typeof (result as { status?: unknown }).status === "number" &&
    (result as { status: number }).status >= 400 &&
    typeof (result as { message?: unknown }).message === "string";

  const resolveOrgFromRoute = (route: import("@playwright/test").Route) => {
    const orgId = route.request().headers()["x-organization-id"];
    if (!orgId) {
      return { error: { status: 400, message: "X-Organization-Id header is required" } };
    }
    const error = assertMockOrganizationAccess(String(orgId));
    if (error) return { error };
    return { organizationId: String(orgId) };
  };

  const fulfillOrgScopeError = async (
    route: import("@playwright/test").Route,
    scope: ReturnType<typeof resolveOrgFromRoute>,
  ) => {
    if (!scope.error) return false;
    await route.fulfill({
      status: scope.error.status,
      contentType: "application/json",
      body: JSON.stringify({ message: scope.error.message }),
    });
    return true;
  };

  const resolveBranchFromRoute = (
    route: import("@playwright/test").Route,
    required = true,
  ) => {
    const req = route.request();
    const headers = req.headers();
    const orgId = headers["x-organization-id"];
    if (!orgId) {
      return { error: { status: 400, message: "X-Organization-Id header is required" } };
    }
    const headerBranch = headers["x-branch-id"];
    const queryBranch = branchIdFromRequestUrl(req.url());
    const actor = actorFromRequestHeaders(headers);
    return resolveMockBranchId(orgId, headerBranch, queryBranch, { required, actor });
  };

  const fulfillBranchScopeError = async (
    route: import("@playwright/test").Route,
    scope: ReturnType<typeof resolveMockBranchId>,
  ) => {
    if (!scope.error) return false;
    await route.fulfill({
      status: scope.error.status,
      contentType: "application/json",
      body: JSON.stringify({ message: scope.error.message }),
    });
    return true;
  };

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

  const notificationUserId = "usr-e2e-admin";

  // Register specific notification routes last (Playwright uses last matching route).
  await page.route(
    (url) => isBackendApiUrl(url.href) && new URL(url.href).pathname.endsWith("/notifications"),
    async (route) => {
      const orgScope = resolveOrgFromRoute(route);
      if (await fulfillOrgScopeError(route, orgScope)) return;
      if (route.request().method() !== "GET") return fulfillJson(route, {});
      const orgId = orgScope.organizationId!;
      const url = new URL(route.request().url());
      const limit = url.searchParams.get("limit")
        ? Number.parseInt(url.searchParams.get("limit")!, 10)
        : 50;
      return fulfillJson(route, listNotifications(String(orgId), notificationUserId, limit));
    },
  );

  await page.route(backendApiRoute("notifications/preferences"), async (route) => {
    const orgScope = resolveOrgFromRoute(route);
    if (await fulfillOrgScopeError(route, orgScope)) return;
    const orgId = orgScope.organizationId!;
    if (route.request().method() === "GET") {
      return fulfillJson(route, listNotificationPreferences(String(orgId), notificationUserId));
    }
    return fulfillJson(route, {});
  });

  await page.route(/\/api\/notifications\/preferences\/([^/]+)$/, async (route) => {
    const orgScope = resolveOrgFromRoute(route);
    if (await fulfillOrgScopeError(route, orgScope)) return;
    if (route.request().method() !== "PATCH") return fulfillJson(route, {});
    const orgId = orgScope.organizationId!;
    const typeMatch = route.request().url().match(/\/preferences\/([^/]+)$/);
    const type = typeMatch?.[1];
    if (!type) {
      return route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ message: "Missing notification type" }),
      });
    }
    const body = route.request().postDataJSON() as { inApp?: boolean; email?: boolean };
    const result = updateNotificationPreference(
      String(orgId),
      notificationUserId,
      type,
      body ?? {},
    );
    if (result && typeof result === "object" && "status" in result) {
      const err = result as { status: number; message: string };
      return route.fulfill({
        status: err.status,
        contentType: "application/json",
        body: JSON.stringify({ message: err.message }),
      });
    }
    return fulfillJson(route, result);
  });

  await page.route(/\/api\/notifications\/[^/]+\/read$/, async (route) => {
    const orgScope = resolveOrgFromRoute(route);
    if (await fulfillOrgScopeError(route, orgScope)) return;
    if (route.request().method() !== "PATCH") return fulfillJson(route, {});
    const orgId = orgScope.organizationId!;
    const idMatch = route.request().url().match(/\/notifications\/([^/]+)\/read/);
    const id = idMatch?.[1];
    if (!id) {
      return route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ message: "Not found" }),
      });
    }
    const row = markNotificationRead(String(orgId), notificationUserId, id);
    if (!row) {
      return route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ message: "Notification not found" }),
      });
    }
    return fulfillJson(route, row);
  });

  await page.route(backendApiRoute("notifications/read-all"), async (route) => {
    const orgScope = resolveOrgFromRoute(route);
    if (await fulfillOrgScopeError(route, orgScope)) return;
    if (route.request().method() !== "PATCH") return fulfillJson(route, {});
    const orgId = orgScope.organizationId!;
    markAllNotificationsRead(String(orgId), notificationUserId);
    return fulfillJson(route, { ok: true });
  });

  await page.route(backendApiRoute("notifications/unread-count"), async (route) => {
    const orgScope = resolveOrgFromRoute(route);
    if (await fulfillOrgScopeError(route, orgScope)) return;
    if (route.request().method() !== "GET") return fulfillJson(route, {});
    const orgId = orgScope.organizationId!;
    return fulfillJson(route, {
      count: unreadNotificationCount(String(orgId), notificationUserId),
    });
  });

  await page.route(/\/api\/integrations\/webhooks\/([^/]+)$/, async (route) => {
    if (route.request().method() !== "POST") return fulfillJson(route, {});
    const secret = route.request().headers()["x-webhook-secret"];
    const body = (route.request().postDataJSON() ?? {}) as Record<string, unknown>;
    const match = route.request().url().match(/\/webhooks\/([^/]+)/);
    const connectionId = match?.[1];
    if (!connectionId) {
      return route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ message: "Not found" }),
      });
    }
    const result = handleIntegrationWebhook(connectionId, secret, body);
    if (isMockApiError(result)) {
      return route.fulfill({
        status: result.status,
        contentType: "application/json",
        body: JSON.stringify({ message: result.message }),
      });
    }
    return fulfillJson(route, result);
  });

  await page.route(backendApiRoute("integrations/"), async (route) => {
    const orgScope = resolveOrgFromRoute(route);
    if (await fulfillOrgScopeError(route, orgScope)) return;
    const method = route.request().method();
    const url = route.request().url();
    if (url.includes("/webhooks/")) return route.continue();
    const orgId = orgScope.organizationId!;
    let body: Record<string, unknown> | undefined;
    if (method !== "GET" && method !== "DELETE") {
      try {
        body = (route.request().postDataJSON() ?? undefined) as Record<string, unknown> | undefined;
      } catch {
        body = undefined;
      }
    }
    const result = handleIntegrationsMutation(method, url, String(orgId), body);
    if (isMockApiError(result)) {
      return route.fulfill({
        status: result.status,
        contentType: "application/json",
        body: JSON.stringify({ message: result.message }),
      });
    }
    return fulfillJson(route, result);
  });

  await page.route(backendApiRoute("audit/logs"), async (route) => {
    const orgScope = resolveOrgFromRoute(route);
    if (await fulfillOrgScopeError(route, orgScope)) return;
    if (route.request().method() !== "GET") {
      return fulfillJson(route, {});
    }
    const url = new URL(route.request().url());
    const orgId = orgScope.organizationId!;
    const result = listAuditLogs(String(orgId), {
      entityType: url.searchParams.get("entityType") || undefined,
      userId: url.searchParams.get("userId") || undefined,
      from: url.searchParams.get("from") || undefined,
      to: url.searchParams.get("to") || undefined,
      limit: url.searchParams.get("limit")
        ? Number.parseInt(url.searchParams.get("limit")!, 10)
        : undefined,
    });
    return fulfillJson(route, result);
  });

  await page.route(backendApiRoute("tenants/onboarding/status"), (route) =>
    fulfillJson(route, {
      hasMembership: true,
      canAccessApp: true,
      pendingRequest: null,
    }),
  );

  await page.route(backendApiRoute("tenants/join-requests"), async (route) => {
    const orgScope = resolveOrgFromRoute(route);
    if (await fulfillOrgScopeError(route, orgScope)) return;
    const method = route.request().method();
    const url = route.request().url();
    const body = route.request().postDataJSON() as Record<string, unknown> | null;
    const orgId = orgScope.organizationId!;
    const result = handleJoinRequestMutation(method, url, body, "test-user-id", orgId);
    if (result === null) return fulfillJson(route, {});
    if (isMockApiError(result)) {
      return route.fulfill({
        status: result.status,
        contentType: "application/json",
        body: JSON.stringify({ message: result.message }),
      });
    }
    return fulfillJson(route, result);
  });

  await page.route(backendApiRoute("tenants/invites"), async (route) => {
    const orgScope = resolveOrgFromRoute(route);
    if (await fulfillOrgScopeError(route, orgScope)) return;
    const method = route.request().method();
    const url = route.request().url();
    const body = route.request().postDataJSON() as Record<string, unknown> | null;
    const result = handleInviteMutation(method, url, body, orgScope.organizationId);
    if (result !== null) {
      if (isMockApiError(result)) {
        return route.fulfill({
          status: result.status,
          contentType: "application/json",
          body: JSON.stringify({ message: result.message }),
        });
      }
      return fulfillJson(route, result);
    }
    return fulfillJson(route, {});
  });

  await page.route(backendApiRoute("tenants/members"), async (route) => {
    const orgScope = resolveOrgFromRoute(route);
    if (await fulfillOrgScopeError(route, orgScope)) return;
    if (route.request().method() !== "GET") return fulfillJson(route, {});
    return fulfillJson(route, listOrgMembers(orgScope.organizationId!));
  });

  await page.route(backendApiRoute("tenants/organizations/search"), (route) =>
    fulfillJson(route, []),
  );

  await page.route(backendApiRoute("tenants/organizations/by-join-code/"), (route) => {
    const code = decodeURIComponent(
      route.request().url().split("/by-join-code/")[1]?.split("?")[0] ?? "",
    );
    return fulfillJson(route, lookupOrgByJoinCode(code));
  });

  await page.route(backendApiRoute("tenants/organizations/current"), async (route) => {
    const orgScope = resolveOrgFromRoute(route);
    if (await fulfillOrgScopeError(route, orgScope)) return;
    const method = route.request().method();
    const body = route.request().postDataJSON() as Record<string, unknown> | null;
    const result = handleTenantMutation(
      method,
      route.request().url(),
      body,
      orgScope.organizationId,
    );
    return fulfillTenantMutation(route, result);
  });

  await page.route(backendApiRoute("tenants/branches/"), async (route) => {
    const orgScope = resolveOrgFromRoute(route);
    if (await fulfillOrgScopeError(route, orgScope)) return;
    const method = route.request().method();
    const body = route.request().postDataJSON() as Record<string, unknown> | null;
    const result = handleTenantMutation(
      method,
      route.request().url(),
      body,
      orgScope.organizationId,
    );
    return fulfillTenantMutation(route, result);
  });

  await page.route(backendApiListRoute("tenants/branches"), async (route) => {
    const orgScope = resolveOrgFromRoute(route);
    if (await fulfillOrgScopeError(route, orgScope)) return;
    const method = route.request().method();
    const url = route.request().url();
    const body = route.request().postDataJSON() as Record<string, unknown> | null;
    const result = handleTenantMutation(method, url, body, orgScope.organizationId);
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

  await page.route(backendApiRoute("reporting/dashboard"), async (route) => {
    const scope = resolveBranchFromRoute(route);
    if (await fulfillBranchScopeError(route, scope)) return;
    const orgId = route.request().headers()["x-organization-id"];
    const branchId = scope.branchId ?? FAKE_BRANCH_ID;
    const key = `${orgId ?? FAKE_ORG_ID}:${branchId}`;
    const body =
      MOCK_DASHBOARD_BY_TENANT[key] ?? MOCK_DASHBOARD_BY_TENANT[`${FAKE_ORG_ID}:${FAKE_BRANCH_ID}`];
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });

  await page.route(backendApiRoute("pms/reservations"), async (route) => {
    const orgScope = resolveOrgFromRoute(route);
    if (await fulfillOrgScopeError(route, orgScope)) return;
    const scope = resolveBranchFromRoute(route);
    if (await fulfillBranchScopeError(route, scope)) return;
    const method = route.request().method();
    const url = route.request().url();
    if (method === "GET") {
      return fulfillJson(
        route,
        getPmsReservations(orgScope.organizationId, scope.branchId),
      );
    }
    const body = route.request().postDataJSON() as Record<string, unknown> | null;
    const result = handlePmsReservationMutation(
      method,
      url,
      body,
      orgScope.organizationId,
      scope.branchId,
    );
    if (isMockApiError(result)) {
      return route.fulfill({
        status: result.status,
        contentType: "application/json",
        body: JSON.stringify({ message: result.message }),
      });
    }
    return fulfillJson(route, result);
  });

  await page.route(backendApiRoute("pms/guests"), async (route) => {
    const orgScope = resolveOrgFromRoute(route);
    if (await fulfillOrgScopeError(route, orgScope)) return;
    const method = route.request().method();
    const url = route.request().url();
    const orgId = orgScope.organizationId!;
    if (method === "GET") return fulfillJson(route, getPmsGuests(orgId));
    const body = route.request().postDataJSON() as Record<string, unknown> | null;
    const result = handlePmsGuestMutation(method, url, body, orgId);
    if (isMockApiError(result)) {
      return route.fulfill({
        status: result.status,
        contentType: "application/json",
        body: JSON.stringify({ message: result.message }),
      });
    }
    return fulfillJson(route, result);
  });

  await page.route(backendApiRoute("pms/room-types"), async (route) => {
    const orgScope = resolveOrgFromRoute(route);
    if (await fulfillOrgScopeError(route, orgScope)) return;
    const method = route.request().method();
    const url = route.request().url();
    const orgId = orgScope.organizationId!;
    if (method === "GET") return fulfillJson(route, getPmsRoomTypes(orgId));
    const result = handlePmsRoomTypeMutation(method, url, orgId);
    if (isMockApiError(result)) {
      return route.fulfill({
        status: result.status,
        contentType: "application/json",
        body: JSON.stringify({ message: result.message }),
      });
    }
    return fulfillJson(route, result);
  });

  await page.route(backendApiRoute("pms/availability"), async (route) => {
    const scope = resolveBranchFromRoute(route);
    if (await fulfillBranchScopeError(route, scope)) return;
    const excludeReservationId = new URL(route.request().url()).searchParams.get(
      "excludeReservationId",
    );
    if (excludeReservationId) {
      const resError = assertMockReservationInBranch(scope.branchId!, excludeReservationId);
      if (resError) {
        return route.fulfill({
          status: resError.status,
          contentType: "application/json",
          body: JSON.stringify({ message: resError.message }),
        });
      }
    }
    return fulfillJson(
      route,
      getPmsRooms(scope.branchId).filter((r) => r.status === "VACANT"),
    );
  });

  await page.route(backendApiRoute("procurement/"), async (route) => {
    const orgScope = resolveOrgFromRoute(route);
    if (await fulfillOrgScopeError(route, orgScope)) return;
    const scope = resolveBranchFromRoute(route);
    if (await fulfillBranchScopeError(route, scope)) return;
    const method = route.request().method();
    const url = route.request().url();
    const body = route.request().postDataJSON() as Record<string, unknown> | null;
    const result = handleProcurementMutation(
      method,
      url,
      body,
      orgScope.organizationId,
      scope.branchId,
    );
    if (isMockApiError(result)) {
      const err = result;
      return route.fulfill({
        status: err.status,
        contentType: "application/json",
        body: JSON.stringify({ message: err.message }),
      });
    }
    return fulfillJson(route, result);
  });

  await page.route(backendApiRoute("pms/rate-plans"), async (route) => {
    const orgScope = resolveOrgFromRoute(route);
    if (await fulfillOrgScopeError(route, orgScope)) return;
    const method = route.request().method();
    const url = route.request().url();
    let body: Record<string, unknown> | null = null;
    if (method !== "GET" && method !== "DELETE") {
      try {
        body = (route.request().postDataJSON() ?? null) as Record<string, unknown> | null;
      } catch {
        body = null;
      }
    }
    const result = handleRatePlanMutation(method, url, body, orgScope.organizationId);
    if (isMockApiError(result)) {
      return route.fulfill({
        status: result.status,
        contentType: "application/json",
        body: JSON.stringify({ message: result.message }),
      });
    }
    return fulfillJson(route, result);
  });

  await page.route(backendApiRoute("pms/pricing/quote"), async (route) => {
    const orgScope = resolveOrgFromRoute(route);
    if (await fulfillOrgScopeError(route, orgScope)) return;
    const orgId = orgScope.organizationId!;
    const url = new URL(route.request().url());
    const roomId = url.searchParams.get("roomId");
    const checkIn = url.searchParams.get("checkIn");
    const checkOut = url.searchParams.get("checkOut");
    if (roomId) {
      const roomScopeError = assertMockRoomInOrg(String(orgId), roomId);
      if (roomScopeError) {
        return route.fulfill({
          status: roomScopeError.status,
          contentType: "application/json",
          body: JSON.stringify({ message: roomScopeError.message }),
        });
      }
    }
    const room = getPmsRooms().find((r) => r.id === roomId);
    const adults = Number(url.searchParams.get("adultCount") ?? "1");
    const children = Number(url.searchParams.get("childCount") ?? "0");
    if (!room || !checkIn || !checkOut) {
      return fulfillJson(route, {
        totalAmount: 0,
        roomAmount: 0,
        fbAmount: 0,
        nights: 0,
        ratePlanId: null,
        ratePlanName: null,
        inclusionPackageId: null,
        inclusionPackageName: null,
        nightlyBreakdown: [],
      });
    }
    return fulfillJson(
      route,
      quoteStay(room, new Date(checkIn), new Date(checkOut), adults, children),
    );
  });

  await page.route(backendApiRoute("pms/rooms"), async (route) => {
    const method = route.request().method();
    const url = route.request().url();
    if (method === "GET" && !url.match(/\/rooms\/[^/?]+$/)) {
      const scope = resolveBranchFromRoute(route);
      if (await fulfillBranchScopeError(route, scope)) return;
      return fulfillJson(route, getPmsRooms(scope.branchId));
    }
    const orgScope = resolveOrgFromRoute(route);
    if (await fulfillOrgScopeError(route, orgScope)) return;
    const scope = resolveBranchFromRoute(route);
    if (await fulfillBranchScopeError(route, scope)) return;
    const body = route.request().postDataJSON() as Record<string, unknown> | null;
    const result = handlePmsRoomMutation(
      method,
      url,
      body,
      orgScope.organizationId,
      scope.branchId,
    );
    if (isMockApiError(result)) {
      return route.fulfill({
        status: result.status,
        contentType: "application/json",
        body: JSON.stringify({ message: result.message }),
      });
    }
    return fulfillJson(route, result);
  });

  await page.route(backendApiRoute("inclusions/"), async (route) => {
    const method = route.request().method();
    const url = route.request().url();
    let body: Record<string, unknown> | null = null;
    if (method !== "GET" && method !== "DELETE") {
      try {
        body = (route.request().postDataJSON() ?? null) as Record<string, unknown> | null;
      } catch {
        body = null;
      }
    }
    if (url.includes("/packages")) {
      const orgScope = resolveOrgFromRoute(route);
      if (await fulfillOrgScopeError(route, orgScope)) return;
      const result = handleInclusionsMutation(
        method,
        url,
        body,
        undefined,
        orgScope.organizationId,
      );
      return fulfillJson(route, result);
    }
    const orgScope = resolveOrgFromRoute(route);
    if (await fulfillOrgScopeError(route, orgScope)) return;
    const scope = resolveBranchFromRoute(route);
    if (await fulfillBranchScopeError(route, scope)) return;
    const result = handleInclusionsMutation(
      method,
      url,
      body,
      scope.branchId,
      orgScope.organizationId,
    );
    if (isMockApiError(result)) {
      return route.fulfill({
        status: result.status,
        contentType: "application/json",
        body: JSON.stringify({ message: result.message }),
      });
    }
    return fulfillJson(route, result);
  });

  await page.route(backendApiRoute("pos/orders"), async (route) => {
    const scope = resolveBranchFromRoute(route);
    if (await fulfillBranchScopeError(route, scope)) return;
    const method = route.request().method();
    const url = route.request().url();
    if (method === "GET" && !url.match(/\/orders\/[^/?]+$/)) {
      return fulfillJson(route, getPosOrders(scope.branchId));
    }
    const body = route.request().postDataJSON() as Record<string, unknown> | null;
    const result = handlePosOrderMutation(method, url, body, scope.branchId);
    if (isMockApiError(result)) {
      return route.fulfill({
        status: result.status,
        contentType: "application/json",
        body: JSON.stringify({ message: result.message }),
      });
    }
    return fulfillJson(route, result);
  });

  await page.route(backendApiRoute("pos/menu/categories"), async (route) => {
    const scope = resolveBranchFromRoute(route);
    if (await fulfillBranchScopeError(route, scope)) return;
    const method = route.request().method();
    const url = route.request().url();
    if (method === "GET" && !url.match(/\/categories\/[^/?]+$/)) {
      return fulfillJson(route, getPosCategories(scope.branchId));
    }
    const body = route.request().postDataJSON() as Record<string, unknown> | null;
    const result = handlePosCategoryMutation(method, url, body, scope.branchId);
    if (isMockApiError(result)) {
      return route.fulfill({
        status: result.status,
        contentType: "application/json",
        body: JSON.stringify({ message: result.message }),
      });
    }
    return fulfillJson(route, result);
  });

  await page.route(backendApiRoute("pos/menu/items"), async (route) => {
    const scope = resolveBranchFromRoute(route);
    if (await fulfillBranchScopeError(route, scope)) return;
    const method = route.request().method();
    const url = route.request().url();
    const body = route.request().postDataJSON() as Record<string, unknown> | null;
    const result = handlePosMenuItemMutation(method, url, body, scope.branchId);
    if (isMockApiError(result)) {
      return route.fulfill({
        status: result.status,
        contentType: "application/json",
        body: JSON.stringify({ message: result.message }),
      });
    }
    return fulfillJson(route, result);
  });

  await page.route(backendApiRoute("inventory/pools"), async (route) => {
    const orgScope = resolveOrgFromRoute(route);
    if (await fulfillOrgScopeError(route, orgScope)) return;
    const method = route.request().method();
    const url = route.request().url();
    const body = route.request().postDataJSON() as Record<string, unknown> | null;
    const result = handleInventoryPoolMutation(method, url, body);
    return fulfillJson(route, result);
  });

  await page.route(backendApiRoute("inventory/items"), async (route) => {
    const scope = resolveBranchFromRoute(route);
    if (await fulfillBranchScopeError(route, scope)) return;
    const method = route.request().method();
    const url = route.request().url();
    const body = route.request().postDataJSON() as Record<string, unknown> | null;
    const result = handleInventoryItemMutation(method, url, body, scope.branchId);
    if (isMockApiError(result)) {
      return route.fulfill({
        status: result.status,
        contentType: "application/json",
        body: JSON.stringify({ message: result.message }),
      });
    }
    return fulfillJson(route, result);
  });

  await page.route(backendApiRoute("inventory/movements"), async (route) => {
    const scope = resolveBranchFromRoute(route);
    if (await fulfillBranchScopeError(route, scope)) return;
    const method = route.request().method();
    const url = route.request().url();
    const body = route.request().postDataJSON() as Record<string, unknown> | null;
    const result = handleInventoryMovementMutation(method, url, body, scope.branchId);
    if (isMockApiError(result)) {
      return route.fulfill({
        status: result.status,
        contentType: "application/json",
        body: JSON.stringify({ message: result.message }),
      });
    }
    return fulfillJson(route, result);
  });

  await page.route(
    (url) =>
      isBackendApiUrl(url.href) &&
      /\/inventory\/items\/[^/]+\/movements/.test(new URL(url.href).pathname),
    async (route) => {
      const scope = resolveBranchFromRoute(route);
      if (await fulfillBranchScopeError(route, scope)) return;
      const method = route.request().method();
      const url = route.request().url();
      const body = route.request().postDataJSON() as Record<string, unknown> | null;
      const result = handleInventoryMovementMutation(method, url, body, scope.branchId);
      if (isMockApiError(result)) {
        return route.fulfill({
          status: result.status,
          contentType: "application/json",
          body: JSON.stringify({ message: result.message }),
        });
      }
      return fulfillJson(route, result);
    },
  );

  await page.route(backendApiRoute("inventory/recipes"), async (route) => {
    const scope = resolveBranchFromRoute(route);
    if (await fulfillBranchScopeError(route, scope)) return;
    const method = route.request().method();
    const url = route.request().url();
    const idMatch = url.match(/\/recipes\/([^/?]+)/);
    if (method === "GET" && idMatch) {
      const menuItemId = idMatch[1];
      const itemBranch = findMenuItemBranch(menuItemId);
      if (!itemBranch || (scope.branchId && itemBranch !== scope.branchId)) {
        return route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ message: "Menu item not found" }),
        });
      }
      const stored = mockRecipes[menuItemId];
      if (!stored) return fulfillJson(route, null);
      return fulfillJson(route, {
        menuItemId: stored.menuItemId,
        lines: stored.lines.map((l) => ({
          ...l,
          quantity: String(l.quantity),
          inventoryItem: getInventoryItems(scope.branchId).find(
            (i) => i.id === l.inventoryItemId,
          ),
        })),
      });
    }
    if (method === "POST") {
      const body = route.request().postDataJSON() as {
        menuItemId: string;
        lines: { inventoryItemId: string; quantity: number }[];
      };
      const itemBranch = findMenuItemBranch(body.menuItemId);
      if (!itemBranch || (scope.branchId && itemBranch !== scope.branchId)) {
        return route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ message: "Menu item not found" }),
        });
      }
      mockRecipes[body.menuItemId] = body;
      return fulfillJson(route, body);
    }
    return fulfillJson(route, {});
  });

  await page.route(backendApiRoute("accounting/"), async (route) => {
    const orgScope = resolveOrgFromRoute(route);
    if (await fulfillOrgScopeError(route, orgScope)) return;
    const method = route.request().method();
    const url = route.request().url();
    const orgId = orgScope.organizationId!;
    const body = route.request().postDataJSON() as Record<string, unknown> | null;
    const result = handleAccountingMutation(method, url, body, String(orgId));
    if (result && typeof result === "object" && "status" in result) {
      const err = result as { status: number; message: string };
      if (err.status === 400 || err.status === 404) {
        return route.fulfill({
          status: err.status,
          contentType: "application/json",
          body: JSON.stringify({ message: err.message }),
        });
      }
    }
    return fulfillJson(route, result);
  });

  await page.route(backendApiRoute("hr/"), async (route) => {
    const orgScope = resolveOrgFromRoute(route);
    if (await fulfillOrgScopeError(route, orgScope)) return;
    const scope = resolveBranchFromRoute(route);
    if (await fulfillBranchScopeError(route, scope)) return;
    const method = route.request().method();
    const url = route.request().url();
    const body = route.request().postDataJSON() as Record<string, unknown> | null;
    const result = handleHrMutation(
      method,
      url,
      body,
      orgScope.organizationId,
      scope.branchId,
    );
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
    const orgScope = resolveOrgFromRoute(route);
    if (await fulfillOrgScopeError(route, orgScope)) return;
    const method = route.request().method();
    const url = route.request().url();
    const body = route.request().postDataJSON() as Record<string, unknown> | null;
    const result = handleHrMutation(method, url, body, orgScope.organizationId);
    if (isMockApiError(result)) {
      const err = result;
      return route.fulfill({
        status: err.status,
        contentType: "application/json",
        body: JSON.stringify({ message: err.message }),
      });
    }
    if (
      result &&
      typeof result === "object" &&
      "payslipPdf" in (result as Record<string, unknown>)
    ) {
      return route.fulfill({
        status: 200,
        contentType: "application/pdf",
        body: Buffer.from("%PDF-1.4\n% Mock payslip"),
      });
    }
    return fulfillJson(route, result);
  });

  await page.route(backendApiRoute("reporting/types"), async (route) => {
    const orgScope = resolveOrgFromRoute(route);
    if (await fulfillOrgScopeError(route, orgScope)) return;
    const result = handleReportingMutation(route.request().method(), route.request().url(), null);
    return fulfillJson(route, result);
  });

  await page.route(backendApiRoute("reporting/jobs"), async (route) => {
    const orgScope = resolveOrgFromRoute(route);
    if (await fulfillOrgScopeError(route, orgScope)) return;
    const method = route.request().method();
    const url = route.request().url();
    if (method === "GET" && url.includes("/download")) {
      const jobId = url.match(/\/reporting\/jobs\/([^/]+)\/download/)?.[1];
      const job = jobId
        ? getReportJobs(orgScope.organizationId).find((j) => j.id === jobId)
        : undefined;
      if (!job?.fileUrl || job.status !== "COMPLETED") {
        return route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ message: "Report file not available" }),
        });
      }
      const isPdf = job.fileUrl.endsWith(".pdf");
      return route.fulfill({
        status: 200,
        contentType: isPdf ? "application/pdf" : "text/csv",
        body: Buffer.from(isPdf ? "%PDF-1.4\n% Mock report" : "type,value\nbranch_summary,1"),
      });
    }
    const result = handleReportingMutation(method, url, null, orgScope.organizationId);
    return fulfillJson(route, result);
  });

  await page.route(backendApiRoute("reporting/export"), async (route) => {
    const orgScope = resolveOrgFromRoute(route);
    if (await fulfillOrgScopeError(route, orgScope)) return;
    const scope = resolveBranchFromRoute(route, false);
    if (await fulfillBranchScopeError(route, scope)) return;
    const body = route.request().postDataJSON() as Record<string, unknown> | null;
    const result = handleReportingMutation(
      route.request().method(),
      route.request().url(),
      body,
      orgScope.organizationId,
    );
    return fulfillJson(route, result);
  });
}
