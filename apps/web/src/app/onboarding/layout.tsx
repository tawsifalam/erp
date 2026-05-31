"use client";

import { Box, Flex, Text } from "@chakra-ui/react";
import { useUser } from "@propelauth/nextjs/client";
import { signOut } from "@/lib/auth";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const { user } = useUser();

  return (
    <Flex minH="100vh" bg="gray.50" direction="column">
      <Flex
        as="header"
        px={6}
        py={4}
        bg="white"
        borderBottomWidth="1px"
        borderColor="gray.200"
        align="center"
        justify="space-between"
      >
        <Text fontWeight="bold" fontSize="lg" color="blue.700">
          One Venue
        </Text>
        <Flex align="center" gap={3}>
          {user?.email && (
            <Text fontSize="sm" color="fg.muted">
              {user.email}
            </Text>
          )}
          <Box
            as="button"
            fontSize="sm"
            color="blue.600"
            onClick={() => signOut()}
            _hover={{ textDecoration: "underline" }}
          >
            Sign out
          </Box>
        </Flex>
      </Flex>
      <Box flex="1" display="flex" alignItems="center" justifyContent="center" p={6}>
        {children}
      </Box>
    </Flex>
  );
}
