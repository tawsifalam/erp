"use client";

import { getAccessToken, refreshAccessToken } from "./auth";
import { getApiBaseUrl } from "./api-base-url";

export type TenantHeaders = {
  organizationId: string;
  branchId?: string;
};

type ApiFetchOptions = RequestInit & {
  tenant?: TenantHeaders;
  /** @internal skip 401 refresh retry (prevents infinite loops) */
  _retried?: boolean;
};

async function buildAuthHeaders(
  options: ApiFetchOptions,
  token: string | null,
): Promise<Record<string, string>> {
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
  return headers;
}

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const token = await getAccessToken();
  const headers = await buildAuthHeaders(options, token);

  const res = await fetch(`${getApiBaseUrl()}/api${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

  if (res.status === 401 && !options._retried) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return apiFetch<T>(path, { ...options, _retried: true });
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? `API error ${res.status}`);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const text = await res.text();
  if (!text) {
    return undefined as T;
  }

  return JSON.parse(text) as T;
}

/** Download a binary API response (e.g. payslip PDF). */
export async function apiFetchBlob(
  path: string,
  options: ApiFetchOptions = {},
): Promise<Blob> {
  const token = await getAccessToken();
  const headers = await buildAuthHeaders(options, token);
  delete headers["Content-Type"];

  const res = await fetch(`${getApiBaseUrl()}/api${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

  if (res.status === 401 && !options._retried) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return apiFetchBlob(path, { ...options, _retried: true });
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? `API error ${res.status}`);
  }
  return res.blob();
}
