"use client";

import { useCallback, useEffect, useState } from "react";
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
import { DashboardShell } from "@/components/dashboard-shell";
import { PageHeader, EmptyState, LoadingState } from "@erp/ui";
import { apiFetch } from "@/lib/api-client";
import { useTenant } from "@/lib/tenant-context";
import type { TenantHeaders } from "@/lib/api-client";
import { shortId } from "@/lib/format";
import { InventoryPoolsSection } from "./inventory-pools-section";
import { TeamAccessSection } from "./team-access-section";

type Branch = {
  id: string;
  name: string;
  timezone: string;
  createdAt?: string;
};

type OrganizationDetail = {
  id: string;
  name: string;
  propelAuthOrgId: string;
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
  const [tab, setTab] = useState("organization");
  const [org, setOrg] = useState<OrganizationDetail | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgName, setOrgName] = useState("");
  const [branchForm, setBranchForm] = useState({ name: "", timezone: "Asia/Dhaka" });
  const [newOrgForm, setNewOrgForm] = useState({ name: "", timezone: "Asia/Dhaka" });
  const [showBranchForm, setShowBranchForm] = useState(false);
  const [showNewOrgForm, setShowNewOrgForm] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = canManageTenants(tenant.role);
  const tenantHeaders = tenantHeadersFor(tenant.organizationId, tenant.branchId);

  const load = useCallback(async () => {
    if (!tenantHeaders || !isAdmin) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [orgData, branchData] = await Promise.all([
        apiFetch<OrganizationDetail>("/tenants/organizations/current", { tenant: tenantHeaders }),
        apiFetch<Branch[]>("/tenants/branches", { tenant: tenantHeaders }),
      ]);
      setOrg(orgData);
      setOrgName(orgData.name);
      setBranches(branchData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, [tenant.organizationId, tenant.branchId, isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  const saveOrgName = async () => {
    if (!tenantHeaders) return;
    setError(null);
    try {
      await apiFetch("/tenants/organizations/current", {
        method: "PATCH",
        tenant: tenantHeaders,
        body: JSON.stringify({ name: orgName }),
      });
      setMessage("Organization updated");
      await tenant.refreshMemberships();
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update organization");
    }
  };

  const addBranch = async () => {
    if (!tenantHeaders) return;
    setError(null);
    try {
      await apiFetch("/tenants/branches", {
        method: "POST",
        tenant: tenantHeaders,
        body: JSON.stringify(branchForm),
      });
      setBranchForm({ name: "", timezone: "Asia/Dhaka" });
      setShowBranchForm(false);
      setMessage("Branch created");
      await tenant.refreshMemberships();
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create branch");
    }
  };

  const updateBranch = async (id: string, data: { name: string; timezone: string }) => {
    if (!tenantHeaders) return;
    setError(null);
    try {
      await apiFetch(`/tenants/branches/${id}`, {
        method: "PATCH",
        tenant: tenantHeaders,
        body: JSON.stringify(data),
      });
      setMessage("Branch updated");
      await tenant.refreshMemberships();
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update branch");
    }
  };

  const createOrganization = async () => {
    setError(null);
    try {
      const name = newOrgForm.name;
      const result = await apiFetch<{
        organization: { id: string; branches: { id: string }[] };
      }>("/tenants/organizations", {
        method: "POST",
        body: JSON.stringify(newOrgForm),
      });
      setShowNewOrgForm(false);
      setNewOrgForm({ name: "", timezone: "Asia/Dhaka" });
      setMessage(`Organization "${name}" created`);
      await tenant.refreshMemberships();
      if (result?.organization?.id) {
        tenant.setOrganizationId(result.organization.id);
        if (result.organization.branches[0]) {
          tenant.setBranchId(result.organization.branches[0].id);
        }
      }
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create organization");
    }
  };

  return (
    <DashboardShell title="Settings">
      <PageHeader
        title="Settings"
        description="Organization, branches, and inventory pool configuration"
      />

      {error && (
        <Text color="red.500" mb={3} fontSize="sm">
          {error}
        </Text>
      )}

      {!isAdmin && (
        <Box bg="orange.50" borderRadius="md" p={4} mb={4}>
          <Text fontSize="sm">
            Tenant management requires OWNER or ADMIN role. You can still switch organization and
            branch using the header selectors.
          </Text>
        </Box>
      )}

      {isAdmin && (
        <Tabs.Root value={tab} onValueChange={(e) => setTab(e.value)}>
          <Tabs.List mb={4}>
            <Tabs.Trigger value="organization">Organization & branches</Tabs.Trigger>
            <Tabs.Trigger value="team">Team & access</Tabs.Trigger>
            <Tabs.Trigger value="pools">Inventory pools</Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content value="organization" pt={2}>
            <Flex gap={2} mb={4}>
              <Button size="sm" variant="outline" onClick={() => setShowNewOrgForm(!showNewOrgForm)}>
                {showNewOrgForm ? "Cancel" : "+ New organization"}
              </Button>
              <Button size="sm" onClick={load}>
                Refresh
              </Button>
            </Flex>

            {showNewOrgForm && (
              <Box bg="white" borderRadius="md" p={4} mb={4}>
                <Text fontWeight="semibold" mb={3}>
                  Create organization
                </Text>
                <Text fontSize="sm" color="fg.muted" mb={3}>
                  Creates a new organization, default &quot;Main Branch&quot;, guest/staff inventory
                  pools, and assigns you as OWNER.
                </Text>
                <Flex gap={2} wrap="wrap" mb={3}>
                  <Input
                    size="sm"
                    w="220px"
                    placeholder="Organization name"
                    value={newOrgForm.name}
                    onChange={(e) => setNewOrgForm({ ...newOrgForm, name: e.target.value })}
                  />
                  <Input
                    size="sm"
                    w="180px"
                    placeholder="Timezone (IANA)"
                    value={newOrgForm.timezone}
                    onChange={(e) => setNewOrgForm({ ...newOrgForm, timezone: e.target.value })}
                  />
                </Flex>
                <Button size="sm" colorPalette="blue" onClick={createOrganization}>
                  Create organization
                </Button>
              </Box>
            )}

            {loading && <LoadingState />}
            {!loading && org && (
              <Box bg="white" borderRadius="md" p={4} mb={6}>
                <Text fontWeight="semibold" mb={2}>
                  Current organization
                </Text>
                <Text fontSize="xs" color="fg.muted" fontFamily="mono" mb={3}>
                  ID: {org.id} · PropelAuth: {shortId(org.propelAuthOrgId, 12)}
                </Text>
                <Flex gap={2} align="center" mb={2}>
                  <Input
                    size="sm"
                    maxW="320px"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                  />
                  <Button size="sm" colorPalette="green" onClick={saveOrgName}>
                    Save name
                  </Button>
                </Flex>
              </Box>
            )}

            <Flex justify="space-between" align="center" mb={3}>
              <Text fontWeight="semibold">Branches</Text>
              <Button size="sm" colorPalette="blue" onClick={() => setShowBranchForm(!showBranchForm)}>
                {showBranchForm ? "Cancel" : "+ Add branch"}
              </Button>
            </Flex>

            {showBranchForm && (
              <Box bg="white" borderRadius="md" p={4} mb={4}>
                <Stack gap={3}>
                  <Flex gap={2} wrap="wrap">
                    <Input
                      size="sm"
                      w="200px"
                      placeholder="Branch name"
                      value={branchForm.name}
                      onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })}
                    />
                    <Input
                      size="sm"
                      w="180px"
                      placeholder="Timezone"
                      value={branchForm.timezone}
                      onChange={(e) => setBranchForm({ ...branchForm, timezone: e.target.value })}
                    />
                  </Flex>
                  <Button size="sm" colorPalette="green" w="fit-content" onClick={addBranch}>
                    Create branch
                  </Button>
                </Stack>
              </Box>
            )}

            <Box bg="white" borderRadius="md" p={4}>
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
                    <BranchRow key={b.id} branch={b} onSave={updateBranch} />
                  ))}
                </Table.Body>
              </Table.Root>
              {branches.length === 0 && !loading && (
                <EmptyState message="No branches yet. Add one to use PMS, POS, and inventory." />
              )}
            </Box>
          </Tabs.Content>

          <Tabs.Content value="team" pt={2}>
            <TeamAccessSection
              tenant={tenantHeaders}
              onMessage={setMessage}
              onError={setError}
            />
          </Tabs.Content>

          <Tabs.Content value="pools" pt={2}>
            <InventoryPoolsSection
              tenant={tenantHeaders}
              onMessage={setMessage}
              onError={setError}
            />
          </Tabs.Content>
        </Tabs.Root>
      )}

      {message && (
        <Text mt={4} fontSize="sm" color="green.600">
          {message}
        </Text>
      )}
    </DashboardShell>
  );
}

function BranchRow({
  branch,
  onSave,
}: {
  branch: Branch;
  onSave: (id: string, data: { name: string; timezone: string }) => void;
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
        <Button size="xs" variant="outline" onClick={() => onSave(branch.id, { name, timezone })}>
          Save
        </Button>
      </Table.Cell>
    </Table.Row>
  );
}
