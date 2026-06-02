import { Role } from "@erp/types";

export const UserBranchStatus = {
  ACTIVE: "ACTIVE",
  PENDING: "PENDING",
} as const;

export type UserBranchStatusValue =
  (typeof UserBranchStatus)[keyof typeof UserBranchStatus];

/** Org roles with implicit access to every branch (no UserBranch row required). */
export const IMPLICIT_BRANCH_ACCESS_ROLES = new Set<string>([Role.OWNER, Role.ADMIN]);

export function hasImplicitBranchAccess(role: string): boolean {
  return IMPLICIT_BRANCH_ACCESS_ROLES.has(role);
}
