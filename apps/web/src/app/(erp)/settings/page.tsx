"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Flex,
  Input,
  Stack,
  Table,
  Tabs,
  Text,
} from "@chakra-ui/react";
import { FormDrawer } from "@/components/form-drawer";
import { DashboardShell } from "@/components/dashboard-shell";
import { ModulePageHeader } from "@/components/module-page-header";
import { ContextBanner, ContentCard, EmptyState, FormField, TableSkeleton, TableScrollArea } from "@erp/ui";
import { ScrollableTabsList } from "@/components/scrollable-tabs-list";
import { apiFetch } from "@/lib/api-client";
import { useTenant } from "@/lib/tenant-context";
import type { TenantHeaders } from "@/lib/api-client";
import { shortId } from "@/lib/format";
import { appToast } from "@/lib/app-toast";
import { useConfirmDialog } from "@/lib/use-confirm-dialog";
import { useModuleTab } from "@/lib/use-module-tab";
import { InventoryPoolsSection } from "./inventory-pools-section";
import { TeamAccessSection } from "./team-access-section";
import { AuditLogSection } from "./audit-log-section";
import { NotificationPreferencesSection } from "./notification-preferences-section";
import { BranchAccessSection } from "./branch-access-section";
import { IntegrationsSection } from "./integrations-section";

const ADMIN_TABS = new Set([
  "organization",
  "team",
  "audit",
  "pools",
  "branch-access",
  "integrations",
]);

type Branch = {
  id: string;
  name: string;
  timezone: string;
  createdAt?: string;
};

type OrganizationDetail = {
  id: string;
  name: string;
  joinCode?: string;
  branches: Branch[];
};

function canManageTenants(role: string | null): boolean {
  return role === "OWNER" || role === "ADMIN";
}

function tenantHeadersFor(orgId: string | null, branchId: string | null): TenantHeaders | undefined {
  if (!orgId) return undefined;
  return { organizationId: orgId, branchId: branchId ?? undefined };
}

export default function SettingsPage() {
  const tenant = useTenant();
  const { ask, dialog } = useConfirmDialog();
  const isAdmin = canManageTenants(tenant.role);
  const [tab, setTab] = useModuleTab(isAdmin ? "organization" : "notifications");
  const [org, setOrg] = useState<OrganizationDetail | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgName, setOrgName] = useState("");
  const [branchForm, setBranchForm] = useState({ name: "", timezone: "Asia/Dhaka" });
  const [newOrgForm, setNewOrgForm] = useState({ name: "", timezone: "Asia/Dhaka" });
  const [branchDrawerOpen, setBranchDrawerOpen] = useState(false);
  const [newOrgDrawerOpen, setNewOrgDrawerOpen] = useState(false);

  const tenantHeaders = useMemo(
    () => tenantHeadersFor(tenant.organizationId, tenant.branchId),
    [tenant.organizationId, tenant.branchId],
  );

  const load = useCallback(async () => {
    if (!tenantHeaders || !isAdmin) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [orgData, branchData] = await Promise.all([
        apiFetch<OrganizationDetail>("/tenants/organizations/current", { tenant: tenantHeaders }),
        apiFetch<Branch[]>("/tenants/branches", { tenant: tenantHeaders }),
      ]);
      setOrg(orgData);
      setOrgName(orgData.name);
      setBranches(branchData);
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, [tenant.organizationId, tenant.branchId, isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!isAdmin && ADMIN_TABS.has(tab)) {
      setTab("notifications");
    }
  }, [isAdmin, tab, setTab]);

  const saveOrgName = async () => {
    if (!tenantHeaders) return;
    try {
      await apiFetch("/tenants/organizations/current", {
        method: "PATCH",
        tenant: tenantHeaders,
        body: JSON.stringify({ name: orgName }),
      });
      appToast.success("Organization updated");
      await tenant.refreshMemberships();
      load();
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to update organization");
    }
  };

  const addBranch = async () => {
    if (!tenantHeaders) return;
    try {
      await apiFetch("/tenants/branches", {
        method: "POST",
        tenant: tenantHeaders,
        body: JSON.stringify(branchForm),
      });
      setBranchForm({ name: "", timezone: "Asia/Dhaka" });
      setBranchDrawerOpen(false);
      appToast.success("Branch created");
      await tenant.refreshMemberships();
      load();
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to create branch");
    }
  };

  const updateBranch = async (id: string, data: { name: string; timezone: string }) => {
    if (!tenantHeaders) return;
    try {
      await apiFetch(`/tenants/branches/${id}`, {
        method: "PATCH",
        tenant: tenantHeaders,
        body: JSON.stringify(data),
      });
      appToast.success("Branch updated");
      await tenant.refreshMemberships();
      load();
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to update branch");
    }
  };

  const deleteBranch = async (id: string) => {
    if (!tenantHeaders) return;
    try {
      await apiFetch(`/tenants/branches/${id}`, {
        method: "DELETE",
        tenant: tenantHeaders,
      });
      appToast.success("Branch deleted");
      await tenant.refreshMemberships();
      load();
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to delete branch");
    }
  };

  const confirmDeleteBranch = (branch: Branch) => {
    ask({
      title: `Delete branch "${branch.name}"?`,
      description:
        "All rooms, reservations, POS menu and orders, inventory, and HR meal data for this branch will be permanently removed. Branches with active reservations (inquiry, confirmed, or checked in) cannot be deleted.",
      confirmLabel: "Delete branch",
      onConfirm: () => deleteBranch(branch.id),
    });
  };

  const createOrganization = async () => {
    try {
      const name = newOrgForm.name;
      const result = await apiFetch<{
        organization: { id: string; branches: { id: string }[] };
      }>("/tenants/organizations", {
        method: "POST",
        body: JSON.stringify(newOrgForm),
      });
      setNewOrgDrawerOpen(false);
      setNewOrgForm({ name: "", timezone: "Asia/Dhaka" });
      appToast.success(`Organization "${name}" created`);
      const newOrgId = result?.organization?.id;
      const newBranchId = result?.organization?.branches[0]?.id ?? null;
      if (newOrgId) {
        await tenant.refreshMemberships({
          organizationId: newOrgId,
          branchId: newBranchId,
        });
      } else {
        await tenant.refreshMemberships();
      }
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to create organization");
    }
  };

  return (
    <DashboardShell>
      {dialog}
      <ModulePageHeader />

      {!isAdmin && tab !== "notifications" && (
        <ContextBanner status="info" title="View-only access">
          Tenant management requires Owner or Admin role. You can still switch organization and
          branch using the selectors in the header.
        </ContextBanner>
      )}

      <Tabs.Root value={tab} onValueChange={(e) => setTab(e.value)}>
        <ScrollableTabsList>
          <Tabs.List mb={4}>
            {isAdmin && (
              <>
                <Tabs.Trigger value="organization">Organization & branches</Tabs.Trigger>
                <Tabs.Trigger value="team">Team & access</Tabs.Trigger>
                <Tabs.Trigger value="audit">Audit log</Tabs.Trigger>
                <Tabs.Trigger value="pools">Inventory pools</Tabs.Trigger>
                <Tabs.Trigger value="branch-access">Branch access</Tabs.Trigger>
                <Tabs.Trigger value="integrations">Integrations</Tabs.Trigger>
              </>
            )}
            <Tabs.Trigger value="notifications">Notifications</Tabs.Trigger>
          </Tabs.List>
        </ScrollableTabsList>

        {isAdmin && (
          <>
          <Tabs.Content value="organization" pt={2}>
            <Flex gap={2} mb={4} wrap="wrap">
              <Button
                size="sm"
                variant="outline"
                w={{ base: "full", sm: "auto" }}
                onClick={() => setNewOrgDrawerOpen(true)}
              >
                + New organization
              </Button>
              <Button size="sm" onClick={load}>
                Refresh
              </Button>
            </Flex>

            {loading && !org && <TableSkeleton rows={3} columns={2} />}
            {org && (
              <ContentCard mb={6}>
                <Text fontWeight="semibold" mb={2}>
                  Current organization
                </Text>
                <Text fontSize="xs" color="fg.muted" fontFamily="mono" mb={3}>
                  ID: {org.id}
                  {org.joinCode ? ` · Join code: ${org.joinCode}` : null}
                </Text>
                <Flex gap={2} align="flex-end" mb={2}>
                  <FormField label="Organization name">
                    <Input
                      size="sm"
                      maxW="320px"
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                    />
                  </FormField>
                  <Button size="sm" colorPalette="green" onClick={saveOrgName}>
                    Save name
                  </Button>
                </Flex>
              </ContentCard>
            )}

            <Flex justify="space-between" align="center" mb={3}>
              <Text fontWeight="semibold">Branches</Text>
              <Button
                size="sm"
                colorPalette="blue"
                w={{ base: "full", sm: "auto" }}
                onClick={() => setBranchDrawerOpen(true)}
              >
                + Add branch
              </Button>
            </Flex>

            <ContentCard>
              {loading ? (
                <TableSkeleton rows={4} columns={4} />
              ) : (
                <>
                  <TableScrollArea>
                    <Table.Root size="sm">
                      <Table.Header>
                        <Table.Row>
                          <Table.ColumnHeader>Name</Table.ColumnHeader>
                          <Table.ColumnHeader>Timezone</Table.ColumnHeader>
                          <Table.ColumnHeader>ID</Table.ColumnHeader>
                          <Table.ColumnHeader>Actions</Table.ColumnHeader>
                        </Table.Row>
                      </Table.Header>
                      <Table.Body>
                        {branches.map((b) => (
                          <BranchRow
                            key={b.id}
                            branch={b}
                            canDelete={branches.length > 1}
                            onSave={updateBranch}
                            onDelete={() => confirmDeleteBranch(b)}
                          />
                        ))}
                      </Table.Body>
                    </Table.Root>
                  </TableScrollArea>
                  {branches.length === 0 && (
                    <EmptyState
                      title="No branches yet"
                      description="Add at least one branch to run PMS, POS, inventory, and branch-scoped reports."
                      icon="📍"
                    />
                  )}
                </>
              )}
            </ContentCard>
          </Tabs.Content>

          <Tabs.Content value="team" pt={2}>
            <TeamAccessSection tenant={tenantHeaders} />
          </Tabs.Content>

          <Tabs.Content value="audit" pt={2}>
            <AuditLogSection tenant={tenantHeaders} />
          </Tabs.Content>

          <Tabs.Content value="pools" pt={2}>
            <InventoryPoolsSection tenant={tenantHeaders} />
          </Tabs.Content>
          <Tabs.Content value="branch-access" pt={2}>
            <BranchAccessSection tenant={tenantHeaders} />
          </Tabs.Content>
          <Tabs.Content value="integrations" pt={2}>
            <IntegrationsSection tenant={tenantHeaders} />
          </Tabs.Content>
          </>
        )}

        <Tabs.Content value="notifications" pt={2}>
          <NotificationPreferencesSection tenant={tenantHeaders} />
        </Tabs.Content>
      </Tabs.Root>

      <FormDrawer
        open={newOrgDrawerOpen}
        onClose={() => {
          setNewOrgDrawerOpen(false);
          setNewOrgForm({ name: "", timezone: "Asia/Dhaka" });
        }}
        title="Create organization"
        description='Creates a new organization, default "Main Branch", inventory pools, and assigns you as OWNER.'
        size="sm"
        primaryLabel="Create organization"
        onPrimary={createOrganization}
        primaryDisabled={!newOrgForm.name.trim()}
      >
        <Stack gap={4} width="100%">
          <FormField label="Organization name" required>
            <Input
              size="sm"
              width="100%"
              placeholder="Organization name"
              value={newOrgForm.name}
              onChange={(e) => setNewOrgForm({ ...newOrgForm, name: e.target.value })}
            />
          </FormField>
          <FormField label="Timezone" help="IANA timezone for the default branch.">
            <Input
              size="sm"
              width="100%"
              placeholder="Timezone (IANA)"
              value={newOrgForm.timezone}
              onChange={(e) => setNewOrgForm({ ...newOrgForm, timezone: e.target.value })}
            />
          </FormField>
        </Stack>
      </FormDrawer>

      <FormDrawer
        open={branchDrawerOpen}
        onClose={() => {
          setBranchDrawerOpen(false);
          setBranchForm({ name: "", timezone: "Asia/Dhaka" });
        }}
        title="Add branch"
        size="sm"
        primaryLabel="Create branch"
        onPrimary={addBranch}
        primaryDisabled={!branchForm.name.trim()}
      >
        <Stack gap={4} width="100%">
          <FormField label="Branch name" required>
            <Input
              size="sm"
              width="100%"
              placeholder="Branch name"
              value={branchForm.name}
              onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })}
            />
          </FormField>
          <FormField label="Timezone" help="IANA timezone for this branch.">
            <Input
              size="sm"
              width="100%"
              placeholder="Timezone"
              value={branchForm.timezone}
              onChange={(e) => setBranchForm({ ...branchForm, timezone: e.target.value })}
            />
          </FormField>
        </Stack>
      </FormDrawer>
    </DashboardShell>
  );
}

function BranchRow({
  branch,
  canDelete,
  onSave,
  onDelete,
}: {
  branch: Branch;
  canDelete: boolean;
  onSave: (id: string, data: { name: string; timezone: string }) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(branch.name);
  const [timezone, setTimezone] = useState(branch.timezone);

  useEffect(() => {
    setName(branch.name);
    setTimezone(branch.timezone);
  }, [branch.name, branch.timezone]);

  return (
    <Table.Row>
      <Table.Cell>
        <Input size="sm" value={name} onChange={(e) => setName(e.target.value)} />
      </Table.Cell>
      <Table.Cell>
        <Input size="sm" value={timezone} onChange={(e) => setTimezone(e.target.value)} />
      </Table.Cell>
      <Table.Cell fontFamily="mono" fontSize="xs">
        {shortId(branch.id)}
      </Table.Cell>
      <Table.Cell>
        <Flex gap={2}>
          <Button size="xs" variant="outline" onClick={() => onSave(branch.id, { name, timezone })}>
            Save
          </Button>
          <Button
            size="xs"
            variant="outline"
            colorPalette="red"
            disabled={!canDelete}
            title={canDelete ? undefined : "Cannot delete the only branch"}
            onClick={onDelete}
          >
            Delete
          </Button>
        </Flex>
      </Table.Cell>
    </Table.Row>
  );
}
