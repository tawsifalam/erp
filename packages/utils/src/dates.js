"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rangesOverlap = rangesOverlap;
function rangesOverlap(aStart, aEnd, bStart, bEnd) {
    return aStart < bEnd && bStart < aEnd;
}
//# sourceMappingURL=dates.js.map