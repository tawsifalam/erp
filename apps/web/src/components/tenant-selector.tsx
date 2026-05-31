"use client";

import { Flex, Text } from "@chakra-ui/react";
import { SelectSkeleton } from "@erp/ui";
import { AppSelect } from "@/components/app-select";
import { useTenant } from "@/lib/tenant-context";
import { getBranchesForOrg } from "@/lib/tenant";
import { useMemo } from "react";

export function TenantSelector() {
  const tenant = useTenant();
  const branches = tenant.organizationId
    ? getBranchesForOrg(tenant.memberships, tenant.organizationId)
    : [];

  const orgItems = useMemo(
    () =>
      tenant.memberships.map((m) => ({
        value: m.organizationId,
        label: m.organization.name,
      })),
    [tenant.memberships],
  );

  const branchItems = useMemo(
    () =>
      branches.length === 0
        ? [{ value: "", label: "No branches" }]
        : branches.map((b) => ({ value: b.id, label: b.name })),
    [branches],
  );

  if (tenant.loading) {
    return (
      <Flex gap={3} align="center" wrap="wrap" data-testid="tenant-loading">
        <SelectSkeleton width="200px" />
        <SelectSkeleton width="180px" />
      </Flex>
    );
  }

  if (tenant.memberships.length === 0) {
    return (
      <Text fontSize="sm" color="fg.muted" data-testid="tenant-empty">
        No organizations available
      </Text>
    );
  }

  return (
    <Flex gap={3} align="center" wrap="wrap" data-testid="tenant-selector">
      <Flex direction="column" gap={1}>
        <Text fontSize="xs" color="fg.muted">
          Organization
        </Text>
        <AppSelect
          items={orgItems}
          value={tenant.organizationId ?? ""}
          onValueChange={tenant.setOrganizationId}
          aria-label="Organization"
          data-testid="tenant-org-select"
          width="200px"
        />
      </Flex>
      <Flex direction="column" gap={1}>
        <Text fontSize="xs" color="fg.muted">
          Branch
        </Text>
        <AppSelect
          items={branchItems}
          value={tenant.branchId ?? ""}
          onValueChange={tenant.setBranchId}
          aria-label="Branch"
          data-testid="tenant-branch-select"
          width="180px"
          disabled={branches.length === 0}
        />
        {branches.length > 0 && !tenant.branchId && (
          <Text fontSize="xs" color="orange.600">
            Select a branch to continue
          </Text>
        )}
      </Flex>
    </Flex>
  );
}
