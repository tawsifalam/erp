"use client";

import { Box, Flex } from "@chakra-ui/react";
import { AppSidebar } from "@/components/app-sidebar";

export default function ErpLayout({ children }: { children: React.ReactNode }) {
  return (
    <Flex minH="100vh" bg="gray.50">
      <AppSidebar />
      <Box flex="1" minW={0} display="flex" flexDirection="column">
        {children}
      </Box>
    </Flex>
  );
}
