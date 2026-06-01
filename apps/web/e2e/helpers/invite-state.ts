type PendingInvite = {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  invitedBy: { id: string; email: string; name: string | null };
};

let pendingInvites: PendingInvite[] = [];

export function resetInviteState() {
  pendingInvites = [];
}

export function listPendingInvites() {
  return pendingInvites.map((i) => ({ ...i }));
}

export function handleInviteMutation(
  method: string,
  url: string,
  body: Record<string, unknown> | null,
): unknown {
  if (!url.includes("/tenants/invites")) return null;

  if (method === "GET") {
    return listPendingInvites();
  }

  if (method === "POST" && url.match(/\/invites\/[^/]+\/revoke/)) {
    const idMatch = url.match(/\/invites\/([^/]+)\/revoke/);
    const id = idMatch?.[1];
    pendingInvites = pendingInvites.filter((i) => i.id !== id);
    return { id, status: "REVOKED" };
  }

  if (method === "POST" && url.endsWith("/invites")) {
    const email = String(body?.email ?? "").trim().toLowerCase();
    const role = String(body?.role ?? "FRONT_DESK");
    const invite: PendingInvite = {
      id: `inv_${pendingInvites.length + 1}`,
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
