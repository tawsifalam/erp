import { Permission, Role } from "@erp/types";

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.OWNER]: Object.values(Permission),
  [Role.ADMIN]: Object.values(Permission),
  [Role.FRONT_DESK]: [Permission.PMS_READ, Permission.PMS_WRITE],
  [Role.CASHIER]: [Permission.PMS_READ, Permission.POS_READ, Permission.POS_WRITE],
  [Role.KITCHEN]: [Permission.POS_READ, Permission.POS_WRITE],
  [Role.ACCOUNTANT]: [
    Permission.PMS_READ,
    Permission.POS_READ,
    Permission.INVENTORY_READ,
    Permission.ACCOUNTING_READ,
    Permission.ACCOUNTING_WRITE,
    Permission.HR_READ,
    Permission.REPORTS_READ,
  ],
  [Role.HR]: [
    Permission.HR_READ,
    Permission.HR_WRITE,
    Permission.ACCOUNTING_READ,
    Permission.REPORTS_READ,
  ],
};

export function roleHasPermission(role: Role, permission: Permission): boolean {
  const perms = ROLE_PERMISSIONS[role] ?? [];
  return perms.includes(Permission.ADMIN) || perms.includes(permission);
}
