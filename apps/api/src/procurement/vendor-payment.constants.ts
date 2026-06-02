export const VENDOR_PAYMENT_REF_TYPE = "vendor_payment";

export const PAY_FROM_ACCOUNT_CODES = ["1000", "1100"] as const;

export type PayFromAccountCode = (typeof PAY_FROM_ACCOUNT_CODES)[number];
