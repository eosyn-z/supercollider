import { SubtaskExecutionResult, ExecutionState, ExecutionStatus } from '../types/executionTypes';
export interface StoredSubtaskResult extends SubtaskExecutionResult {
    workflowId: string;
    batchId: string;
    batchIndex: number;
    executionOrder: number;
    dependencyChain: string[];
    parentSubtaskIds: string[];
    childSubtaskIds: string[];
    executionLevel: number;
    storageTimestamp: Date;
    checksum: string;
}
export interface BatchMetadata {
    batchId: string;
    workflowId: string;
    batchIndex: number;
    strategy: 'parallel' | 'serial';
    startTime: Date;
    endTime?: Date;
    subtaskIds: string[];
    assignedAgentId: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
}
export interface WorkflowResults {
    workflowId: string;
    subtaskResults: StoredSubtaskResult[];
    batchMetadata: BatchMetadata[];
    executionOrder: number[];
    totalDuration: number;
    completedAt?: Date;
}
export interface ReintegrationData {
    workflowId: string;
    subtaskResults: StoredSubtaskResult[];
    executionOrder: number[];
    dependencyGraph: DependencyNode[];
    batchMetadata: BatchMetadata[];
    executionSummary: {
        totalSubtasks: number;
        completed: number;
        failed: number;
        totalDuration: number;
        averageExecutionTime: number;
    };
}
export interface DependencyNode {
    subtaskId: string;
    dependencies: string[];
    dependents: string[];
    level: number;
}
export interface ResultQuery {
    workflowId?: string;
    subtaskId?: string;
    batchId?: string;
    status?: ExecutionStatus;
    agentId?: string;
    dateRange?: {
        start: Date;
        end: Date;
    };
    limit?: number;
    offset?: number;
}
export interface ResultStore {
    saveSubtaskResult(result: StoredSubtaskResult): Promise<void>;
    updateSubtaskStatus(subtaskId: string, status: ExecutionStatus): Promise<void>;
    getSubtaskResult(subtaskId: string): Promise<StoredSubtaskResult | null>;
    saveExecutionState(state: ExecutionState): Promise<void>;
    loadExecutionState(workflowId: string): Promise<ExecutionState | null>;
    getWorkflowResults(workflowId: string): Promise<WorkflowResults>;
    saveBatchMetadata(metadata: BatchMetadata): Promise<void>;
    updateBatchStatus(batchId: string, status: BatchMetadata['status']): Promise<void>;
    getBatchResults(batchId: string): Promise<StoredSubtaskResult[]>;
    queryResults(query: ResultQuery): Promise<StoredSubtaskResult[]>;
    getReintegrationData(workflowId: string): Promise<ReintegrationData>;
    cleanup(olderThan: Date): Promise<number>;
    validateIntegrity(workflowId: string): Promise<boolean>;
}
export declare class InMemoryResultStore implements ResultStore {
    private subtaskResults;
    private executionStates;
    private batchMetadata;
    private workflowIndex;
    private executionOrderCounter;
    saveSubtaskResult(result: StoredSubtaskResult): Promise<void>;
    updateSubtaskStatus(subtaskId: string, status: ExecutionStatus): Promise<void>;
    getSubtaskResult(subtaskId: string): Promise<StoredSubtaskResult | null>;
    saveExecutionState(state: ExecutionState): Promise<void>;
    loadExecutionState(workflowId: string): Promise<ExecutionState | null>;
    getWorkflowResults(workflowId: string): Promise<WorkflowResults>;
    saveBatchMetadata(metadata: BatchMetadata): Promise<void>;
    updateBatchStatus(batchId: string, status: BatchMetadata['status']): Promise<void>;
    getBatchResults(batchId: string): Promise<StoredSubtaskResult[]>;
    queryResults(query: ResultQuery): Promise<StoredSubtaskResult[]>;
    getReintegrationData(workflowId: string): Promise<ReintegrationData>;
    cleanup(olderThan: Date): Promise<number>;
    validateIntegrity(workflowId: string): Promise<boolean>;
    createStoredResult(result: SubtaskExecutionResult, workflowId: string, batchId: string, batchIndex: number, dependencyChain?: string[], parentSubtaskIds?: string[], childSubtaskIds?: string[], executionLevel?: number): StoredSubtaskResult;
    private buildDependencyGraph;
    private calculateChecksum;
    private rebuildWorkflowIndex;
}
export declare class DatabaseResultStore implements ResultStore {
    private dbConnection;
    constructor(dbConnection: any);
    saveSubtaskResult(result: StoredSubtaskResult): Promise<void>;
    updateSubtaskStatus(subtaskId: string, status: ExecutionStatus): Promise<void>;
    getSubtaskResult(subtaskId: string): Promise<StoredSubtaskResult | null>;
    saveExecutionState(state: ExecutionState): Promise<void>;
    loadExecutionState(workflowId: string): Promise<ExecutionState | null>;
    getWorkflowResults(workflowId: string): Promise<WorkflowResults>;
    saveBatchMetadata(metadata: BatchMetadata): Promise<void>;
    updateBatchStatus(batchId: string, status: BatchMetadata['status']): Promise<void>;
    getBatchResults(batchId: string): Promise<StoredSubtaskResult[]>;
    queryResults(query: ResultQuery): Promise<StoredSubtaskResult[]>;
    getReintegrationData(workflowId: string): Promise<ReintegrationData>;
    cleanup(olderThan: Date): Promise<number>;
    validateIntegrity(workflowId: string): Promise<boolean>;
}
//# sourceMappingURL=resultStore.d.ts.map