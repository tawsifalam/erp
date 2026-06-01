"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Box,
  Button,
  Flex,
  Input,
  Stack,
  Table,
  Text,
} from "@chakra-ui/react";
import { Role } from "@erp/types";
import { AppSelect } from "@/components/app-select";
import { EmptyState, ContentCard, FormField, TableSkeleton, TableScrollArea } from "@erp/ui";
import { apiFetch } from "@/lib/api-client";
import { appToast } from "@/lib/app-toast";
import { useConfirmDialog } from "@/lib/use-confirm-dialog";
import type { TenantHeaders } from "@/lib/api-client";

type JoinRequest = {
  id: string;
  message: string | null;
  createdAt: string;
  user: { id: string; email: string; name: string | null };
};

type Member = {
  id: string;
  role: string;
  isFounder: boolean;
  user: { id: string; email: string; name: string | null };
};

type OrganizationDetail = {
  id: string;
  name: string;
  joinCode: string;
};

type OrgInvite = {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  invitedBy: { id: string; email: string; name: string | null };
};

const ROLE_OPTIONS = Object.values(Role).map((r) => ({
  value: r,
  label: r.replace(/_/g, " "),
}));

export function TeamAccessSection({ tenant }: { tenant: TenantHeaders | undefined }) {
  const { ask, dialog } = useConfirmDialog();
  const [loading, setLoading] = useState(true);
  const [org, setOrg] = useState<OrganizationDetail | null>(null);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<OrgInvite[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>(Role.FRONT_DESK);
  const [approveRoles, setApproveRoles] = useState<Record<string, string>>({});
  const [acting, setActing] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);

  const load = useCallback(async () => {
    if (!tenant) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [orgData, requests, memberList, pendingInvites] = await Promise.all([
        apiFetch<OrganizationDetail>("/tenants/organizations/current", { tenant }),
        apiFetch<JoinRequest[]>("/tenants/join-requests", { tenant }),
        apiFetch<Member[]>("/tenants/members", { tenant }),
        apiFetch<OrgInvite[]>("/tenants/invites", { tenant }),
      ]);
      setOrg(orgData);
      setJoinRequests(requests);
      setMembers(memberList);
      setInvites(pendingInvites);
      const defaults: Record<string, string> = {};
      for (const r of requests) {
        defaults[r.id] = Role.FRONT_DESK;
      }
      setApproveRoles(defaults);
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to load team data");
    } finally {
      setLoading(false);
    }
  }, [tenant]);

  useEffect(() => {
    load();
  }, [load]);

  const sendInvite = async () => {
    if (!tenant || !inviteEmail.trim()) return;
    setInviting(true);
    try {
      await apiFetch("/tenants/invites", {
        method: "POST",
        tenant,
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      appToast.success("Invite email sent");
      setInviteEmail("");
      load();
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to send invite");
    } finally {
      setInviting(false);
    }
  };

  const revokeInvite = async (inviteId: string) => {
    if (!tenant) return;
    setActing(inviteId);
    try {
      await apiFetch(`/tenants/invites/${inviteId}/revoke`, {
        method: "POST",
        tenant,
        body: JSON.stringify({}),
      });
      appToast.success("Invite revoked");
      load();
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to revoke invite");
    } finally {
      setActing(null);
    }
  };

  const copyJoinCode = async () => {
    if (!org?.joinCode) return;
    await navigator.clipboard.writeText(org.joinCode);
    appToast.success("Join code copied to clipboard");
  };

  const approve = async (requestId: string) => {
    if (!tenant) return;
    const role = approveRoles[requestId] ?? Role.FRONT_DESK;
    setActing(requestId);
    try {
      await apiFetch(`/tenants/join-requests/${requestId}/approve`, {
        method: "POST",
        tenant,
        body: JSON.stringify({ role }),
      });
      appToast.success("Join request approved");
      load();
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to approve request");
    } finally {
      setActing(null);
    }
  };

  const rejectRequest = async (requestId: string) => {
    if (!tenant) return;
    setActing(requestId);
    try {
      await apiFetch(`/tenants/join-requests/${requestId}/reject`, {
        method: "POST",
        tenant,
        body: JSON.stringify({}),
      });
      appToast.success("Join request rejected");
      load();
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to reject request");
    } finally {
      setActing(null);
    }
  };

  const confirmReject = (req: JoinRequest) => {
    ask({
      title: "Reject join request?",
      description: `${req.user.name ?? req.user.email} will not be added to your organization.`,
      confirmLabel: "Reject",
      onConfirm: () => rejectRequest(req.id),
    });
  };

  const changeRole = async (userId: string, role: string) => {
    if (!tenant) return;
    setActing(userId);
    try {
      await apiFetch(`/tenants/members/${userId}/role`, {
        method: "PATCH",
        tenant,
        body: JSON.stringify({ role }),
      });
      appToast.success("Member role updated");
      load();
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to update role");
    } finally {
      setActing(null);
    }
  };

  const doRemoveMember = async (member: Member) => {
    if (!tenant || member.isFounder) return;
    setActing(member.user.id);
    try {
      await apiFetch(`/tenants/members/${member.user.id}`, {
        method: "DELETE",
        tenant,
      });
      appToast.success("Member removed");
      load();
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to remove member");
    } finally {
      setActing(null);
    }
  };

  const confirmRemoveMember = (member: Member) => {
    ask({
      title: "Remove team member?",
      description: `${member.user.name ?? member.user.email} will lose access to this organization immediately.`,
      confirmLabel: "Remove",
      onConfirm: () => doRemoveMember(member),
    });
  };

  if (loading) {
    return (
      <Stack gap={6}>
        <TableSkeleton rows={3} columns={4} />
        <TableSkeleton rows={4} columns={3} />
      </Stack>
    );
  }

  return (
    <>
      {dialog}
      <Stack gap={6}>
        <ContentCard>
          <Text fontWeight="semibold" mb={2}>
            Invite by email
          </Text>
          <Text fontSize="sm" color="fg.muted" mb={3}>
            Sends a PropelAuth signup invite. When they sign in, they are added to your team with
            the role you choose.
          </Text>
          <Flex gap={3} wrap="wrap" align="flex-end">
            <FormField label="Email" width="min(280px, 100%)">
              <Input
                type="email"
                size="sm"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@example.com"
              />
            </FormField>
            <FormField label="Role" help="ERP permissions for this member.">
              <AppSelect
                items={ROLE_OPTIONS}
                value={inviteRole}
                onValueChange={setInviteRole}
                width="160px"
                aria-label="Invite role"
              />
            </FormField>
            <Button
              size="sm"
              colorPalette="blue"
              onClick={sendInvite}
              loading={inviting}
              disabled={!inviteEmail.trim()}
            >
              Send invite
            </Button>
          </Flex>
        </ContentCard>

        <ContentCard>
          <Text fontWeight="semibold" mb={3}>
            Pending email invites
          </Text>
          {invites.length === 0 ? (
            <EmptyState
              title="No pending invites"
              description="Email invites appear here until the recipient signs in."
            />
          ) : (
            <TableScrollArea>
              <Table.Root size="sm">
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeader>Email</Table.ColumnHeader>
                    <Table.ColumnHeader>Role</Table.ColumnHeader>
                    <Table.ColumnHeader>Sent</Table.ColumnHeader>
                    <Table.ColumnHeader>Actions</Table.ColumnHeader>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {invites.map((inv) => (
                    <Table.Row key={inv.id}>
                      <Table.Cell fontSize="sm">{inv.email}</Table.Cell>
                      <Table.Cell fontSize="sm">{inv.role.replace(/_/g, " ")}</Table.Cell>
                      <Table.Cell fontSize="sm" color="fg.muted">
                        {new Date(inv.createdAt).toLocaleDateString()}
                      </Table.Cell>
                      <Table.Cell>
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => revokeInvite(inv.id)}
                          loading={acting === inv.id}
                        >
                          Revoke
                        </Button>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            </TableScrollArea>
          )}
        </ContentCard>

        {org && (
          <ContentCard>
            <Text fontWeight="semibold" mb={2}>
              Organization join code
            </Text>
            <Text fontSize="sm" color="fg.muted" mb={3}>
              Alternative: share this code so staff can request to join (you approve each request).
            </Text>
            <Flex gap={2} align="center">
              <Text fontFamily="mono" fontSize="lg">
                {org.joinCode}
              </Text>
              <Button size="sm" variant="outline" onClick={copyJoinCode}>
                Copy
              </Button>
            </Flex>
          </ContentCard>
        )}

        <ContentCard>
          <Text fontWeight="semibold" mb={3}>
            Pending join requests
          </Text>
          {joinRequests.length === 0 ? (
            <EmptyState
              title="No pending join requests"
              description="When staff request to join using your organization code, they will appear here for approval."
            />
          ) : (
            <TableScrollArea>
              <Table.Root size="sm">
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeader>User</Table.ColumnHeader>
                    <Table.ColumnHeader>Message</Table.ColumnHeader>
                    <Table.ColumnHeader>Role</Table.ColumnHeader>
                    <Table.ColumnHeader>Actions</Table.ColumnHeader>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {joinRequests.map((req) => (
                    <Table.Row key={req.id}>
                      <Table.Cell>
                        <Text fontSize="sm">{req.user.name ?? req.user.email}</Text>
                        <Text fontSize="xs" color="fg.muted">
                          {req.user.email}
                        </Text>
                      </Table.Cell>
                      <Table.Cell fontSize="sm">{req.message ?? "—"}</Table.Cell>
                      <Table.Cell>
                        <FormField
                          label="Assign role"
                          help="Role granted when you approve this request."
                        >
                          <AppSelect
                            items={ROLE_OPTIONS}
                            value={approveRoles[req.id] ?? Role.FRONT_DESK}
                            onValueChange={(v) =>
                              setApproveRoles((prev) => ({ ...prev, [req.id]: v }))
                            }
                            width="160px"
                            aria-label="Assign role"
                          />
                        </FormField>
                      </Table.Cell>
                      <Table.Cell>
                        <Flex gap={2} wrap="wrap">
                          <Button
                            size="xs"
                            colorPalette="green"
                            onClick={() => approve(req.id)}
                            loading={acting === req.id}
                          >
                            Approve
                          </Button>
                          <Button
                            size="xs"
                            variant="outline"
                            onClick={() => confirmReject(req)}
                            loading={acting === req.id}
                          >
                            Reject
                          </Button>
                        </Flex>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            </TableScrollArea>
          )}
        </ContentCard>

        <ContentCard>
          <Text fontWeight="semibold" mb={3}>
            Team members
          </Text>
          <TableScrollArea>
            <Table.Root size="sm">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeader>User</Table.ColumnHeader>
                  <Table.ColumnHeader>Role</Table.ColumnHeader>
                  <Table.ColumnHeader>Actions</Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {members.map((m) => (
                  <Table.Row key={m.id}>
                    <Table.Cell>
                      <Flex align="center" gap={2}>
                        <Box>
                          <Text fontSize="sm">{m.user.name ?? m.user.email}</Text>
                          <Text fontSize="xs" color="fg.muted">
                            {m.user.email}
                          </Text>
                        </Box>
                        {m.isFounder && (
                          <Text fontSize="xs" color="blue.600" fontWeight="medium">
                            Founder
                          </Text>
                        )}
                      </Flex>
                    </Table.Cell>
                    <Table.Cell>
                      <AppSelect
                        items={ROLE_OPTIONS}
                        value={m.role}
                        onValueChange={(v) => changeRole(m.user.id, v)}
                        width="160px"
                        disabled={acting === m.user.id}
                        aria-label="Member role"
                      />
                    </Table.Cell>
                    <Table.Cell>
                      {!m.isFounder ? (
                        <Button
                          size="xs"
                          variant="outline"
                          colorPalette="red"
                          onClick={() => confirmRemoveMember(m)}
                          loading={acting === m.user.id}
                        >
                          Remove
                        </Button>
                      ) : (
                        <Text fontSize="xs" color="fg.muted">
                          —
                        </Text>
                      )}
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </TableScrollArea>
          {members.length === 0 && (
            <EmptyState
              title="No team members found"
              description="Approved join requests and organization founders appear here."
            />
          )}
        </ContentCard>
      </Stack>
    </>
  );
}
