"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContextInjectionError = exports.AgentValidationError = exports.BatchExecutionError = exports.SupercolliderError = void 0;
class SupercolliderError extends Error {
    constructor(message, code, context) {
        super(message);
        this.code = code;
        this.context = context;
        this.name = 'SupercolliderError';
    }
}
exports.SupercolliderError = SupercolliderError;
class BatchExecutionError extends SupercolliderError {
    constructor(message, batchId, failedSubtasks, context) {
        super(message, 'BATCH_EXECUTION_ERROR', context);
        this.batchId = batchId;
        this.failedSubtasks = failedSubtasks;
        this.name = 'BatchExecutionError';
    }
}
exports.BatchExecutionError = BatchExecutionError;
class AgentValidationError extends SupercolliderError {
    constructor(message, agentId, validationDetails, context) {
        super(message, 'AGENT_VALIDATION_ERROR', context);
        this.agentId = agentId;
        this.validationDetails = validationDetails;
        this.name = 'AgentValidationError';
    }
}
exports.AgentValidationError = AgentValidationError;
class ContextInjectionError extends SupercolliderError {
    constructor(message, subtaskId, injectionConfig, context) {
        super(message, 'CONTEXT_INJECTION_ERROR', context);
        this.subtaskId = subtaskId;
        this.injectionConfig = injectionConfig;
        this.name = 'ContextInjectionError';
    }
}
exports.ContextInjectionError = ContextInjectionError;
//# sourceMappingURL=enhanced.js.map