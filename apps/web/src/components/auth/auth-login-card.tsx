"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Box, Button, Heading, Input, Stack, Text } from "@chakra-ui/react";
import { FormField } from "@erp/ui";
import { PasswordInput } from "@/components/auth/password-input";
import { useAuth } from "@/lib/auth-context";
import { appToast } from "@/lib/app-toast";
import Link from "next/link";

export function AuthLoginCard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login(email, password);
      const returnTo = searchParams.get("return_to");
      router.replace(returnTo?.startsWith("/") ? returnTo : "/");
    } catch (err) {
      appToast.error(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

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
      <Stack gap={6} as="form" onSubmit={handleSubmit} data-testid="auth-login-form">
        <Stack gap={2} textAlign="center">
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
          <Heading size="lg">Welcome back</Heading>
          <Text color="fg.muted" fontSize="sm">
            Sign in to access your organization dashboard.
          </Text>
        </Stack>

        <FormField label="Email">
          <Input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </FormField>

        <FormField label="Password">
          <PasswordInput
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </FormField>

        <Button
          type="submit"
          size="lg"
          colorPalette="blue"
          w="full"
          loading={submitting}
        >
          Sign in
        </Button>

        <Stack gap={2} textAlign="center" fontSize="sm">
          <Link href="/auth/forgot-password">Forgot password?</Link>
          <Text color="fg.muted">
            No account? <Link href="/auth/register">Create one</Link>
          </Text>
        </Stack>
      </Stack>
    </Box>
  );
}
