"use client";

import { Box, Flex } from "@chakra-ui/react";
import { AppSidebar } from "@/components/app-sidebar";
import { TenantGate } from "@/components/tenant-gate";
import { RouteGuard } from "@/components/route-guard";

export default function ErpLayout({ children }: { children: React.ReactNode }) {
  return (
    <TenantGate>
      <Flex minH="100vh" bg="gray.50" w="full">
        <AppSidebar />
        <Box flex="1" minW={0} display="flex" flexDirection="column">
          <RouteGuard>{children}</RouteGuard>
        </Box>
      </Flex>
    </TenantGate>
  );
}
