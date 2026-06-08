"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  loginApi,
  logoutApi,
  refreshApi,
  registerApi,
  type AuthUser,
} from "./auth-api";
import { setCachedAccessToken, clearCachedAccessToken } from "./auth-token-store";

const SESSION_COOKIE = "erp_session";

function setBrowserSessionFlag(active: boolean) {
  if (typeof document === "undefined") return;
  if (active) {
    document.cookie = `${SESSION_COOKIE}=1; path=/; SameSite=Lax`;
  } else {
    document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0`;
  }
}

type AuthState = {
  user: AuthUser | null;
  accessToken: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<string | null>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const applySession = useCallback((token: string | null, nextUser: AuthUser | null) => {
    setAccessToken(token);
    setUser(nextUser);
    setCachedAccessToken(token);
    setBrowserSessionFlag(!!token);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const data = await refreshApi();
      if (data.accessToken && data.user) {
        applySession(data.accessToken, data.user);
        return data.accessToken;
      }
      return null;
    } catch {
      return null;
    }
  }, [applySession]);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await loginApi(email, password);
      applySession(data.accessToken, data.user);
    },
    [applySession],
  );

  const register = useCallback(
    async (email: string, password: string, name?: string) => {
      const data = await registerApi(email, password, name);
      applySession(data.accessToken, data.user);
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    try {
      await logoutApi();
    } finally {
      clearCachedAccessToken();
      applySession(null, null);
    }
  }, [applySession]);

  const value = useMemo(
    () => ({ user, accessToken, loading, login, register, logout, refresh }),
    [user, accessToken, loading, login, register, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/** Compatibility shim for pages migrating from PropelAuth useUser(). */
export function useUser() {
  const { user, accessToken, loading } = useAuth();
  return {
    loading,
    accessToken,
    user: user
      ? {
          userId: user.id,
          email: user.email,
          firstName: user.name?.split(" ")[0],
          lastName: user.name?.split(" ").slice(1).join(" ") || undefined,
        }
      : null,
  };
}
