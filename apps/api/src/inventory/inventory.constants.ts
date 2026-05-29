export const POOL_CODE_GUEST = "guest";
export const POOL_CODE_STAFF = "staff";

export const POOL_CODE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const DEFAULT_INVENTORY_POOLS = [
  { code: POOL_CODE_GUEST, name: "Guest / Kitchen", isSystem: true, sortOrder: 0 },
  { code: POOL_CODE_STAFF, name: "Staff pantry", isSystem: true, sortOrder: 1 },
] as const;

export function normalizePoolCode(code: string): string {
  return code.trim().toLowerCase();
}

export function isValidPoolCode(code: string): boolean {
  return POOL_CODE_PATTERN.test(code);
}
