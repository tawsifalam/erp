export type ModuleMeta = {
  label: string;
  title: string;
  description: string;
};

export const MODULE_META: Record<string, ModuleMeta> = {
  "/dashboard": {
    label: "Dashboard",
    title: "Overview",
    description: "Today's occupancy, revenue, and inventory alerts for the selected branch.",
  },
  "/pms": {
    label: "PMS",
    title: "Property management",
    description: "Reservations, rooms, guests, and housekeeping for the selected branch.",
  },
  "/pos": {
    label: "POS",
    title: "Point of sale",
    description: "Menu, orders, and payments for restaurant and bar service.",
  },
  "/pos/kitchen": {
    label: "Kitchen",
    title: "Kitchen display",
    description: "Live queue of orders sent from POS — mark items ready as you finish them.",
  },
  "/inventory": {
    label: "Inventory",
    title: "Stock management",
    description: "Ledger-based stock, movements, and menu recipes (BOM).",
  },
  "/accounting": {
    label: "Accounting",
    title: "Accounting",
    description: "Chart of accounts and double-entry journals for your organization.",
  },
  "/hr": {
    label: "HR",
    title: "Human resources",
    description: "Employees, attendance, staff meals, and payroll.",
  },
  "/reports": {
    label: "Reports",
    title: "Reports & exports",
    description: "Download CSV reports — jobs run in the background and appear here when ready.",
  },
  "/settings": {
    label: "Settings",
    title: "Organization settings",
    description: "Branches, team access, join codes, and inventory pools.",
  },
};

export function getModuleMeta(pathname: string): ModuleMeta | undefined {
  if (MODULE_META[pathname]) return MODULE_META[pathname];
  const match = Object.keys(MODULE_META)
    .filter((key) => key !== "/dashboard" && pathname.startsWith(key))
    .sort((a, b) => b.length - a.length)[0];
  return match ? MODULE_META[match] : undefined;
}
