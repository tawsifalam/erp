import { E2E_ORG_ID } from "./audit-state";
import { getCurrentOrganization, getOrgName } from "./tenant-state";

export const E2E_JOIN_CODE = "ov_testcode";
export const APPLICANT_USER_ID = "user-applicant-001";
export const APPLICANT_EMAIL = "applicant@example.com";

export type MockJoinRequest = {
  id: string;
  organizationId: string;
  userId: string;
  message: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  user: { id: string; email: string; name: string | null };
  organization?: { id: string; name: string };
  assignedRole?: string;
};

let joinRequests: MockJoinRequest[] = [];

export function resetJoinRequestState() {
  joinRequests = [];
}

export function seedPendingJoinRequest(input?: {
  id?: string;
  email?: string;
  name?: string;
  message?: string;
}) {
  joinRequests = [
    {
      id: input?.id ?? "ojr_pending_001",
      organizationId: E2E_ORG_ID,
      userId: APPLICANT_USER_ID,
      message: input?.message ?? "Joining as front desk",
      status: "PENDING",
      user: {
        id: APPLICANT_USER_ID,
        email: input?.email ?? APPLICANT_EMAIL,
        name: input?.name ?? "New Applicant",
      },
      organization: { id: E2E_ORG_ID, name: getOrgName() },
    },
  ];
}

export function lookupOrgByJoinCode(code: string) {
  const normalized = code.trim().toLowerCase();
  const org = getCurrentOrganization();
  if (normalized === E2E_JOIN_CODE || normalized === org.joinCode.toLowerCase()) {
    return { id: org.id, name: org.name };
  }
  return null;
}

export function getOnboardingStatus(userId: string) {
  const pending = joinRequests.find(
    (r) => r.userId === userId && r.status === "PENDING",
  );
  const approved = joinRequests.find(
    (r) => r.userId === userId && r.status === "APPROVED",
  );
  if (approved) {
    return {
      hasMembership: true,
      canAccessApp: true,
      pendingRequest: null,
    };
  }
  if (pending) {
    return {
      hasMembership: false,
      canAccessApp: false,
      pendingRequest: {
        id: pending.id,
        organizationId: pending.organizationId,
        organizationName: pending.organization?.name ?? getOrgName(),
        message: pending.message,
        createdAt: new Date().toISOString(),
      },
    };
  }
  return {
    hasMembership: false,
    canAccessApp: false,
    pendingRequest: null,
  };
}

export function listPendingJoinRequests(organizationId: string) {
  return joinRequests
    .filter((r) => r.organizationId === organizationId && r.status === "PENDING")
    .map((r) => ({
      id: r.id,
      message: r.message,
      user: r.user,
      createdAt: new Date().toISOString(),
    }));
}

export function handleJoinRequestMutation(
  method: string,
  url: string,
  body: Record<string, unknown> | null,
  actingUserId = "test-user-id",
  organizationId = E2E_ORG_ID,
): unknown {
  if (url.includes("/organizations/by-join-code/") && method === "GET") {
    const code = decodeURIComponent(url.split("/by-join-code/")[1]?.split("?")[0] ?? "");
    return lookupOrgByJoinCode(code);
  }

  if (url.includes("/join-requests/mine") && method === "GET") {
    return joinRequests.filter((r) => r.userId === actingUserId);
  }

  if (url.match(/\/join-requests\/[^/]+\/approve/) && method === "POST") {
    const id = url.match(/\/join-requests\/([^/]+)\/approve/)?.[1];
    const req = joinRequests.find((r) => r.id === id && r.status === "PENDING");
    if (!req) return { status: 404, message: "Pending join request not found" };
    req.status = "APPROVED";
    req.assignedRole = String(body?.role ?? "FRONT_DESK");
    return {
      ...req,
      organization: { id: req.organizationId, name: getOrgName() },
    };
  }

  if (url.match(/\/join-requests\/[^/]+\/reject/) && method === "POST") {
    const id = url.match(/\/join-requests\/([^/]+)\/reject/)?.[1];
    const req = joinRequests.find((r) => r.id === id && r.status === "PENDING");
    if (!req) return { status: 404, message: "Pending join request not found" };
    req.status = "REJECTED";
    return { ...req };
  }

  if (url.match(/\/join-requests\/[^/]+/) && method === "DELETE") {
    const id = url.match(/\/join-requests\/([^/]+)/)?.[1];
    const req = joinRequests.find((r) => r.id === id);
    if (!req) return { status: 404, message: "Join request not found" };
    req.status = "CANCELLED";
    return { ...req };
  }

  if (
    (url.endsWith("/join-requests") || url.match(/\/join-requests\?/)) &&
    method === "POST"
  ) {
    const orgId = String(body?.organizationId ?? E2E_ORG_ID);
      const existing = joinRequests.find(
        (r) => r.userId === actingUserId && r.status === "PENDING",
      );
      if (existing) {
        return { status: 409, message: "You already have a pending join request" };
      }
      const req: MockJoinRequest = {
        id: `ojr_${joinRequests.length + 1}`,
        organizationId: orgId,
        userId: actingUserId,
        message: body?.message ? String(body.message) : null,
        status: "PENDING",
        user: {
          id: actingUserId,
          email: actingUserId === APPLICANT_USER_ID ? APPLICANT_EMAIL : "admin@boulevard.cafe",
          name: actingUserId === APPLICANT_USER_ID ? "New Applicant" : "Admin User",
        },
        organization: { id: orgId, name: getOrgName() },
      };
      joinRequests.push(req);
      return req;
  }

  if (url.includes("/join-requests") && method === "GET" && !url.includes("/mine")) {
    return listPendingJoinRequests(organizationId);
  }

  return null;
}
