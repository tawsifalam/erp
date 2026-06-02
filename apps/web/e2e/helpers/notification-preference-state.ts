/** Mutable notification preferences for Playwright API mocks (reset per test). */

import { E2E_ACTOR_USER_ID, E2E_ORG_ID } from "./audit-state";

export type MockNotificationPreference = {
  type: string;
  inApp: boolean;
  email: boolean;
};

const DEFAULTS: MockNotificationPreference[] = [
  { type: "LOW_STOCK", inApp: true, email: true },
  { type: "PAYROLL_COMPLETED", inApp: true, email: true },
  { type: "PAYROLL_FAILED", inApp: true, email: true },
  { type: "REPORT_READY", inApp: true, email: false },
  { type: "PO_AWAITING_RECEIPT", inApp: true, email: false },
];

const LABELS: Record<string, string> = {
  LOW_STOCK: "Low stock alerts",
  PAYROLL_COMPLETED: "Payroll completed",
  PAYROLL_FAILED: "Payroll failed",
  REPORT_READY: "Report ready",
  PO_AWAITING_RECEIPT: "PO awaiting receipt",
};

const DESCRIPTIONS: Record<string, string> = {
  LOW_STOCK: "When inventory falls below the configured threshold.",
  PAYROLL_COMPLETED: "When a payroll run finishes successfully.",
  PAYROLL_FAILED: "When a payroll run cannot be completed.",
  REPORT_READY: "When a background report export is ready to download.",
  PO_AWAITING_RECEIPT: "When a purchase order is submitted and awaiting goods receipt.",
};

let saved = new Map<string, MockNotificationPreference>();

export function resetNotificationPreferenceState() {
  saved = new Map();
}

function prefKey(orgId: string, userId: string, type: string) {
  return `${orgId}:${userId}:${type}`;
}

export function listNotificationPreferences(organizationId: string, userId: string) {
  return DEFAULTS.map((defaults) => {
    const row = saved.get(prefKey(organizationId, userId, defaults.type));
    return {
      type: defaults.type,
      label: LABELS[defaults.type] ?? defaults.type,
      description: DESCRIPTIONS[defaults.type] ?? "",
      inApp: row?.inApp ?? defaults.inApp,
      email: row?.email ?? defaults.email,
      isDefault: !row,
    };
  });
}

export function updateNotificationPreference(
  organizationId: string,
  userId: string,
  type: string,
  patch: Partial<MockNotificationPreference>,
) {
  const defaults = DEFAULTS.find((d) => d.type === type);
  if (!defaults) return { status: 400, message: `Invalid notification type: ${type}` };

  const key = prefKey(organizationId, userId, type);
  const current = saved.get(key) ?? defaults;
  const next = {
    type,
    inApp: patch.inApp ?? current.inApp,
    email: patch.email ?? current.email,
  };
  saved.set(key, next);
  return {
    type,
    label: LABELS[type] ?? type,
    description: DESCRIPTIONS[type] ?? "",
    inApp: next.inApp,
    email: next.email,
    isDefault: false,
  };
}

export function resolveNotificationChannels(
  organizationId: string,
  userId: string,
  type: string,
) {
  const defaults = DEFAULTS.find((d) => d.type === type) ?? { inApp: true, email: false };
  const row = saved.get(prefKey(organizationId, userId, type));
  return {
    inApp: row?.inApp ?? defaults.inApp,
    email: row?.email ?? defaults.email,
  };
}
