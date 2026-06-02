export const NotificationType = {
  LOW_STOCK: "LOW_STOCK",
  PAYROLL_COMPLETED: "PAYROLL_COMPLETED",
  PAYROLL_FAILED: "PAYROLL_FAILED",
  REPORT_READY: "REPORT_READY",
  PO_AWAITING_RECEIPT: "PO_AWAITING_RECEIPT",
} as const;

export type NotificationTypeValue =
  (typeof NotificationType)[keyof typeof NotificationType];

export const NOTIFICATION_TYPES = Object.values(NotificationType);

export type NotificationChannelPreference = {
  inApp: boolean;
  email: boolean;
};

/** Defaults when the user has not saved a preference row (matches Phase 1 behavior). */
export const DEFAULT_NOTIFICATION_CHANNELS: Record<
  NotificationTypeValue,
  NotificationChannelPreference
> = {
  [NotificationType.LOW_STOCK]: { inApp: true, email: true },
  [NotificationType.PAYROLL_COMPLETED]: { inApp: true, email: true },
  [NotificationType.PAYROLL_FAILED]: { inApp: true, email: true },
  [NotificationType.REPORT_READY]: { inApp: true, email: false },
  [NotificationType.PO_AWAITING_RECEIPT]: { inApp: true, email: false },
};

export const NOTIFICATION_TYPE_LABELS: Record<NotificationTypeValue, string> = {
  [NotificationType.LOW_STOCK]: "Low stock alerts",
  [NotificationType.PAYROLL_COMPLETED]: "Payroll completed",
  [NotificationType.PAYROLL_FAILED]: "Payroll failed",
  [NotificationType.REPORT_READY]: "Report ready",
  [NotificationType.PO_AWAITING_RECEIPT]: "PO awaiting receipt",
};

export const NOTIFICATION_TYPE_DESCRIPTIONS: Record<NotificationTypeValue, string> = {
  [NotificationType.LOW_STOCK]: "When inventory falls below the configured threshold.",
  [NotificationType.PAYROLL_COMPLETED]: "When a payroll run finishes successfully.",
  [NotificationType.PAYROLL_FAILED]: "When a payroll run cannot be completed.",
  [NotificationType.REPORT_READY]: "When a background report export is ready to download.",
  [NotificationType.PO_AWAITING_RECEIPT]: "When a purchase order is submitted and awaiting goods receipt.",
};

export function isNotificationType(type: string): type is NotificationTypeValue {
  return (NOTIFICATION_TYPES as readonly string[]).includes(type);
}
