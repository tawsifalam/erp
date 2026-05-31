"use client";

import { useEffect } from "react";
import { useUser } from "@propelauth/nextjs/client";
import { setCachedAccessToken } from "@/lib/auth-token-store";

/** Keeps the API client token in sync with PropelAuth AuthProvider — no extra userinfo calls. */
export function AuthTokenSync() {
  const { accessToken, loading } = useUser();

  useEffect(() => {
    if (loading) return;
    setCachedAccessToken(accessToken ?? null);
  }, [accessToken, loading]);

  return null;
}
