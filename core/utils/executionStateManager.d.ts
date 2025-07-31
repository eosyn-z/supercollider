import { ExecutionState, ExecutionStatus } from '../types/executionTypes';
import { Subtask } from '../types/subtaskSchema';
import { Agent } from '../types/agentRegistry';
import { ResultStore } from './resultStore';
export interface ExecutionSnapshot {
    workflowId: string;
    snapshotId: string;
    timestamp: Date;
    executionState: ExecutionState;
    subtaskProgress: Map<string, SubtaskProgressInfo>;
    batchProgress: Map<string, BatchProgressInfo>;
    agentAssignments: Map<string, string>;
    checkpointData: CheckpointData;
}
export interface SubtaskProgressInfo {
    subtaskId: string;
    status: ExecutionStatus;
    attempts: number;
    lastAttemptTime?: Date;
    lastError?: string;
    partialResult?: any;
    estimatedCompletion: number;
}
export interface BatchProgressInfo {
    batchId: string;
    totalSubtasks: number;
    completedSubtasks: number;
    failedSubtasks: number;
    startTime: Date;
    estimatedEndTime?: Date;
    agentId: string;
}
export interface CheckpointData {
    lastSuccessfulBatch?: string;
    recoveryStrategy: 'resume' | 'restart' | 'partial';
    failureCount: number;
    lastFailureReason?: string;
    criticalErrors: string[];
    memoryState: Record<string, any>;
}
export interface RecoveryPlan {
    canRecover: boolean;
    recoveryStrategy: 'resume' | 'restart' | 'partial';
    tasksToResume: string[];
    tasksToRestart: string[];
    tasksToSkip: string[];
    estimatedRecoveryTime: number;
    riskAssessment: {
        dataLossRisk: 'low' | 'medium' | 'high';
        integrityRisk: 'low' | 'medium' | 'high';
        timeImpact: number;
        recommendations: string[];
    };
}
export interface StateManagerConfig {
    snapshotInterval: number;
    maxSnapshots: number;
    enableAutoRecovery: boolean;
    recoveryTimeout: number;
    compressionEnabled: boolean;
    encryptionEnabled: boolean;
}
export declare class ExecutionStateManager {
    private snapshots;
    private activeWorkflows;
    private resultStore;
    private config;
    private snapshotTimers;
    constructor(resultStore: ResultStore, config?: Partial<StateManagerConfig>);
    initializeExecution(workflowId: string, subtasks: Subtask[], agents: Agent[]): Promise<ExecutionState>;
    updateExecutionState(workflowId: string, updates: Partial<ExecutionState>, forceSnapshot?: boolean): Promise<void>;
    createSnapshot(workflowId: string): Promise<string>;
    loadExecutionState(workflowId: string): Promise<ExecutionState | null>;
    analyzeRecoveryOptions(workflowId: string): Promise<RecoveryPlan>;
    executeRecovery(workflowId: string, plan: RecoveryPlan): Promise<ExecutionState>;
    cleanupWorkflow(workflowId: string): Promise<void>;
    getExecutionStatistics(workflowId: string): any;
    private startPeriodicSnapshotting;
    private buildSubtaskProgress;
    private buildBatchProgress;
    private buildAgentAssignments;
    private buildCheckpointData;
    private assessDataLossRisk;
    private assessIntegrityRisk;
    private estimateTimeImpact;
    private generateRecoveryRecommendations;
    private getLatestSnapshot;
    private executeResumeRecovery;
    private executePartialRecovery;
    private executeRestartRecovery;
    private compressSnapshot;
    private deepClone;
    private estimateMemoryUsage;
    private generateId;
}
//# sourceMappingURL=executionStateManager.d.ts.map