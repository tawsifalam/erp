import type { Role } from "./enums";
export interface AuthUserPayload {
    userId: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    orgId?: string;
}
export type JwtUserPayload = AuthUserPayload;
export interface TenantContext {
    organizationId: string;
    branchId?: string;
    userId: string;
    role: Role;
}
