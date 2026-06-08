import { Suspense } from "react";
import { AuthPageShell, AuthPanel } from "@/components/auth/auth-page-shell";
import { Text } from "@chakra-ui/react";

function AuthPageFallback() {
  return (
    <AuthPageShell>
      <AuthPanel variant="form">
        <Text>Loading…</Text>
      </AuthPanel>
    </AuthPageShell>
  );
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<AuthPageFallback />}>{children}</Suspense>;
}
