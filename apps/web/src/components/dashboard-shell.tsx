"use client";

import { usePathname } from "next/navigation";
import { Box, Flex, Text } from "@chakra-ui/react";
import { getModuleMeta } from "@/lib/module-meta";
import { TenantSelector } from "@/components/tenant-selector";
import { useTenant } from "@/lib/tenant-context";

export function DashboardShell({
  children,
  title,
}: {
  children: React.ReactNode;
  /** Override auto-detected module label in the header bar. */
  title?: string;
}) {
  const pathname = usePathname();
  const meta = getModuleMeta(pathname);
  const tenant = useTenant();
  const headerTitle = title ?? meta?.label ?? "One Venue";

  const orgName = tenant.memberships.find((m) => m.organizationId === tenant.organizationId)
    ?.organization.name;
  const branchName = tenant.memberships
    .flatMap((m) => m.organization.branches)
    .find((b) => b.id === tenant.branchId)?.name;

  return (
    <>
      <Flex
        px={6}
        py={4}
        gap={4}
        align="center"
        wrap="wrap"
        borderBottomWidth="1px"
        borderColor="gray.200"
        bg="white"
      >
        <Box flex="1" minW="200px">
          <Text fontSize="xl" fontWeight="semibold" lineHeight="short">
            {headerTitle}
          </Text>
          {(orgName || branchName) && (
            <Text fontSize="xs" color="fg.muted" mt={0.5}>
              {[orgName, branchName].filter(Boolean).join(" · ")}
            </Text>
          )}
        </Box>
        <TenantSelector />
      </Flex>
      <Box flex="1" p={6} overflow="auto">
        {children}
      </Box>
    </>
  );
}
