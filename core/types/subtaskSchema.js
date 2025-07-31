"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubtaskStatus = exports.Priority = exports.SubtaskType = void 0;
var SubtaskType;
(function (SubtaskType) {
    SubtaskType["RESEARCH"] = "RESEARCH";
    SubtaskType["ANALYSIS"] = "ANALYSIS";
    SubtaskType["CREATION"] = "CREATION";
    SubtaskType["VALIDATION"] = "VALIDATION";
})(SubtaskType || (exports.SubtaskType = SubtaskType = {}));
var Priority;
(function (Priority) {
    Priority["LOW"] = "LOW";
    Priority["MEDIUM"] = "MEDIUM";
    Priority["HIGH"] = "HIGH";
    Priority["CRITICAL"] = "CRITICAL";
})(Priority || (exports.Priority = Priority = {}));
var SubtaskStatus;
(function (SubtaskStatus) {
    SubtaskStatus["PENDING"] = "PENDING";
    SubtaskStatus["ASSIGNED"] = "ASSIGNED";
    SubtaskStatus["IN_PROGRESS"] = "IN_PROGRESS";
    SubtaskStatus["COMPLETED"] = "COMPLETED";
    SubtaskStatus["FAILED"] = "FAILED";
    SubtaskStatus["CANCELLED"] = "CANCELLED";
})(SubtaskStatus || (exports.SubtaskStatus = SubtaskStatus = {}));
//# sourceMappingURL=subtaskSchema.js.map