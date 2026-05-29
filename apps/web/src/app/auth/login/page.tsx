"use client";

import { Box, Button, Heading, Text, Stack } from "@chakra-ui/react";
import { signIn } from "@/lib/auth";

export default function LoginPage() {
  return (
    <Box minH="100vh" display="flex" alignItems="center" justifyContent="center">
      <Stack gap={4} p={8} textAlign="center">
        <Heading size="lg">Sign in</Heading>
        <Text color="fg.muted">Use your PropelAuth account</Text>
        <Button colorPalette="blue" onClick={() => signIn()}>
          Sign in with PropelAuth
        </Button>
      </Stack>
    </Box>
  );
}
