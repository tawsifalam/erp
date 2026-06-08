"use client";

import { useState } from "react";
import { Box, Button, Heading, Input, Stack, Text } from "@chakra-ui/react";
import { FormField } from "@erp/ui";
import { AuthPageShell, AuthPanel } from "@/components/auth/auth-page-shell";
import { forgotPasswordApi } from "@/lib/auth-api";
import { appToast } from "@/lib/app-toast";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await forgotPasswordApi(email);
      setSent(true);
      appToast.success("If that email exists, we sent reset instructions.");
    } catch (err) {
      appToast.error(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthPageShell>
      <AuthPanel variant="form">
        <Box w="full" maxW="420px" bg="white" borderWidth="1px" borderRadius="xl" shadow="lg" p={8}>
          <Stack gap={6} as="form" onSubmit={handleSubmit}>
            <Heading size="lg">Forgot password</Heading>
            {sent ? (
              <Text color="fg.muted">Check your email for a reset link.</Text>
            ) : (
              <>
                <FormField label="Email">
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </FormField>
                <Button type="submit" colorPalette="blue" w="full" loading={submitting}>
                  Send reset link
                </Button>
              </>
            )}
            <Link href="/auth/login">Back to sign in</Link>
          </Stack>
        </Box>
      </AuthPanel>
    </AuthPageShell>
  );
}
