export declare enum Role {
    OWNER = "OWNER",
    ADMIN = "ADMIN",
    FRONT_DESK = "FRONT_DESK",
    CASHIER = "CASHIER",
    KITCHEN = "KITCHEN",
    ACCOUNTANT = "ACCOUNTANT",
    HR = "HR"
}
export declare enum RoomStatus {
    VACANT = "VACANT",
    OCCUPIED = "OCCUPIED",
    DIRTY = "DIRTY",
    MAINTENANCE = "MAINTENANCE"
}
export declare enum ReservationStatus {
    INQUIRY = "INQUIRY",
    CONFIRMED = "CONFIRMED",
    CHECKED_IN = "CHECKED_IN",
    CHECKED_OUT = "CHECKED_OUT",
    CANCELLED = "CANCELLED"
}
export declare enum OrderStatus {
    DRAFT = "DRAFT",
    SUBMITTED = "SUBMITTED",
    PREPARING = "PREPARING",
    READY = "READY",
    COMPLETED = "COMPLETED",
    CANCELLED = "CANCELLED"
}
export declare enum PaymentStatus {
    UNPAID = "UNPAID",
    PARTIAL = "PARTIAL",
    PAID = "PAID"
}
export declare enum MovementType {
    PURCHASE = "PURCHASE",
    SALE = "SALE",
    WASTE = "WASTE",
    STAFF_MEAL = "STAFF_MEAL",
    ADJUSTMENT = "ADJUSTMENT"
}
export declare enum MovementDirection {
    IN = "IN",
    OUT = "OUT"
}
export declare enum AccountType {
    ASSET = "ASSET",
    LIABILITY = "LIABILITY",
    EQUITY = "EQUITY",
    REVENUE = "REVENUE",
    EXPENSE = "EXPENSE"
}
export declare enum AttendanceType {
    CLOCK_IN = "CLOCK_IN",
    CLOCK_OUT = "CLOCK_OUT"
}
export declare enum PayrollRunStatus {
    PENDING = "PENDING",
    PROCESSING = "PROCESSING",
    COMPLETED = "COMPLETED",
    FAILED = "FAILED"
}
export declare enum Permission {
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
    ADMIN = "admin:*"
}
