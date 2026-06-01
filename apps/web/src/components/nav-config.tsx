import type { SidebarIconComponent } from "./sidebar-icons";
import {
  BuildingIcon,
  ChartIcon,
  ChefHatIcon,
  DashboardIcon,
  LedgerIcon,
  PackageIcon,
  SettingsIcon,
  UsersIcon,
  UtensilsIcon,
} from "./sidebar-icons";
import { Permission } from "@erp/types";
import { roleCanAccessDashboard, roleHasPermission } from "@erp/utils";
import type { Role } from "@erp/types";

export type NavLinkItem = {
  href: string;
  label: string;
  icon: SidebarIconComponent;
  /** Required permission to show this link (ADMIN implies all). */
  permission?: Permission;
  /** For dashboard: show if role has broad access. */
  dashboardAccess?: boolean;
};

export type NavGroup = {
  id: string;
  label: string;
  icon: SidebarIconComponent;
  items: NavLinkItem[];
};

export const TOP_NAV: NavLinkItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: DashboardIcon,
    dashboardAccess: true,
  },
];

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "operations",
    label: "Operations",
    icon: BuildingIcon,
    items: [
      { href: "/pms", label: "PMS", icon: BuildingIcon, permission: Permission.PMS_READ },
      { href: "/pos", label: "POS", icon: UtensilsIcon, permission: Permission.POS_READ },
      {
        href: "/pos/kitchen",
        label: "Kitchen",
        icon: ChefHatIcon,
        permission: Permission.POS_READ,
      },
    ],
  },
  {
    id: "back-office",
    label: "Back office",
    icon: PackageIcon,
    items: [
      {
        href: "/inventory",
        label: "Inventory",
        icon: PackageIcon,
        permission: Permission.INVENTORY_READ,
      },
      {
        href: "/procurement",
        label: "Procurement",
        icon: PackageIcon,
        permission: Permission.INVENTORY_READ,
      },
      {
        href: "/accounting",
        label: "Accounting",
        icon: LedgerIcon,
        permission: Permission.ACCOUNTING_READ,
      },
      { href: "/hr", label: "HR", icon: UsersIcon, permission: Permission.HR_READ },
      { href: "/reports", label: "Reports", icon: ChartIcon, permission: Permission.REPORTS_READ },
    ],
  },
];

export const BOTTOM_NAV: NavLinkItem[] = [
  { href: "/settings", label: "Settings", icon: SettingsIcon, permission: Permission.ADMIN },
];

export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  if (href === "/pos") return pathname === "/pos";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function canShowNavItem(role: Role | string | null, item: NavLinkItem): boolean {
  if (!role) return false;
  if (item.dashboardAccess) {
    return roleCanAccessDashboard(role);
  }
  if (!item.permission) return true;
  return roleHasPermission(role as Role, item.permission);
}

export function filterNavGroups(role: Role | string | null): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => canShowNavItem(role, item)),
  })).filter((group) => group.items.length > 0);
}

export function filterNavLinks(role: Role | string | null, items: NavLinkItem[]): NavLinkItem[] {
  return items.filter((item) => canShowNavItem(role, item));
}
