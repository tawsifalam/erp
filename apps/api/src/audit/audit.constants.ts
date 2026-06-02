/** Audit log action verbs (stored as text). */
export const AuditAction = {
  CREATE: "CREATE",
  UPDATE: "UPDATE",
  DELETE: "DELETE",
  SUBMIT: "SUBMIT",
  RECEIVE: "RECEIVE",
  REVERSE: "REVERSE",
  APPROVE: "APPROVE",
  REJECT: "REJECT",
  ROLE_CHANGE: "ROLE_CHANGE",
  REMOVE_MEMBER: "REMOVE_MEMBER",
} as const;

/** Entity type labels for filtering and display. */
export const AuditEntityType = {
  VENDOR: "vendor",
  PURCHASE_ORDER: "purchase_order",
  GOODS_RECEIPT: "goods_receipt",
  BRANCH: "branch",
  ORGANIZATION: "organization",
  USER_ORGANIZATION: "user_organization",
  JOIN_REQUEST: "join_request",
  ORG_INVITE: "org_invite",
  JOURNAL_ENTRY: "journal_entry",
  INVENTORY_MOVEMENT: "inventory_movement",
  INVENTORY_ITEM: "inventory_item",
  RESERVATION: "reservation",
  ORDER: "order",
  EMPLOYEE: "employee",
  RATE_PLAN: "rate_plan",
  RATE_RULE: "rate_rule",
  FISCAL_PERIOD: "fiscal_period",
  VENDOR_PAYMENT: "vendor_payment",
} as const;
