/** Audit log action verbs (stored as text). */
export const AuditAction = {
  CREATE: "CREATE",
  UPDATE: "UPDATE",
  DELETE: "DELETE",
  SUBMIT: "SUBMIT",
  RECEIVE: "RECEIVE",
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
  JOURNAL_ENTRY: "journal_entry",
  INVENTORY_MOVEMENT: "inventory_movement",
  INVENTORY_ITEM: "inventory_item",
  RESERVATION: "reservation",
  ORDER: "order",
  EMPLOYEE: "employee",
} as const;
