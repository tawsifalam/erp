"use client";

import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { AuthProvider } from "@/lib/auth-context";
import { Toaster } from "@/components/ui/toaster";
import { TenantProvider } from "@/lib/tenant-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ChakraProvider value={defaultSystem}>
        <TenantProvider>{children}</TenantProvider>
        <Toaster />
      </ChakraProvider>
    </AuthProvider>
  );
}
