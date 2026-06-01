export const NotificationType = {
  LOW_STOCK: "LOW_STOCK",
  PAYROLL_COMPLETED: "PAYROLL_COMPLETED",
  PAYROLL_FAILED: "PAYROLL_FAILED",
  REPORT_READY: "REPORT_READY",
  PO_AWAITING_RECEIPT: "PO_AWAITING_RECEIPT",
} as const;

export type NotificationTypeValue =
  (typeof NotificationType)[keyof typeof NotificationType];
