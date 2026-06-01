export const NotificationType = {
  LOW_STOCK: "LOW_STOCK",
  PAYROLL_COMPLETED: "PAYROLL_COMPLETED",
  PAYROLL_FAILED: "PAYROLL_FAILED",
  REPORT_READY: "REPORT_READY",
} as const;

export type NotificationTypeValue =
  (typeof NotificationType)[keyof typeof NotificationType];
