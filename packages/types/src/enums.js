"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Permission = exports.AccountType = exports.MovementDirection = exports.MovementType = exports.PaymentStatus = exports.OrderStatus = exports.ReservationStatus = exports.RoomStatus = exports.Role = void 0;
var Role;
(function (Role) {
    Role["OWNER"] = "OWNER";
    Role["ADMIN"] = "ADMIN";
    Role["FRONT_DESK"] = "FRONT_DESK";
    Role["CASHIER"] = "CASHIER";
    Role["KITCHEN"] = "KITCHEN";
    Role["ACCOUNTANT"] = "ACCOUNTANT";
    Role["HR"] = "HR";
})(Role || (exports.Role = Role = {}));
var RoomStatus;
(function (RoomStatus) {
    RoomStatus["VACANT"] = "VACANT";
    RoomStatus["OCCUPIED"] = "OCCUPIED";
    RoomStatus["DIRTY"] = "DIRTY";
    RoomStatus["MAINTENANCE"] = "MAINTENANCE";
})(RoomStatus || (exports.RoomStatus = RoomStatus = {}));
var ReservationStatus;
(function (ReservationStatus) {
    ReservationStatus["INQUIRY"] = "INQUIRY";
    ReservationStatus["CONFIRMED"] = "CONFIRMED";
    ReservationStatus["CHECKED_IN"] = "CHECKED_IN";
    ReservationStatus["CHECKED_OUT"] = "CHECKED_OUT";
    ReservationStatus["CANCELLED"] = "CANCELLED";
})(ReservationStatus || (exports.ReservationStatus = ReservationStatus = {}));
var OrderStatus;
(function (OrderStatus) {
    OrderStatus["DRAFT"] = "DRAFT";
    OrderStatus["SUBMITTED"] = "SUBMITTED";
    OrderStatus["PREPARING"] = "PREPARING";
    OrderStatus["READY"] = "READY";
    OrderStatus["COMPLETED"] = "COMPLETED";
    OrderStatus["CANCELLED"] = "CANCELLED";
})(OrderStatus || (exports.OrderStatus = OrderStatus = {}));
var PaymentStatus;
(function (PaymentStatus) {
    PaymentStatus["UNPAID"] = "UNPAID";
    PaymentStatus["PARTIAL"] = "PARTIAL";
    PaymentStatus["PAID"] = "PAID";
})(PaymentStatus || (exports.PaymentStatus = PaymentStatus = {}));
var MovementType;
(function (MovementType) {
    MovementType["PURCHASE"] = "PURCHASE";
    MovementType["SALE"] = "SALE";
    MovementType["WASTE"] = "WASTE";
    MovementType["STAFF_MEAL"] = "STAFF_MEAL";
    MovementType["ADJUSTMENT"] = "ADJUSTMENT";
})(MovementType || (exports.MovementType = MovementType = {}));
var MovementDirection;
(function (MovementDirection) {
    MovementDirection["IN"] = "IN";
    MovementDirection["OUT"] = "OUT";
})(MovementDirection || (exports.MovementDirection = MovementDirection = {}));
var AccountType;
(function (AccountType) {
    AccountType["ASSET"] = "ASSET";
    AccountType["LIABILITY"] = "LIABILITY";
    AccountType["EQUITY"] = "EQUITY";
    AccountType["REVENUE"] = "REVENUE";
    AccountType["EXPENSE"] = "EXPENSE";
})(AccountType || (exports.AccountType = AccountType = {}));
var Permission;
(function (Permission) {
    Permission["PMS_READ"] = "pms:read";
    Permission["PMS_WRITE"] = "pms:write";
    Permission["POS_READ"] = "pos:read";
    Permission["POS_WRITE"] = "pos:write";
    Permission["INVENTORY_READ"] = "inventory:read";
    Permission["INVENTORY_WRITE"] = "inventory:write";
    Permission["ACCOUNTING_READ"] = "accounting:read";
    Permission["ACCOUNTING_WRITE"] = "accounting:write";
    Permission["HR_READ"] = "hr:read";
    Permission["HR_WRITE"] = "hr:write";
    Permission["REPORTS_READ"] = "reports:read";
    Permission["ADMIN"] = "admin:*";
})(Permission || (exports.Permission = Permission = {}));
//# sourceMappingURL=enums.js.map