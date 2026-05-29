import {
  parseStoredTenant,
  serializeStoredTenant,
  TENANT_STORAGE_KEY,
  type StoredTenant,
} from "./tenant";

export function readStoredTenant(): StoredTenant | null {
  if (typeof window === "undefined") return null;
  return parseStoredTenant(window.localStorage.getItem(TENANT_STORAGE_KEY));
}

export function writeStoredTenant(tenant: StoredTenant): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TENANT_STORAGE_KEY, serializeStoredTenant(tenant));
}

export function clearStoredTenant(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TENANT_STORAGE_KEY);
}
