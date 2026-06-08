"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Box, Button, Heading, Input, Stack, Text } from "@chakra-ui/react";
import { FormField } from "@erp/ui";
import {
  PasswordWithConfirmFields,
  validatePasswordConfirmation,
} from "@/components/auth/password-input";
import { AuthPageShell, AuthPanel } from "@/components/auth/auth-page-shell";
import { acceptInviteApi, getInvitePreviewApi } from "@/lib/auth-api";
import { appToast } from "@/lib/app-toast";

export default function AcceptInvitePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [orgName, setOrgName] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    getInvitePreviewApi(token)
      .then((data) => {
        setOrgName(data.organizationName);
        setEmail(data.email);
      })
      .catch(() => appToast.error("Invalid or expired invite"))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const passwordError = validatePasswordConfirmation(password, confirmPassword);
    if (passwordError) {
      appToast.error(passwordError);
      return;
    }
    setSubmitting(true);
    try {
      await acceptInviteApi(token, password, name || undefined);
      router.replace("/");
    } catch (err) {
      appToast.error(err instanceof Error ? err.message : "Could not accept invite");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <AuthPageShell>
        <AuthPanel variant="form">
          <Text>Loading invite…</Text>
        </AuthPanel>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell>
      <AuthPanel variant="form">
        <Box w="full" maxW="420px" bg="white" borderWidth="1px" borderRadius="xl" shadow="lg" p={8}>
          <Stack gap={6} as="form" onSubmit={handleSubmit}>
            <Stack gap={2} textAlign="center">
              <Heading size="lg">Join {orgName || "organization"}</Heading>
              <Text color="fg.muted" fontSize="sm">
                Set your password for {email}
              </Text>
            </Stack>
            <FormField label="Your name">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </FormField>
            <PasswordWithConfirmFields
              password={password}
              confirmPassword={confirmPassword}
              onPasswordChange={setPassword}
              onConfirmPasswordChange={setConfirmPassword}
            />
            <Button type="submit" colorPalette="blue" w="full" loading={submitting}>
              Accept invite
            </Button>
          </Stack>
        </Box>
      </AuthPanel>
    </AuthPageShell>
  );
}
