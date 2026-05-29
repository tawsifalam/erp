"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.roleHasPermission = roleHasPermission;
const types_1 = require("@erp/types");
const ROLE_PERMISSIONS = {
    [types_1.Role.OWNER]: Object.values(types_1.Permission),
    [types_1.Role.ADMIN]: Object.values(types_1.Permission),
    [types_1.Role.FRONT_DESK]: [types_1.Permission.PMS_READ, types_1.Permission.PMS_WRITE],
    [types_1.Role.CASHIER]: [types_1.Permission.PMS_READ, types_1.Permission.POS_READ, types_1.Permission.POS_WRITE],
    [types_1.Role.KITCHEN]: [types_1.Permission.POS_READ, types_1.Permission.POS_WRITE],
    [types_1.Role.ACCOUNTANT]: [
        types_1.Permission.PMS_READ,
        types_1.Permission.POS_READ,
        types_1.Permission.INVENTORY_READ,
        types_1.Permission.ACCOUNTING_READ,
        types_1.Permission.ACCOUNTING_WRITE,
        types_1.Permission.HR_READ,
        types_1.Permission.REPORTS_READ,
    ],
    [types_1.Role.HR]: [
        types_1.Permission.HR_READ,
        types_1.Permission.HR_WRITE,
        types_1.Permission.ACCOUNTING_READ,
        types_1.Permission.REPORTS_READ,
    ],
};
function roleHasPermission(role, permission) {
    const perms = ROLE_PERMISSIONS[role] ?? [];
    return perms.includes(types_1.Permission.ADMIN) || perms.includes(permission);
}
//# sourceMappingURL=rbac.js.map