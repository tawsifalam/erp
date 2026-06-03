export type SectionMeta = {
  label: string;
};

export const MODULE_SECTIONS: Record<string, Record<string, SectionMeta>> = {
  "/onboarding": {
    create: { label: "Create organization" },
    join: { label: "Join organization" },
  },
  "/settings": {
    organization: { label: "Organization & branches" },
    team: { label: "Team & access" },
    audit: { label: "Audit log" },
    pools: { label: "Inventory pools" },
    notifications: { label: "Notifications" },
    "branch-access": { label: "Branch access" },
    integrations: { label: "Integrations" },
  },
  "/hr": {
    employees: { label: "Employees" },
    attendance: { label: "Attendance" },
    meals: { label: "Staff meals" },
    payroll: { label: "Payroll" },
  },
  "/accounting": {
    journals: { label: "Journal entries" },
    accounts: { label: "Chart of accounts" },
    periods: { label: "Fiscal periods" },
  },
  "/pms": {
    reservations: { label: "Reservations" },
    rooms: { label: "Rooms" },
    "room-types": { label: "Room types" },
    guests: { label: "Guests" },
    inclusions: { label: "Guest packages" },
    rates: { label: "Rates" },
  },
  "/pos": {
    orders: { label: "Orders" },
    menu: { label: "Menu" },
  },
  "/inventory": {
    items: { label: "Items & movements" },
    recipes: { label: "Recipes (BOM)" },
  },
};

export function getModulePathname(pathname: string): string | undefined {
  const paths = Object.keys(MODULE_SECTIONS).sort((a, b) => b.length - a.length);
  return paths.find((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function getSectionTabs(pathname: string): string[] {
  const modulePath = getModulePathname(pathname);
  if (!modulePath) return [];
  return Object.keys(MODULE_SECTIONS[modulePath] ?? {});
}

export function getSectionMeta(pathname: string, tab: string): SectionMeta | undefined {
  const modulePath = getModulePathname(pathname);
  if (!modulePath) return undefined;
  return MODULE_SECTIONS[modulePath]?.[tab];
}

export function isValidSectionTab(pathname: string, tab: string): boolean {
  return getSectionMeta(pathname, tab) !== undefined;
}
