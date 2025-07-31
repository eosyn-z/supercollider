"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExecutionController = void 0;
const subtaskSchema_1 = require("../types/subtaskSchema");
const executionTypes_1 = require("../types/executionTypes");
const dispatcher_1 = require("./dispatcher");
const validator_1 = require("./validator");
const executionPlanner_1 = require("./executionPlanner");
class ExecutionController {
    constructor(dispatcher, validator) {
        this.executionState = null;
        this.eventCallbacks = [];
        this.validationCallbacks = [];
        this.haltCallbacks = [];
        this.agents = new Map();
        this.isHalted = false;
        this.isPaused = false;
        this.dispatcher = dispatcher || new dispatcher_1.Dispatcher();
        this.validator = validator || new validator_1.Validator();
    }
    registerAgents(agents) {
        this.agents.clear();
        for (const agent of agents) {
            this.agents.set(agent.id, agent);
        }
    }
    async startExecution(workflow) {
        if (this.executionState && this.executionState.status === executionTypes_1.WorkflowExecutionStatus.RUNNING) {
            throw new Error('Execution already in progress');
        }
        this.executionState = {
            workflowId: workflow.id,
            status: executionTypes_1.WorkflowExecutionStatus.RUNNING,
            startTime: new Date(),
            runningSubtasks: [],
            completedSubtasks: [],
            failedSubtasks: [],
            retryCount: {},
            errors: [],
            progress: {
                total: workflow.subtasks.length,
                completed: 0,
                failed: 0,
                inProgress: 0
            }
        };
        this.isHalted = false;
        this.isPaused = false;
        this.emitEvent(executionTypes_1.ExecutionEventType.EXECUTION_STARTED, {
            workflowId: workflow.id,
            totalSubtasks: workflow.subtasks.length
        });
        try {
            await this.executeWorkflow(workflow);
            if (!this.isHalted && this.executionState.status !== executionTypes_1.WorkflowExecutionStatus.FAILED) {
                this.executionState.status = executionTypes_1.WorkflowExecutionStatus.COMPLETED;
                this.executionState.endTime = new Date();
                this.emitEvent(executionTypes_1.ExecutionEventType.EXECUTION_COMPLETED, {
                    workflowId: workflow.id,
                    duration: this.executionState.endTime.getTime() - this.executionState.startTime.getTime(),
                    completedSubtasks: this.executionState.completedSubtasks.length,
                    failedSubtasks: this.executionState.failedSubtasks.length
                });
            }
        }
        catch (error) {
            this.executionState.status = executionTypes_1.WorkflowExecutionStatus.FAILED;
            this.executionState.endTime = new Date();
            const executionError = {
                type: 'SYSTEM_ERROR',
                message: `Workflow execution failed: ${error.message}`,
                timestamp: new Date(),
                retryable: false
            };
            this.executionState.errors.push(executionError);
            this.emitEvent(executionTypes_1.ExecutionEventType.EXECUTION_FAILED, {
                workflowId: workflow.id,
                error: error.message
            });
            throw error;
        }
    }
    pauseExecution() {
        if (!this.executionState || this.executionState.status !== executionTypes_1.WorkflowExecutionStatus.RUNNING) {
            return;
        }
        this.isPaused = true;
        this.executionState.status = executionTypes_1.WorkflowExecutionStatus.PAUSED;
        this.emitEvent(executionTypes_1.ExecutionEventType.EXECUTION_PAUSED, {
            workflowId: this.executionState.workflowId
        });
    }
    resumeExecution() {
        if (!this.executionState || this.executionState.status !== executionTypes_1.WorkflowExecutionStatus.PAUSED) {
            return;
        }
        this.isPaused = false;
        this.executionState.status = executionTypes_1.WorkflowExecutionStatus.RUNNING;
        this.emitEvent(executionTypes_1.ExecutionEventType.EXECUTION_RESUMED, {
            workflowId: this.executionState.workflowId
        });
    }
    haltExecution(reason) {
        if (!this.executionState) {
            return;
        }
        this.isHalted = true;
        this.executionState.status = executionTypes_1.WorkflowExecutionStatus.HALTED;
        this.executionState.haltReason = reason;
        this.executionState.endTime = new Date();
        this.dispatcher.cancelAll();
        this.emitEvent(executionTypes_1.ExecutionEventType.EXECUTION_HALTED, {
            workflowId: this.executionState.workflowId,
            reason
        });
        for (const callback of this.haltCallbacks) {
            try {
                callback(reason, { workflowId: this.executionState.workflowId });
            }
            catch (error) {
                console.error('Error in halt callback:', error);
            }
        }
    }
    async executeWorkflow(workflow) {
        const batches = (0, executionPlanner_1.batchSubtasks)(workflow.subtasks, 3);
        const executionPlan = (0, executionPlanner_1.planDispatch)(batches, 'parallel', Array.from(this.agents.values()));
        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
            if (this.isHalted) {
                break;
            }
            while (this.isPaused && !this.isHalted) {
                await this.sleep(100);
            }
            const batch = batches[batchIndex];
            const batchId = `batch_${batchIndex}`;
            this.executionState.currentBatch = batchId;
            this.emitEvent(executionTypes_1.ExecutionEventType.BATCH_STARTED, {
                batchId,
                subtaskIds: batch.map(s => s.id)
            });
            try {
                await this.executeBatch(batch, batchId);
            }
            catch (error) {
                const executionError = {
                    type: 'SYSTEM_ERROR',
                    message: `Batch ${batchId} execution failed: ${error.message}`,
                    timestamp: new Date(),
                    retryable: false
                };
                this.executionState.errors.push(executionError);
            }
            this.emitEvent(executionTypes_1.ExecutionEventType.BATCH_COMPLETED, {
                batchId,
                completedSubtasks: batch.filter(s => this.executionState.completedSubtasks.includes(s.id)).length,
                failedSubtasks: batch.filter(s => this.executionState.failedSubtasks.includes(s.id)).length
            });
        }
    }
    async executeBatch(batch, batchId) {
        const batchPromises = batch.map(subtask => this.executeSubtask(subtask));
        const results = await Promise.allSettled(batchPromises);
        for (let i = 0; i < results.length; i++) {
            const result = results[i];
            const subtask = batch[i];
            if (result.status === 'rejected') {
                this.handleSubtaskFailure(subtask, result.reason?.message || 'Unknown error');
            }
        }
    }
    async executeSubtask(subtask) {
        if (this.isHalted) {
            return;
        }
        const agentId = subtask.assignedAgentId;
        if (!agentId) {
            throw new Error(`No agent assigned to subtask ${subtask.id}`);
        }
        const agent = this.agents.get(agentId);
        if (!agent) {
            throw new Error(`Agent ${agentId} not found`);
        }
        this.executionState.runningSubtasks.push(subtask.id);
        this.executionState.progress.inProgress++;
        this.emitEvent(executionTypes_1.ExecutionEventType.SUBTASK_STARTED, {
            subtaskId: subtask.id,
            agentId
        });
        try {
            const result = await this.executeSubtaskWithRetries(subtask, agent);
            if (result.status === 'COMPLETED') {
                await this.handleSubtaskSuccess(subtask, result);
            }
            else {
                await this.handleSubtaskFailure(subtask, result.validationResult.errors.join('; '));
            }
        }
        catch (error) {
            await this.handleSubtaskFailure(subtask, error.message);
        }
        finally {
            const runningIndex = this.executionState.runningSubtasks.indexOf(subtask.id);
            if (runningIndex >= 0) {
                this.executionState.runningSubtasks.splice(runningIndex, 1);
                this.executionState.progress.inProgress--;
            }
        }
    }
    async executeSubtaskWithRetries(subtask, agent) {
        const maxRetries = subtask.metadata?.validation?.maxRetries || 3;
        let lastResult = null;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            if (this.isHalted) {
                break;
            }
            while (this.isPaused && !this.isHalted) {
                await this.sleep(100);
            }
            try {
                const result = await this.dispatcher.dispatchSubtask(subtask, agent);
                if (result.result?.content) {
                    const validationResult = this.validator.validateOutput(subtask, result.result.content);
                    result.validationResult = validationResult;
                    for (const callback of this.validationCallbacks) {
                        try {
                            callback(subtask.id, validationResult);
                        }
                        catch (error) {
                            console.error('Error in validation callback:', error);
                        }
                    }
                    if (validationResult.passed) {
                        result.status = 'COMPLETED';
                        return result;
                    }
                    if (validationResult.shouldHalt) {
                        this.haltExecution(`Validation failed for subtask ${subtask.id}: ${validationResult.errors.join('; ')}`);
                        result.status = 'HALTED';
                        return result;
                    }
                    if (!validationResult.shouldRetry || attempt >= maxRetries) {
                        result.status = 'FAILED';
                        return result;
                    }
                    this.emitEvent(executionTypes_1.ExecutionEventType.SUBTASK_RETRYING, {
                        subtaskId: subtask.id,
                        attempt: attempt + 1,
                        maxRetries,
                        validationErrors: validationResult.errors
                    });
                    lastResult = result;
                }
                else {
                    result.status = 'FAILED';
                    return result;
                }
            }
            catch (error) {
                if (attempt < maxRetries) {
                    const fallbackAgent = this.findFallbackAgent(agent, subtask);
                    if (fallbackAgent) {
                        this.emitEvent(executionTypes_1.ExecutionEventType.AGENT_SWITCHED, {
                            subtaskId: subtask.id,
                            fromAgentId: agent.id,
                            toAgentId: fallbackAgent.id,
                            reason: 'Primary agent failed'
                        });
                        agent = fallbackAgent;
                    }
                }
            }
            this.executionState.retryCount[subtask.id] = attempt + 1;
        }
        return lastResult || {
            subtaskId: subtask.id,
            agentId: agent.id,
            validationResult: {
                passed: false,
                confidence: 0,
                ruleResults: [],
                shouldHalt: false,
                shouldRetry: false,
                errors: ['Max retries exceeded'],
                warnings: []
            },
            retryCount: maxRetries,
            executionTime: 0,
            status: 'FAILED'
        };
    }
    async handleSubtaskSuccess(subtask, result) {
        subtask.status = subtaskSchema_1.SubtaskStatus.COMPLETED;
        subtask.result = result.result;
        subtask.updatedAt = new Date();
        this.executionState.completedSubtasks.push(subtask.id);
        this.executionState.progress.completed++;
        this.emitEvent(executionTypes_1.ExecutionEventType.SUBTASK_COMPLETED, {
            subtaskId: subtask.id,
            agentId: result.agentId,
            executionTime: result.executionTime,
            confidence: result.validationResult.confidence
        });
    }
    async handleSubtaskFailure(subtask, errorMessage) {
        subtask.status = subtaskSchema_1.SubtaskStatus.FAILED;
        subtask.updatedAt = new Date();
        this.executionState.failedSubtasks.push(subtask.id);
        this.executionState.progress.failed++;
        const executionError = {
            type: 'VALIDATION_ERROR',
            message: errorMessage,
            subtaskId: subtask.id,
            timestamp: new Date(),
            retryable: false
        };
        this.executionState.errors.push(executionError);
        this.emitEvent(executionTypes_1.ExecutionEventType.SUBTASK_FAILED, {
            subtaskId: subtask.id,
            error: errorMessage
        });
        const failureRate = this.executionState.failedSubtasks.length /
            this.executionState.progress.total;
        if (failureRate > 0.5) {
            this.haltExecution(`Too many subtask failures (${Math.round(failureRate * 100)}%)`);
        }
    }
    findFallbackAgent(currentAgent, subtask) {
        for (const agent of this.agents.values()) {
            if (agent.id === currentAgent.id || !agent.availability) {
                continue;
            }
            const hasCompatibleCapability = agent.capabilities.some(cap => currentAgent.capabilities.some(currentCap => cap.category === currentCap.category));
            if (hasCompatibleCapability) {
                return agent;
            }
        }
        return null;
    }
    onExecutionEvent(callback) {
        this.eventCallbacks.push(callback);
    }
    onValidation(callback) {
        this.validationCallbacks.push(callback);
    }
    onHalt(callback) {
        this.haltCallbacks.push(callback);
    }
    removeExecutionEventCallback(callback) {
        const index = this.eventCallbacks.indexOf(callback);
        if (index >= 0) {
            this.eventCallbacks.splice(index, 1);
        }
    }
    removeValidationCallback(callback) {
        const index = this.validationCallbacks.indexOf(callback);
        if (index >= 0) {
            this.validationCallbacks.splice(index, 1);
        }
    }
    removeHaltCallback(callback) {
        const index = this.haltCallbacks.indexOf(callback);
        if (index >= 0) {
            this.haltCallbacks.splice(index, 1);
        }
    }
    getExecutionState() {
        return this.executionState;
    }
    getExecutionStats() {
        if (!this.executionState) {
            return {
                isRunning: false,
                isPaused: false,
                isHalted: false,
                progress: { completed: 0, failed: 0, inProgress: 0, total: 0 },
                errors: 0
            };
        }
        const duration = this.executionState.endTime ?
            this.executionState.endTime.getTime() - this.executionState.startTime.getTime() :
            Date.now() - this.executionState.startTime.getTime();
        return {
            isRunning: this.executionState.status === executionTypes_1.WorkflowExecutionStatus.RUNNING,
            isPaused: this.isPaused,
            isHalted: this.isHalted,
            progress: this.executionState.progress,
            duration,
            errors: this.executionState.errors.length
        };
    }
    emitEvent(type, data) {
        const event = {
            type,
            timestamp: new Date(),
            data
        };
        for (const callback of this.eventCallbacks) {
            try {
                callback(event);
            }
            catch (error) {
                console.error('Error in event callback:', error);
            }
        }
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.ExecutionController = ExecutionController;
//# sourceMappingURL=executionController.js.map