"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Box, Button, Heading, Input, Stack, Text } from "@chakra-ui/react";
import { FormField } from "@erp/ui";
import {
  PasswordWithConfirmFields,
  validatePasswordConfirmation,
} from "@/components/auth/password-input";
import { AuthPageShell, AuthPanel } from "@/components/auth/auth-page-shell";
import { useAuth } from "@/lib/auth-context";
import { appToast } from "@/lib/app-toast";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const passwordError = validatePasswordConfirmation(password, confirmPassword);
    if (passwordError) {
      appToast.error(passwordError);
      return;
    }
    setSubmitting(true);
    try {
      await register(email, password, name || undefined);
      router.replace("/");
    } catch (err) {
      appToast.error(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthPageShell>
      <AuthPanel variant="form">
        <Box w="full" maxW="420px" bg="white" borderWidth="1px" borderRadius="xl" shadow="lg" p={8}>
          <Stack gap={6} as="form" onSubmit={handleSubmit}>
            <Stack gap={2} textAlign="center">
              <Heading size="lg">Create account</Heading>
              <Text color="fg.muted" fontSize="sm">
                Register to set up or join an organization.
              </Text>
            </Stack>
            <FormField label="Name">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </FormField>
            <FormField label="Email">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </FormField>
            <PasswordWithConfirmFields
              password={password}
              confirmPassword={confirmPassword}
              onPasswordChange={setPassword}
              onConfirmPasswordChange={setConfirmPassword}
            />
            <Button type="submit" colorPalette="blue" w="full" loading={submitting}>
              Create account
            </Button>
            <Text textAlign="center" fontSize="sm">
              Already have an account? <Link href="/auth/login">Sign in</Link>
            </Text>
          </Stack>
        </Box>
      </AuthPanel>
    </AuthPageShell>
  );
}
