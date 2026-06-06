"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Flex, Table, Text } from "@chakra-ui/react";
import { AppSelect } from "@/components/app-select";
import { ContentCard, EmptyState, TableSkeleton, TableScrollArea } from "@erp/ui";
import { apiFetch } from "@/lib/api-client";
import { appToast } from "@/lib/app-toast";
import type { TenantHeaders } from "@/lib/api-client";
import { pickManagedBranchId } from "@/lib/tenant";

type BranchMember = {
  userId: string;
  role: string;
  implicitAccess: boolean;
  hasBranchAccess: boolean;
  user: { id: string; email: string; name: string | null };
};

type Branch = { id: string; name: string };

export function BranchAccessSection({ tenant }: { tenant: TenantHeaders | undefined }) {
  const organizationId = tenant?.organizationId;
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [members, setMembers] = useState<BranchMember[]>([]);
  const [acting, setActing] = useState<string | null>(null);
  const branchesRequestId = useRef(0);
  const membersRequestId = useRef(0);

  useEffect(() => {
    if (!tenant || !organizationId) {
      branchesRequestId.current += 1;
      membersRequestId.current += 1;
      setBranches([]);
      setBranchId("");
      setMembers([]);
      setLoading(false);
      return;
    }

    const requestId = ++branchesRequestId.current;
    membersRequestId.current += 1;
    setBranches([]);
    setBranchId("");
    setMembers([]);
    setLoading(true);

    apiFetch<Branch[]>("/tenants/branches", { tenant })
      .then((data) => {
        if (requestId !== branchesRequestId.current) return;
        setBranches(data);
        setBranchId(pickManagedBranchId("", data));
      })
      .catch((e) => {
        if (requestId !== branchesRequestId.current) return;
        appToast.error(e instanceof Error ? e.message : "Failed to load branches");
        setLoading(false);
      });
  }, [tenant, organizationId]);

  useEffect(() => {
    if (!tenant || !organizationId || !branchId) {
      membersRequestId.current += 1;
      setMembers([]);
      setLoading(false);
      return;
    }
    if (!branches.some((b) => b.id === branchId)) {
      setMembers([]);
      setLoading(false);
      return;
    }

    const requestId = ++membersRequestId.current;
    setLoading(true);

    apiFetch<BranchMember[]>(`/tenants/branches/${branchId}/members`, { tenant })
      .then((data) => {
        if (requestId !== membersRequestId.current) return;
        setMembers(data);
      })
      .catch((e) => {
        if (requestId !== membersRequestId.current) return;
        appToast.error(e instanceof Error ? e.message : "Failed to load branch members");
      })
      .finally(() => {
        if (requestId !== membersRequestId.current) return;
        setLoading(false);
      });
  }, [tenant, organizationId, branchId, branches]);

  const reloadMembers = useCallback(async () => {
    if (!tenant || !organizationId || !branchId) return;
    if (!branches.some((b) => b.id === branchId)) return;

    const requestId = ++membersRequestId.current;
    setLoading(true);
    try {
      const data = await apiFetch<BranchMember[]>(
        `/tenants/branches/${branchId}/members`,
        { tenant },
      );
      if (requestId !== membersRequestId.current) return;
      setMembers(data);
    } catch (e) {
      if (requestId !== membersRequestId.current) return;
      appToast.error(e instanceof Error ? e.message : "Failed to load branch members");
    } finally {
      if (requestId === membersRequestId.current) {
        setLoading(false);
      }
    }
  }, [tenant, organizationId, branchId, branches]);

  const toggleAccess = async (member: BranchMember, grant: boolean) => {
    if (!tenant || !branchId || member.implicitAccess) return;
    setActing(member.userId);
    try {
      if (grant) {
        await apiFetch(`/tenants/branches/${branchId}/members`, {
          method: "POST",
          tenant,
          body: JSON.stringify({ userId: member.userId }),
        });
        appToast.success("Branch access granted");
      } else {
        await apiFetch(`/tenants/branches/${branchId}/members/${member.userId}`, {
          method: "DELETE",
          tenant,
        });
        appToast.success("Branch access revoked");
      }
      await reloadMembers();
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to update branch access");
    } finally {
      setActing(null);
    }
  };

  return (
    <div>
      <Text fontSize="sm" color="fg.muted" mb={4}>
        Grant org members access to specific branches. Owners and admins always see all branches.
        Other roles only see approved branches in the header selector.
      </Text>

      <Flex gap={3} mb={4} wrap="wrap" align="flex-end">
        <AppSelect
          items={branches.map((b) => ({ value: b.id, label: b.name }))}
          value={branchId}
          onValueChange={setBranchId}
          width="260px"
          placeholder="Select branch"
          aria-label="Branch for access management"
        />
        <Button size="sm" variant="outline" onClick={reloadMembers} disabled={!branchId}>
          Refresh
        </Button>
      </Flex>

      <ContentCard>
        {loading ? (
          <TableSkeleton rows={4} columns={4} />
        ) : members.length === 0 ? (
          <EmptyState
            title="No members"
            description="Add team members under Team & access, then grant branch access here."
          />
        ) : (
          <TableScrollArea>
            <Table.Root size="sm">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeader>Member</Table.ColumnHeader>
                  <Table.ColumnHeader>Org role</Table.ColumnHeader>
                  <Table.ColumnHeader>Branch access</Table.ColumnHeader>
                  <Table.ColumnHeader>Actions</Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {members.map((m) => (
                  <Table.Row key={m.userId}>
                    <Table.Cell>
                      <Text fontWeight="medium">{m.user.email}</Text>
                      {m.user.name && (
                        <Text fontSize="xs" color="fg.muted">
                          {m.user.name}
                        </Text>
                      )}
                    </Table.Cell>
                    <Table.Cell>{m.role.replace(/_/g, " ")}</Table.Cell>
                    <Table.Cell>
                      {m.implicitAccess
                        ? "All branches (admin)"
                        : m.hasBranchAccess
                          ? "Granted"
                          : "No access"}
                    </Table.Cell>
                    <Table.Cell>
                      {m.implicitAccess ? (
                        <Text fontSize="xs" color="fg.muted">
                          —
                        </Text>
                      ) : m.hasBranchAccess ? (
                        <Button
                          size="xs"
                          variant="outline"
                          colorPalette="red"
                          disabled={acting === m.userId}
                          onClick={() => toggleAccess(m, false)}
                        >
                          Revoke
                        </Button>
                      ) : (
                        <Button
                          size="xs"
                          variant="outline"
                          colorPalette="green"
                          disabled={acting === m.userId}
                          onClick={() => toggleAccess(m, true)}
                        >
                          Grant
                        </Button>
                      )}
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </TableScrollArea>
        )}
      </ContentCard>
    </div>
  );
}
