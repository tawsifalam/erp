export enum Role {
  OWNER = "OWNER",
  ADMIN = "ADMIN",
  FRONT_DESK = "FRONT_DESK",
  CASHIER = "CASHIER",
  KITCHEN = "KITCHEN",
  ACCOUNTANT = "ACCOUNTANT",
  HR = "HR",
}

export enum RoomStatus {
  VACANT = "VACANT",
  OCCUPIED = "OCCUPIED",
  DIRTY = "DIRTY",
  MAINTENANCE = "MAINTENANCE",
}

export enum ReservationStatus {
  INQUIRY = "INQUIRY",
  CONFIRMED = "CONFIRMED",
  CHECKED_IN = "CHECKED_IN",
  CHECKED_OUT = "CHECKED_OUT",
  CANCELLED = "CANCELLED",
}

export enum OrderStatus {
  DRAFT = "DRAFT",
  SUBMITTED = "SUBMITTED",
  PREPARING = "PREPARING",
  READY = "READY",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}

export enum PaymentStatus {
  UNPAID = "UNPAID",
  PARTIAL = "PARTIAL",
  PAID = "PAID",
}

export enum MovementType {
  PURCHASE = "PURCHASE",
  SALE = "SALE",
  WASTE = "WASTE",
  STAFF_MEAL = "STAFF_MEAL",
  ADJUSTMENT = "ADJUSTMENT",
}

export enum MovementDirection {
  IN = "IN",
  OUT = "OUT",
}

export enum AccountType {
  ASSET = "ASSET",
  LIABILITY = "LIABILITY",
  EQUITY = "EQUITY",
  REVENUE = "REVENUE",
  EXPENSE = "EXPENSE",
}

export enum Permission {
  PMS_READ = "pms:read",
  PMS_WRITE = "pms:write",
  POS_READ = "pos:read",
  POS_WRITE = "pos:write",
  INVENTORY_READ = "inventory:read",
  INVENTORY_WRITE = "inventory:write",
  ACCOUNTING_READ = "accounting:read",
  ACCOUNTING_WRITE = "accounting:write",
  HR_READ = "hr:read",
  HR_WRITE = "hr:write",
  REPORTS_READ = "reports:read",
  ADMIN = "admin:*",
}
