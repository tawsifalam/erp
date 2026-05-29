import { randomUUID } from "crypto";

/**
 * Model-to-prefix mapping.
 * Looking at any ID instantly tells you which table it belongs to.
 */
const MODEL_PREFIXES: Record<string, string> = {
  User: "usr",
  Organization: "org",
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
