import type { Role } from "./enums";

/** Authenticated user attached to the request after JWT validation */
export interface AuthUserPayload {
  userId: string;
  email?: string;
  firstName?: string;
  lastName?: string;
}

/** @deprecated Use AuthUserPayload */
export type JwtUserPayload = AuthUserPayload;

export interface TenantContext {
  organizationId: string;
  branchId?: string;
  userId: string;
  role: Role;
}
