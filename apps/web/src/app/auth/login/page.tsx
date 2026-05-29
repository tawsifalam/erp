"use client";

import { Box, Button, Heading, Text, Stack } from "@chakra-ui/react";
import { signIn, signUp } from "@/lib/auth";

export default function LoginPage() {
  return (
    <Box minH="100vh" display="flex" alignItems="center" justifyContent="center">
      <Stack gap={4} p={8} textAlign="center">
        <Heading size="lg">Welcome</Heading>
        <Text color="fg.muted">Sign in or create an account to continue</Text>
        <Button colorPalette="blue" onClick={() => signIn()}>
          Sign in
        </Button>
        <Button variant="outline" onClick={() => signUp()}>
          Create account
        </Button>
      </Stack>
    </Box>
  );
}
