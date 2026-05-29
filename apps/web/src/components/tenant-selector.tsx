"use client";

import { Flex, NativeSelect, Text } from "@chakra-ui/react";
import { useTenant } from "@/lib/tenant-context";
import { getBranchesForOrg } from "@/lib/tenant";

export function TenantSelector() {
  const tenant = useTenant();
  const branches = tenant.organizationId
    ? getBranchesForOrg(tenant.memberships, tenant.organizationId)
    : [];

  if (tenant.loading) {
    return (
      <Text fontSize="sm" color="fg.muted" data-testid="tenant-loading">
        Loading organizations…
      </Text>
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
        <NativeSelect.Root size="sm" w="200px">
          <NativeSelect.Field
            data-testid="tenant-org-select"
            aria-label="Organization"
            value={tenant.organizationId ?? ""}
            onChange={(e) => tenant.setOrganizationId(e.target.value)}
          >
            {tenant.memberships.map((m) => (
              <option key={m.organizationId} value={m.organizationId}>
                {m.organization.name}
              </option>
            ))}
          </NativeSelect.Field>
        </NativeSelect.Root>
      </Flex>
      <Flex direction="column" gap={1}>
        <Text fontSize="xs" color="fg.muted">
          Branch
        </Text>
        <NativeSelect.Root size="sm" w="180px" disabled={branches.length === 0}>
          <NativeSelect.Field
            data-testid="tenant-branch-select"
            aria-label="Branch"
            value={tenant.branchId ?? ""}
            onChange={(e) => tenant.setBranchId(e.target.value)}
          >
            {branches.length === 0 ? (
              <option value="">No branches</option>
            ) : (
              branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))
            )}
          </NativeSelect.Field>
        </NativeSelect.Root>
      </Flex>
    </Flex>
  );
}
