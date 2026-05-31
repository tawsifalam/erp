"use client";

import { Box, Flex, Text } from "@chakra-ui/react";
import { TenantSelector } from "@/components/tenant-selector";

export function DashboardShell({
  children,
  title,
}: {
  children: React.ReactNode;
  title?: string;
}) {
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
        {title && (
          <Text fontSize="xl" fontWeight="semibold" flex="1">
            {title}
          </Text>
        )}
        <TenantSelector />
      </Flex>
      <Box flex="1" p={6} overflow="auto">
        {children}
      </Box>
    </>
  );
}
