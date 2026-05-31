"use client";

import { AuthLoginCard } from "@/components/auth/auth-login-card";
import { AuthMarketingPanel } from "@/components/auth/auth-marketing-panel";
import { AuthPageShell, AuthPanel } from "@/components/auth/auth-page-shell";

export default function LoginPage() {
  return (
    <AuthPageShell>
      <AuthPanel variant="marketing">
        <AuthMarketingPanel />
      </AuthPanel>
      <AuthPanel variant="form">
        <AuthLoginCard />
      </AuthPanel>
    </AuthPageShell>
  );
}
