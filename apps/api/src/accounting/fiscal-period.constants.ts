export const FiscalPeriodStatus = {
  OPEN: "OPEN",
  CLOSED: "CLOSED",
} as const;

export type FiscalPeriodStatusValue =
  (typeof FiscalPeriodStatus)[keyof typeof FiscalPeriodStatus];
