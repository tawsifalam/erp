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

/** Default landing route after login or when blocking unauthorized deep links. */
export function getDefaultRouteForRole(role: Role | string): string {
  switch (role) {
    case Role.FRONT_DESK:
      return "/pms";
    case Role.KITCHEN:
      return "/pos/kitchen";
    case Role.CASHIER:
      return "/pos";
    case Role.HR:
      return "/hr";
    case Role.ACCOUNTANT:
      return "/accounting";
    case Role.OWNER:
    case Role.ADMIN:
    default:
      return "/dashboard";
  }
}

/** Whether a role can access the dashboard overview (broad read access). */
export function roleCanAccessDashboard(role: Role | string): boolean {
  return (
    roleHasPermission(role as Role, Permission.ADMIN) ||
    roleHasPermission(role as Role, Permission.REPORTS_READ)
  );
}

/** Required permission(s) for a pathname — first matching rule wins. */
export function permissionsForPath(pathname: string): Permission[] | null {
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
    return [Permission.PMS_READ, Permission.POS_READ, Permission.REPORTS_READ, Permission.ADMIN];
  }
  if (pathname === "/pms" || pathname.startsWith("/pms/")) {
    return [Permission.PMS_READ];
  }
  if (pathname === "/pos/kitchen" || pathname.startsWith("/pos/kitchen/")) {
    return [Permission.POS_READ];
  }
  if (pathname === "/pos" || pathname.startsWith("/pos/")) {
    return [Permission.POS_READ];
  }
  if (pathname === "/inventory" || pathname.startsWith("/inventory/")) {
    return [Permission.INVENTORY_READ];
  }
  if (pathname === "/accounting" || pathname.startsWith("/accounting/")) {
    return [Permission.ACCOUNTING_READ];
  }
  if (pathname === "/hr" || pathname.startsWith("/hr/")) {
    return [Permission.HR_READ];
  }
  if (pathname === "/reports" || pathname.startsWith("/reports/")) {
    return [Permission.REPORTS_READ];
  }
  if (pathname === "/settings" || pathname.startsWith("/settings/")) {
    return [Permission.ADMIN];
  }
  return null;
}

/** True if role may view the given pathname (any listed permission suffices). */
export function roleCanAccessPath(role: Role | string, pathname: string): boolean {
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
    return roleCanAccessDashboard(role);
  }
  const required = permissionsForPath(pathname);
  if (!required) return true;
  const r = role as Role;
  return required.some((p) => roleHasPermission(r, p));
}
