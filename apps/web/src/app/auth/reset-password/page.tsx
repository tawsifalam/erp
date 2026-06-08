"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Box, Button, Heading, Stack } from "@chakra-ui/react";
import {
  PasswordWithConfirmFields,
  validatePasswordConfirmation,
} from "@/components/auth/password-input";
import { AuthPageShell, AuthPanel } from "@/components/auth/auth-page-shell";
import { resetPasswordApi } from "@/lib/auth-api";
import { appToast } from "@/lib/app-toast";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) {
      appToast.error("Missing reset token");
      return;
    }
    const passwordError = validatePasswordConfirmation(password, confirmPassword);
    if (passwordError) {
      appToast.error(passwordError);
      return;
    }
    setSubmitting(true);
    try {
      await resetPasswordApi(token, password);
      appToast.success("Password updated. Sign in with your new password.");
      router.replace("/auth/login");
    } catch (err) {
      appToast.error(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthPageShell>
      <AuthPanel variant="form">
        <Box w="full" maxW="420px" bg="white" borderWidth="1px" borderRadius="xl" shadow="lg" p={8}>
          <Stack gap={6} as="form" onSubmit={handleSubmit}>
            <Heading size="lg">Set new password</Heading>
            <PasswordWithConfirmFields
              password={password}
              confirmPassword={confirmPassword}
              onPasswordChange={setPassword}
              onConfirmPasswordChange={setConfirmPassword}
              passwordLabel="New password"
              confirmLabel="Confirm new password"
            />
            <Button type="submit" colorPalette="blue" w="full" loading={submitting}>
              Update password
            </Button>
          </Stack>
        </Box>
      </AuthPanel>
    </AuthPageShell>
  );
}
