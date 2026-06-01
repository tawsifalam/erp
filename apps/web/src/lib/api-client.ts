"use client";

import { getAccessToken } from "./auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export type TenantHeaders = {
  organizationId: string;
  branchId?: string;
};

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { tenant?: TenantHeaders } = {},
): Promise<T> {
  const token = await getAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.tenant?.organizationId) {
    headers["X-Organization-Id"] = options.tenant.organizationId;
  }
  if (options.tenant?.branchId) {
    headers["X-Branch-Id"] = options.tenant.branchId;
  }

  const res = await fetch(`${API_URL}/api${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? `API error ${res.status}`);
  }

  return res.json() as Promise<T>;
}

/** Download a binary API response (e.g. payslip PDF). */
export async function apiFetchBlob(
  path: string,
  options: RequestInit & { tenant?: TenantHeaders } = {},
): Promise<Blob> {
  const token = await getAccessToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.tenant?.organizationId) {
    headers["X-Organization-Id"] = options.tenant.organizationId;
  }
  if (options.tenant?.branchId) {
    headers["X-Branch-Id"] = options.tenant.branchId;
  }

  const res = await fetch(`${API_URL}/api${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? `API error ${res.status}`);
  }
  return res.blob();
}
