"use client";

import { Box, Flex } from "@chakra-ui/react";
import type { ReactNode } from "react";

export function AuthPageShell({ children }: { children: ReactNode }) {
  return (
    <Flex minH="100vh" direction={{ base: "column", lg: "row" }} bg="gray.50">
      {children}
    </Flex>
  );
}

export function AuthPanel({
  children,
  variant = "marketing",
}: {
  children: ReactNode;
  variant?: "marketing" | "form";
}) {
  if (variant === "marketing") {
    return (
      <Box
        position="relative"
        overflow="hidden"
        flex={{ lg: "1.1" }}
        bgGradient="to-br"
        gradientFrom="blue.700"
        gradientTo="blue.900"
        color="white"
        px={{ base: 6, md: 10, lg: 12 }}
        py={{ base: 10, lg: 12 }}
        display="flex"
        flexDirection="column"
        justifyContent="center"
      >
        <Box
          position="absolute"
          top="-20%"
          right="-10%"
          w="420px"
          h="420px"
          borderRadius="full"
          bg="whiteAlpha.100"
          pointerEvents="none"
        />
        <Box
          position="absolute"
          bottom="-15%"
          left="-5%"
          w="320px"
          h="320px"
          borderRadius="full"
          bg="whiteAlpha.50"
          pointerEvents="none"
        />
        <Box position="relative">{children}</Box>
      </Box>
    );
  }

  return (
    <Flex
      flex="1"
      align="center"
      justify="center"
      px={{ base: 4, md: 8 }}
      py={{ base: 8, lg: 12 }}
      display="flex"
    >
      {children}
    </Flex>
  );
}
