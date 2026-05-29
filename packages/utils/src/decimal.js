"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toNumber = toNumber;
exports.roundMoney = roundMoney;
function toNumber(value) {
    return typeof value === "number" ? value : Number(value.toString());
}
function roundMoney(n) {
    return Math.round(n * 100) / 100;
}
//# sourceMappingURL=decimal.js.map