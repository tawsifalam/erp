"use client";

import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { AuthProvider } from "@propelauth/nextjs/client";
import { AuthTokenSync } from "@/components/auth-token-sync";
import { Toaster } from "@/components/ui/toaster";
import { TenantProvider } from "@/lib/tenant-context";

export function Providers({ children }: { children: React.ReactNode }) {
  const authUrl = process.env.NEXT_PUBLIC_AUTH_URL!;

  return (
    <AuthProvider authUrl={authUrl}>
      <AuthTokenSync />
      <ChakraProvider value={defaultSystem}>
        <TenantProvider>{children}</TenantProvider>
        <Toaster />
      </ChakraProvider>
    </AuthProvider>
  );
}
