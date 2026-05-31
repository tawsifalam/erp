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

export type NavLinkItem = {
  href: string;
  label: string;
  icon: SidebarIconComponent;
};

export type NavGroup = {
  id: string;
  label: string;
  icon: SidebarIconComponent;
  items: NavLinkItem[];
};

export const TOP_NAV: NavLinkItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: DashboardIcon },
];

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "operations",
    label: "Operations",
    icon: BuildingIcon,
    items: [
      { href: "/pms", label: "PMS", icon: BuildingIcon },
      { href: "/pos", label: "POS", icon: UtensilsIcon },
      { href: "/pos/kitchen", label: "Kitchen", icon: ChefHatIcon },
    ],
  },
  {
    id: "back-office",
    label: "Back office",
    icon: PackageIcon,
    items: [
      { href: "/inventory", label: "Inventory", icon: PackageIcon },
      { href: "/accounting", label: "Accounting", icon: LedgerIcon },
      { href: "/hr", label: "HR", icon: UsersIcon },
      { href: "/reports", label: "Reports", icon: ChartIcon },
    ],
  },
];

export const BOTTOM_NAV: NavLinkItem[] = [
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  if (href === "/pos") return pathname === "/pos";
  return pathname === href || pathname.startsWith(`${href}/`);
}
