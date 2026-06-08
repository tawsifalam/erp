import { getApiBaseUrl } from "./api-base-url";

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
};

export type LoginResponse = {
  accessToken: string;
  user: AuthUser;
};

async function authFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${getApiBaseUrl()}/api/auth/${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers as Record<string, string>),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? `Auth error ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export function loginApi(email: string, password: string) {
  return authFetch<LoginResponse>("login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function registerApi(email: string, password: string, name?: string) {
  return authFetch<LoginResponse>("register", {
    method: "POST",
    body: JSON.stringify({ email, password, name }),
  });
}

export function refreshApi() {
  return authFetch<{ accessToken: string | null; user?: AuthUser }>("refresh", {
    method: "POST",
  });
}

export function logoutApi() {
  return authFetch<{ ok: boolean }>("logout", { method: "POST" });
}

export function forgotPasswordApi(email: string) {
  return authFetch<{ ok: boolean }>("forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function resetPasswordApi(token: string, password: string) {
  return authFetch<{ ok: boolean }>("reset-password", {
    method: "POST",
    body: JSON.stringify({ token, password }),
  });
}

export function getInvitePreviewApi(token: string) {
  return authFetch<{
    email: string;
    organizationName: string;
    organizationId: string;
  }>(`invite/${encodeURIComponent(token)}`);
}

export function acceptInviteApi(token: string, password: string, name?: string) {
  return authFetch<LoginResponse>("accept-invite", {
    method: "POST",
    body: JSON.stringify({ token, password, name }),
  });
}
