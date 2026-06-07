const MOCK_ORG_A = "org-test-001";
const MOCK_ORG_B = "org-test-002";

type PendingInvite = {
  id: string;
  organizationId: string;
  email: string;
  role: string;
  createdAt: string;
  invitedBy: { id: string; email: string; name: string | null };
};

const INITIAL_INVITES: PendingInvite[] = [
  {
    id: "inv_a_001",
    organizationId: MOCK_ORG_A,
    email: "desk@boulevard.example",
    role: "FRONT_DESK",
    createdAt: "2026-06-01T10:00:00Z",
    invitedBy: { id: "usr-e2e-admin", email: "admin@test.com", name: "Admin" },
  },
  {
    id: "inv_b_001",
    organizationId: MOCK_ORG_B,
    email: "harbor@example.com",
    role: "FRONT_DESK",
    createdAt: "2026-06-01T11:00:00Z",
    invitedBy: { id: "usr-org-b-owner", email: "owner@harbor.example", name: "Harbor Owner" },
  },
];

let pendingInvites = structuredClone(INITIAL_INVITES) as PendingInvite[];

export function resetInviteState() {
  pendingInvites = structuredClone(INITIAL_INVITES) as PendingInvite[];
}

export function listPendingInvites(organizationId?: string) {
  const rows = pendingInvites.map((i) => ({ ...i, invitedBy: { ...i.invitedBy } }));
  if (!organizationId) return rows;
  return rows.filter((i) => i.organizationId === organizationId);
}

function findInviteInOrg(id: string, organizationId?: string) {
  const invite = pendingInvites.find((i) => i.id === id);
  if (!invite) return null;
  if (organizationId && invite.organizationId !== organizationId) return null;
  return invite;
}

export function handleInviteMutation(
  method: string,
  url: string,
  body: Record<string, unknown> | null,
  organizationId?: string,
): unknown {
  if (!url.includes("/tenants/invites")) return null;

  if (method === "GET") {
    return listPendingInvites(organizationId);
  }

  if (method === "POST" && url.match(/\/invites\/[^/]+\/revoke/)) {
    const idMatch = url.match(/\/invites\/([^/]+)\/revoke/);
    const id = idMatch?.[1];
    if (!id || !findInviteInOrg(id, organizationId)) {
      return { status: 404, message: "Invite not found" };
    }
    pendingInvites = pendingInvites.filter((i) => i.id !== id);
    return { id, status: "REVOKED" };
  }

  if (method === "POST" && url.endsWith("/invites")) {
    const email = String(body?.email ?? "").trim().toLowerCase();
    const role = String(body?.role ?? "FRONT_DESK");
    const invite: PendingInvite = {
      id: `inv_${pendingInvites.length + 1}`,
      organizationId: organizationId ?? MOCK_ORG_A,
      email,
      role,
      createdAt: new Date().toISOString(),
      invitedBy: { id: "user_admin", email: "admin@test.com", name: "Admin" },
    };
    pendingInvites.push(invite);
    return invite;
  }

  return null;
}
