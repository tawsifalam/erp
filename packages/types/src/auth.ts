import type { Role } from "./enums";

/** PropelAuth organization membership from the access token */
export interface PropelAuthOrgMembership {
  orgId: string;
  orgName?: string;
  role: string;
}

/** Authenticated user attached to the request after PropelAuth validation */
export interface AuthUserPayload {
  userId: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  /** @deprecated Prefer `orgs`; kept for callers that only need one org */
  orgId?: string;
  orgs?: PropelAuthOrgMembership[];
}

/** @deprecated Use AuthUserPayload */
export type JwtUserPayload = AuthUserPayload;

export interface TenantContext {
  organizationId: string;
  branchId?: string;
  userId: string;
  role: Role;
}
