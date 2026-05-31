"use client";

import NextLink from "next/link";
import { Box, SimpleGrid, Text } from "@chakra-ui/react";
import { ContentCard } from "@erp/ui";
import { filterNavGroups, filterNavLinks, TOP_NAV, type NavLinkItem } from "./nav-config";
import type { Role } from "@erp/types";

function QuickLinkCard({ item }: { item: NavLinkItem }) {
  const Icon = item.icon;

  return (
    <Box
      asChild
      display="block"
      p={4}
      borderWidth="1px"
      borderColor="gray.200"
      borderRadius="md"
      bg="gray.50"
      transition="border-color 0.15s, background 0.15s"
      _hover={{ borderColor: "blue.300", bg: "blue.50" }}
    >
      <NextLink href={item.href}>
        <Box display="flex" alignItems="center" gap={3}>
          <Box color="blue.600">
            <Icon aria-hidden boxSize={5} />
          </Box>
          <Text fontSize="sm" fontWeight="medium">
            {item.label}
          </Text>
        </Box>
      </NextLink>
    </Box>
  );
}

export function DashboardQuickLinks({ role }: { role: Role | string | null }) {
  const links: NavLinkItem[] = [
    ...filterNavLinks(role, TOP_NAV),
    ...filterNavGroups(role).flatMap((g) => g.items),
  ].filter((item) => item.href !== "/dashboard");

  if (links.length === 0) return null;

  return (
    <ContentCard mt={6}>
      <Text fontWeight="semibold" mb={3}>
        Quick links
      </Text>
      <Text fontSize="sm" color="fg.muted" mb={4}>
        Jump to the modules you use most. Your sidebar shows everything available for your role.
      </Text>
      <SimpleGrid columns={{ base: 2, md: 3, lg: 4 }} gap={3}>
        {links.map((item) => (
          <QuickLinkCard key={item.href} item={item} />
        ))}
      </SimpleGrid>
    </ContentCard>
  );
}
