"use client";

import { Box, Button, Heading, Stack, Text } from "@chakra-ui/react";
import { signIn, signUp } from "@/lib/auth";

export function AuthLoginCard() {
  return (
    <Box
      w="full"
      maxW="420px"
      bg="white"
      borderWidth="1px"
      borderColor="gray.200"
      borderRadius="xl"
      shadow="lg"
      p={{ base: 6, md: 8 }}
    >
      <Stack gap={6} textAlign="center">
        <Stack gap={2}>
          <Box
            mx="auto"
            w="12"
            h="12"
            borderRadius="lg"
            bg="blue.700"
            color="white"
            display="flex"
            alignItems="center"
            justifyContent="center"
            fontWeight="bold"
            fontSize="lg"
            letterSpacing="tight"
          >
            OV
          </Box>
          <Heading size="lg">Welcome</Heading>
          <Text color="fg.muted" fontSize="sm">
            Sign in or create an account to access your organization dashboard.
          </Text>
        </Stack>

        <Stack gap={3}>
          <Button size="lg" colorPalette="blue" w="full" onClick={() => signIn()}>
            Sign in
          </Button>
          <Button size="lg" variant="outline" w="full" onClick={() => signUp()}>
            Create account
          </Button>
        </Stack>

        <Text fontSize="xs" color="fg.muted" lineHeight="tall">
          Secure authentication for your team. By continuing, you agree to use One Venue
          for your organization&apos;s operations.
        </Text>
      </Stack>
    </Box>
  );
}
