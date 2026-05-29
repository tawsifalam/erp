"use client";

import { Box, Flex, Link, Text, Button, NativeSelect } from "@chakra-ui/react";
import NextLink from "next/link";
import { useTenant } from "@/lib/tenant-context";
import { signOut } from "@/lib/auth";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/pms", label: "PMS" },
  { href: "/pos", label: "POS" },
  { href: "/pos/kitchen", label: "Kitchen" },
  { href: "/inventory", label: "Inventory" },
  { href: "/accounting", label: "Accounting" },
  { href: "/hr", label: "HR" },
  { href: "/reports", label: "Reports" },
];

export function DashboardShell({
  children,
  title,
}: {
  children: React.ReactNode;
  title?: string;
}) {
  const tenant = useTenant();
  const currentOrg = tenant.memberships.find((m) => m.organizationId === tenant.organizationId);

  return (
    <Flex minH="100vh">
      <Box as="nav" w="220px" p={4}>
        <Text fontWeight="bold" mb={4}>
          Hospitality ERP
        </Text>
        {NAV.map((item) => (
          <Link key={item.href} asChild display="block" py={2} _hover={{ opacity: 0.8 }}>
            <NextLink href={item.href}>{item.label}</NextLink>
          </Link>
        ))}
        <Button mt={8} size="sm" variant="outline" onClick={() => signOut()}>
          Sign out
        </Button>
      </Box>
      <Box flex="1" p={6} bg="gray.50">
        <Flex mb={4} gap={4} align="center" wrap="wrap">
          {title && (
            <Text fontSize="xl" fontWeight="semibold" flex="1">
              {title}
            </Text>
          )}
          <NativeSelect.Root size="sm" w="200px">
            <NativeSelect.Field
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
          <NativeSelect.Root size="sm" w="180px">
            <NativeSelect.Field
              value={tenant.branchId ?? ""}
              onChange={(e) => tenant.setBranchId(e.target.value)}
            >
              {currentOrg?.organization.branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </NativeSelect.Field>
          </NativeSelect.Root>
        </Flex>
        {children}
      </Box>
    </Flex>
  );
}
