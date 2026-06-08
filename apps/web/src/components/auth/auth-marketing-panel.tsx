"use client";

import { Box, Heading, Stack, Text } from "@chakra-ui/react";
const FEATURES = [
  {
    title: "Front office & PMS",
    description: "Reservations, rooms, and guest stays in one workflow.",
  },
  {
    title: "Operations",
    description: "POS, kitchen, inventory, and branch-level stock pools.",
  },
  {
    title: "Back office",
    description: "Accounting, HR, payroll, and exportable reports.",
  },
];

export function AuthMarketingPanel() {
  return (
    <>
      <Text
        fontSize="sm"
        fontWeight="semibold"
        letterSpacing="wider"
        textTransform="uppercase"
        color="blue.100"
        mb={3}
      >
        One Venue
      </Text>
      <Heading size={{ base: "xl", md: "2xl" }} lineHeight="shorter" mb={4} maxW="520px">
        Hospitality operations, unified
      </Heading>
      <Text fontSize={{ base: "md", md: "lg" }} color="blue.50" maxW="480px" mb={{ base: 8, lg: 10 }}>
        Run your property, teams, and finances from a single multi-tenant platform built
        for hotels, cafés, and venues.
      </Text>

      <Stack gap={4} maxW="440px" display={{ base: "none", md: "flex" }}>
        {FEATURES.map((feature) => (
          <Box key={feature.title} borderLeftWidth="3px" borderColor="blue.300" pl={4}>
            <Text fontWeight="semibold" fontSize="sm">
              {feature.title}
            </Text>
            <Text fontSize="sm" color="blue.100" mt={0.5}>
              {feature.description}
            </Text>
          </Box>
        ))}
      </Stack>

    </>
  );
}
