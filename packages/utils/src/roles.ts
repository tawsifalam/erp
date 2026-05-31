const ROLE_LABELS: Record<string, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  FRONT_DESK: "Front desk",
  CASHIER: "Cashier",
  KITCHEN: "Kitchen",
  ACCOUNTANT: "Accountant",
  HR: "HR",
};

export function formatRoleLabel(role: string | null | undefined): string {
  if (!role) return "Member";
  return ROLE_LABELS[role] ?? role.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}
