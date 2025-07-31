"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExecutionStateManager = void 0;
const executionTypes_1 = require("../types/executionTypes");
class ExecutionStateManager {
    constructor(resultStore, config = {}) {
        this.snapshots = new Map();
        this.activeWorkflows = new Map();
        this.snapshotTimers = new Map();
        this.resultStore = resultStore;
        this.config = {
            snapshotInterval: 60000,
            maxSnapshots: 50,
            enableAutoRecovery: true,
            recoveryTimeout: 300000,
            compressionEnabled: true,
            encryptionEnabled: false,
            ...config
        };
    }
    async initializeExecution(workflowId, subtasks, agents) {
        const executionState = {
            workflowId,
            status: executionTypes_1.ExecutionStatus.PENDING,
            subtasks: new Map(subtasks.map(task => [task.id, task])),
            completedSubtasks: new Set(),
            failedSubtasks: new Set(),
            currentBatch: [],
            batchHistory: [],
            startTime: new Date(),
            totalSubtasks: subtasks.length,
            agents: new Map(agents.map(agent => [agent.id, agent])),
            config: {},
            errors: []
        };
        this.activeWorkflows.set(workflowId, executionState);
        await this.createSnapshot(workflowId);
        this.startPeriodicSnapshotting(workflowId);
        return executionState;
    }
    async updateExecutionState(workflowId, updates, forceSnapshot = false) {
        const currentState = this.activeWorkflows.get(workflowId);
        if (!currentState) {
            throw new Error(`No active execution state found for workflow ${workflowId}`);
        }
        Object.assign(currentState, updates);
        currentState.lastUpdated = new Date();
        await this.resultStore.saveExecutionState(currentState);
        if (forceSnapshot) {
            await this.createSnapshot(workflowId);
        }
    }
    async createSnapshot(workflowId) {
        const executionState = this.activeWorkflows.get(workflowId);
        if (!executionState) {
            throw new Error(`No active execution state found for workflow ${workflowId}`);
        }
        const snapshotId = this.generateId();
        const subtaskProgress = await this.buildSubtaskProgress(workflowId);
        const batchProgress = await this.buildBatchProgress(workflowId);
        const agentAssignments = this.buildAgentAssignments(executionState);
        const checkpointData = await this.buildCheckpointData(workflowId);
        const snapshot = {
            workflowId,
            snapshotId,
            timestamp: new Date(),
            executionState: this.deepClone(executionState),
            subtaskProgress,
            batchProgress,
            agentAssignments,
            checkpointData
        };
        const workflowSnapshots = this.snapshots.get(workflowId) || [];
        workflowSnapshots.push(snapshot);
        if (workflowSnapshots.length > this.config.maxSnapshots) {
            workflowSnapshots.shift();
        }
        this.snapshots.set(workflowId, workflowSnapshots);
        if (this.config.compressionEnabled) {
            await this.compressSnapshot(snapshot);
        }
        return snapshotId;
    }
    async loadExecutionState(workflowId) {
        const persistedState = await this.resultStore.loadExecutionState(workflowId);
        if (persistedState) {
            this.activeWorkflows.set(workflowId, persistedState);
            return persistedState;
        }
        const workflowSnapshots = this.snapshots.get(workflowId);
        if (!workflowSnapshots || workflowSnapshots.length === 0) {
            return null;
        }
        const latestSnapshot = workflowSnapshots[workflowSnapshots.length - 1];
        const executionState = this.deepClone(latestSnapshot.executionState);
        this.activeWorkflows.set(workflowId, executionState);
        return executionState;
    }
    async analyzeRecoveryOptions(workflowId) {
        const workflowSnapshots = this.snapshots.get(workflowId);
        if (!workflowSnapshots || workflowSnapshots.length === 0) {
            return {
                canRecover: false,
                recoveryStrategy: 'restart',
                tasksToResume: [],
                tasksToRestart: [],
                tasksToSkip: [],
                estimatedRecoveryTime: 0,
                riskAssessment: {
                    dataLossRisk: 'high',
                    integrityRisk: 'high',
                    timeImpact: 0,
                    recommendations: ['No recovery data available - full restart required']
                }
            };
        }
        const latestSnapshot = workflowSnapshots[workflowSnapshots.length - 1];
        const crashAge = Date.now() - latestSnapshot.timestamp.getTime();
        const tasksToResume = [];
        const tasksToRestart = [];
        const tasksToSkip = [];
        for (const [subtaskId, progress] of latestSnapshot.subtaskProgress) {
            switch (progress.status) {
                case executionTypes_1.ExecutionStatus.COMPLETED:
                    tasksToSkip.push(subtaskId);
                    break;
                case executionTypes_1.ExecutionStatus.RUNNING:
                    if (crashAge < this.config.recoveryTimeout) {
                        tasksToResume.push(subtaskId);
                    }
                    else {
                        tasksToRestart.push(subtaskId);
                    }
                    break;
                case executionTypes_1.ExecutionStatus.FAILED:
                    if (progress.attempts < 3) {
                        tasksToRestart.push(subtaskId);
                    }
                    else {
                        tasksToSkip.push(subtaskId);
                    }
                    break;
                default:
                    tasksToRestart.push(subtaskId);
            }
        }
        let recoveryStrategy;
        if (tasksToResume.length > tasksToRestart.length) {
            recoveryStrategy = 'resume';
        }
        else if (tasksToSkip.length < latestSnapshot.subtaskProgress.size * 0.5) {
            recoveryStrategy = 'partial';
        }
        else {
            recoveryStrategy = 'restart';
        }
        const dataLossRisk = this.assessDataLossRisk(latestSnapshot, crashAge);
        const integrityRisk = this.assessIntegrityRisk(latestSnapshot);
        const timeImpact = this.estimateTimeImpact(tasksToRestart.length, tasksToResume.length);
        const recommendations = this.generateRecoveryRecommendations(recoveryStrategy, dataLossRisk, integrityRisk, crashAge);
        return {
            canRecover: true,
            recoveryStrategy,
            tasksToResume,
            tasksToRestart,
            tasksToSkip,
            estimatedRecoveryTime: timeImpact,
            riskAssessment: {
                dataLossRisk,
                integrityRisk,
                timeImpact,
                recommendations
            }
        };
    }
    async executeRecovery(workflowId, plan) {
        const latestSnapshot = this.getLatestSnapshot(workflowId);
        if (!latestSnapshot) {
            throw new Error(`No snapshot available for recovery of workflow ${workflowId}`);
        }
        const recoveredState = this.deepClone(latestSnapshot.executionState);
        switch (plan.recoveryStrategy) {
            case 'resume':
                await this.executeResumeRecovery(recoveredState, plan);
                break;
            case 'partial':
                await this.executePartialRecovery(recoveredState, plan);
                break;
            case 'restart':
                await this.executeRestartRecovery(recoveredState, plan);
                break;
        }
        recoveredState.status = executionTypes_1.ExecutionStatus.RUNNING;
        recoveredState.lastUpdated = new Date();
        recoveredState.errors = recoveredState.errors || [];
        recoveredState.errors.push({
            type: 'RECOVERY',
            message: `Workflow recovered using ${plan.recoveryStrategy} strategy`,
            agentId: 'system',
            timestamp: new Date(),
            retryable: false
        });
        this.activeWorkflows.set(workflowId, recoveredState);
        await this.resultStore.saveExecutionState(recoveredState);
        await this.createSnapshot(workflowId);
        return recoveredState;
    }
    async cleanupWorkflow(workflowId) {
        const timer = this.snapshotTimers.get(workflowId);
        if (timer) {
            clearInterval(timer);
            this.snapshotTimers.delete(workflowId);
        }
        this.activeWorkflows.delete(workflowId);
    }
    getExecutionStatistics(workflowId) {
        const state = this.activeWorkflows.get(workflowId);
        const snapshots = this.snapshots.get(workflowId) || [];
        if (!state) {
            return null;
        }
        return {
            workflowId,
            status: state.status,
            totalSubtasks: state.totalSubtasks,
            completedSubtasks: state.completedSubtasks.size,
            failedSubtasks: state.failedSubtasks.size,
            runningTime: Date.now() - state.startTime.getTime(),
            snapshotCount: snapshots.length,
            lastSnapshotAge: snapshots.length > 0 ?
                Date.now() - snapshots[snapshots.length - 1].timestamp.getTime() : null,
            memoryUsage: this.estimateMemoryUsage(state)
        };
    }
    startPeriodicSnapshotting(workflowId) {
        const timer = setInterval(async () => {
            try {
                await this.createSnapshot(workflowId);
            }
            catch (error) {
                console.error(`Failed to create periodic snapshot for ${workflowId}:`, error);
            }
        }, this.config.snapshotInterval);
        this.snapshotTimers.set(workflowId, timer);
    }
    async buildSubtaskProgress(workflowId) {
        const progress = new Map();
        const workflowResults = await this.resultStore.getWorkflowResults(workflowId);
        for (const result of workflowResults.subtaskResults) {
            progress.set(result.subtaskId, {
                subtaskId: result.subtaskId,
                status: result.status,
                attempts: result.retryCount,
                lastAttemptTime: result.storageTimestamp,
                lastError: result.validationResult.errors[0],
                estimatedCompletion: result.status === executionTypes_1.ExecutionStatus.COMPLETED ? 1.0 : 0.5
            });
        }
        return progress;
    }
    async buildBatchProgress(workflowId) {
        const progress = new Map();
        const workflowResults = await this.resultStore.getWorkflowResults(workflowId);
        for (const batch of workflowResults.batchMetadata) {
            const batchResults = workflowResults.subtaskResults.filter(r => r.batchId === batch.batchId);
            const completed = batchResults.filter(r => r.status === executionTypes_1.ExecutionStatus.COMPLETED).length;
            const failed = batchResults.filter(r => r.status === executionTypes_1.ExecutionStatus.FAILED).length;
            progress.set(batch.batchId, {
                batchId: batch.batchId,
                totalSubtasks: batch.subtaskIds.length,
                completedSubtasks: completed,
                failedSubtasks: failed,
                startTime: batch.startTime,
                estimatedEndTime: batch.endTime,
                agentId: batch.assignedAgentId
            });
        }
        return progress;
    }
    buildAgentAssignments(state) {
        const assignments = new Map();
        return assignments;
    }
    async buildCheckpointData(workflowId) {
        const workflowResults = await this.resultStore.getWorkflowResults(workflowId);
        const failedResults = workflowResults.subtaskResults.filter(r => r.status === executionTypes_1.ExecutionStatus.FAILED);
        return {
            recoveryStrategy: 'resume',
            failureCount: failedResults.length,
            lastFailureReason: failedResults[failedResults.length - 1]?.validationResult.errors[0],
            criticalErrors: failedResults
                .filter(r => !r.validationResult.shouldRetry)
                .map(r => r.validationResult.errors[0])
                .filter(Boolean),
            memoryState: {}
        };
    }
    assessDataLossRisk(snapshot, crashAge) {
        if (crashAge < 60000)
            return 'low';
        if (crashAge < 300000)
            return 'medium';
        return 'high';
    }
    assessIntegrityRisk(snapshot) {
        const criticalErrors = snapshot.checkpointData.criticalErrors.length;
        const failureCount = snapshot.checkpointData.failureCount;
        if (criticalErrors === 0 && failureCount < 3)
            return 'low';
        if (criticalErrors < 2 && failureCount < 10)
            return 'medium';
        return 'high';
    }
    estimateTimeImpact(restartCount, resumeCount) {
        return (restartCount * 5) + (resumeCount * 1);
    }
    generateRecoveryRecommendations(strategy, dataLossRisk, integrityRisk, crashAge) {
        const recommendations = [];
        recommendations.push(`Recovery strategy: ${strategy}`);
        if (dataLossRisk === 'high') {
            recommendations.push('High data loss risk - consider manual verification');
        }
        if (integrityRisk === 'high') {
            recommendations.push('High integrity risk - full validation recommended');
        }
        if (crashAge > 600000) {
            recommendations.push('Long crash duration - consider fresh restart');
        }
        return recommendations;
    }
    getLatestSnapshot(workflowId) {
        const snapshots = this.snapshots.get(workflowId);
        return snapshots && snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
    }
    async executeResumeRecovery(state, plan) {
        for (const taskId of plan.tasksToResume) {
            if (state.subtasks.has(taskId)) {
                const task = state.subtasks.get(taskId);
                task.status = SubtaskStatus.PENDING;
                task.updatedAt = new Date();
            }
        }
    }
    async executePartialRecovery(state, plan) {
        for (const taskId of plan.tasksToRestart) {
            if (state.subtasks.has(taskId)) {
                const task = state.subtasks.get(taskId);
                task.status = SubtaskStatus.PENDING;
                task.updatedAt = new Date();
            }
        }
        for (const taskId of plan.tasksToSkip) {
            state.completedSubtasks.add(taskId);
        }
    }
    async executeRestartRecovery(state, plan) {
        for (const [taskId, task] of state.subtasks) {
            task.status = SubtaskStatus.PENDING;
            task.updatedAt = new Date();
        }
        state.completedSubtasks.clear();
        state.failedSubtasks.clear();
    }
    async compressSnapshot(snapshot) {
    }
    deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }
    estimateMemoryUsage(state) {
        return JSON.stringify(state).length * 2;
    }
    generateId() {
        return Math.random().toString(36).substring(2, 15);
    }
}
exports.ExecutionStateManager = ExecutionStateManager;
//# sourceMappingURL=executionStateManager.js.map