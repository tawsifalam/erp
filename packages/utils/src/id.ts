import { randomUUID } from "crypto";

/**
 * Model-to-prefix mapping.
 * Looking at any ID instantly tells you which table it belongs to.
 */
const MODEL_PREFIXES: Record<string, string> = {
  User: "usr",
  Organization: "org",
  OrganizationJoinRequest: "ojr",
  UserOrganization: "uo",
  Branch: "br",
  RoomType: "rt",
  Room: "rm",
  Guest: "gst",
  Reservation: "rsv",
  MenuCategory: "mc",
  MenuItem: "mi",
  Order: "ord",
  OrderLine: "ol",
  KitchenTicket: "kt",
  InventoryItem: "inv",
  InventoryPool: "ivp",
  InventoryMovement: "im",
  Recipe: "rcp",
  RecipeLine: "rl",
  Account: "acc",
  JournalEntry: "je",
  JournalLine: "jl",
  Employee: "emp",
  AttendanceRecord: "att",
  PayrollRun: "pr",
  PayrollLine: "pl",
  StaffMeal: "sm",
  StaffMealRecipe: "smr",
  StaffMealRecipeLine: "sml",
  AuditLog: "aud",
  ReportJob: "rpt",
};

/** Generate a prefixed ID for a given Prisma model name. */
export function generateId(model: string): string {
  const prefix = MODEL_PREFIXES[model];
  if (!prefix) {
    throw new Error(`No ID prefix defined for model: ${model}`);
  }
  return `${prefix}_${randomUUID()}`;
}

/** Generate a short shareable organization join code (e.g. ov_a1b2c3d4). */
export function generateJoinCode(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let suffix = "";
  for (let i = 0; i < 8; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `ov_${suffix}`;
}

/** Generate an ID with a specific prefix string (e.g. "org", "rm"). */
export function generatePrefixedId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}

/** Get the prefix for a model name. */
export function getModelPrefix(model: string): string | undefined {
  return MODEL_PREFIXES[model];
}

/** Extract the prefix from an ID (e.g. "org_abc..." → "org"). */
export function getIdPrefix(id: string): string | undefined {
  const idx = id.indexOf("_");
  return idx > 0 ? id.slice(0, idx) : undefined;
}

export { MODEL_PREFIXES };
