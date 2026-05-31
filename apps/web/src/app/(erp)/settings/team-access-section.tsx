"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Box,
  Button,
  Flex,
  Stack,
  Table,
  Text,
} from "@chakra-ui/react";
import { Role } from "@erp/types";
import { AppSelect } from "@/components/app-select";
import { EmptyState, LoadingState } from "@erp/ui";
import { apiFetch } from "@/lib/api-client";
import type { TenantHeaders } from "@/lib/api-client";
import { shortId } from "@/lib/format";

type JoinRequest = {
  id: string;
  message: string | null;
  createdAt: string;
  user: { id: string; email: string; name: string | null };
};

type Member = {
  id: string;
  role: string;
  user: { id: string; email: string; name: string | null };
};

type OrganizationDetail = {
  id: string;
  name: string;
  joinCode: string;
};

const ROLE_OPTIONS = Object.values(Role).map((r) => ({
  value: r,
  label: r.replace(/_/g, " "),
}));

export function TeamAccessSection({
  tenant,
  onMessage,
  onError,
}: {
  tenant: TenantHeaders | undefined;
  onMessage: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [org, setOrg] = useState<OrganizationDetail | null>(null);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [approveRoles, setApproveRoles] = useState<Record<string, string>>({});
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tenant) {
      setLoading(false);
      return;
    }
    setLoading(true);
    onError("");
    try {
      const [orgData, requests, memberList] = await Promise.all([
        apiFetch<OrganizationDetail>("/tenants/organizations/current", { tenant }),
        apiFetch<JoinRequest[]>("/tenants/join-requests", { tenant }),
        apiFetch<Member[]>("/tenants/members", { tenant }),
      ]);
      setOrg(orgData);
      setJoinRequests(requests);
      setMembers(memberList);
      const defaults: Record<string, string> = {};
      for (const r of requests) {
        defaults[r.id] = Role.FRONT_DESK;
      }
      setApproveRoles(defaults);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Failed to load team data");
    } finally {
      setLoading(false);
    }
  }, [tenant, onError]);

  useEffect(() => {
    load();
  }, [load]);

  const copyJoinCode = async () => {
    if (!org?.joinCode) return;
    await navigator.clipboard.writeText(org.joinCode);
    onMessage("Join code copied to clipboard");
  };

  const approve = async (requestId: string) => {
    if (!tenant) return;
    const role = approveRoles[requestId] ?? Role.FRONT_DESK;
    setActing(requestId);
    onError("");
    try {
      await apiFetch(`/tenants/join-requests/${requestId}/approve`, {
        method: "POST",
        tenant,
        body: JSON.stringify({ role }),
      });
      onMessage("Join request approved");
      load();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Failed to approve request");
    } finally {
      setActing(null);
    }
  };

  const reject = async (requestId: string) => {
    if (!tenant) return;
    setActing(requestId);
    onError("");
    try {
      await apiFetch(`/tenants/join-requests/${requestId}/reject`, {
        method: "POST",
        tenant,
        body: JSON.stringify({}),
      });
      onMessage("Join request rejected");
      load();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Failed to reject request");
    } finally {
      setActing(null);
    }
  };

  const changeRole = async (userId: string, role: string) => {
    if (!tenant) return;
    setActing(userId);
    onError("");
    try {
      await apiFetch(`/tenants/members/${userId}/role`, {
        method: "PATCH",
        tenant,
        body: JSON.stringify({ role }),
      });
      onMessage("Member role updated");
      load();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Failed to update role");
    } finally {
      setActing(null);
    }
  };

  if (loading) return <LoadingState />;

  return (
    <Stack gap={6}>
      {org && (
        <Box bg="white" borderRadius="md" p={4}>
          <Text fontWeight="semibold" mb={2}>
            Organization join code
          </Text>
          <Text fontSize="sm" color="fg.muted" mb={3}>
            Share this code with staff so they can request to join your organization.
          </Text>
          <Flex gap={2} align="center">
            <Text fontFamily="mono" fontSize="lg">
              {org.joinCode}
            </Text>
            <Button size="sm" variant="outline" onClick={copyJoinCode}>
              Copy
            </Button>
          </Flex>
        </Box>
      )}

      <Box bg="white" borderRadius="md" p={4}>
        <Text fontWeight="semibold" mb={3}>
          Pending join requests
        </Text>
        {joinRequests.length === 0 ? (
          <EmptyState message="No pending join requests." />
        ) : (
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
                    <AppSelect
                      items={ROLE_OPTIONS}
                      value={approveRoles[req.id] ?? Role.FRONT_DESK}
                      onValueChange={(v) =>
                        setApproveRoles((prev) => ({ ...prev, [req.id]: v }))
                      }
                      width="160px"
                      aria-label="Assign role"
                    />
                  </Table.Cell>
                  <Table.Cell>
                    <Flex gap={2}>
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
                        onClick={() => reject(req.id)}
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
        )}
      </Box>

      <Box bg="white" borderRadius="md" p={4}>
        <Text fontWeight="semibold" mb={3}>
          Team members
        </Text>
        <Table.Root size="sm">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader>User</Table.ColumnHeader>
              <Table.ColumnHeader>Role</Table.ColumnHeader>
              <Table.ColumnHeader>ID</Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {members.map((m) => (
              <Table.Row key={m.id}>
                <Table.Cell>
                  <Text fontSize="sm">{m.user.name ?? m.user.email}</Text>
                  <Text fontSize="xs" color="fg.muted">
                    {m.user.email}
                  </Text>
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
                <Table.Cell fontFamily="mono" fontSize="xs">
                  {shortId(m.user.id)}
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
        {members.length === 0 && <EmptyState message="No members found." />}
      </Box>
    </Stack>
  );
}
