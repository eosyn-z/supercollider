import { Subtask } from '../types/subtaskSchema';
import { Agent } from '../types/agentRegistry';
export interface CycleDetectionResult {
    hasCycles: boolean;
    cycles: string[][];
    affectedSubtasks: string[];
    suggestions: string[];
}
export interface BatchingConfig {
    maxBatchSize: number;
    maxPromptLength: number;
    maxTokensPerBatch: number;
    allowPartialBatching: boolean;
    respectDependencies: boolean;
    balanceWorkloads: boolean;
}
export interface LargePromptBatchingResult {
    batches: Subtask[][];
    oversizedTasks: Subtask[];
    totalTokenCount: number;
    batchStatistics: {
        averageBatchSize: number;
        averageTokensPerBatch: number;
        maxTokensInBatch: number;
        dependencyViolations: number;
    };
}
export interface ExecutionPlan {
    orderedBatches: Subtask[][];
    assignedAgents: Record<string, string>;
    dependencyTree: DependencyNode[];
    estimatedTotalDuration: number;
}
export interface DependencyNode {
    subtaskId: string;
    dependencies: string[];
    dependents: string[];
    level: number;
}
export declare function batchSubtasksAdvanced(subtasks: Subtask[], config: BatchingConfig): LargePromptBatchingResult;
export declare function batchSubtasks(subtasks: Subtask[], range: number): Subtask[][];
export declare function planDispatch(subtaskBatches: Subtask[][], strategy: 'parallel' | 'serial', agents: Agent[]): ExecutionPlan;
export declare function detectDependencyCycles(subtasks: Subtask[]): CycleDetectionResult;
export declare function validateBatching(batches: Subtask[][]): boolean;
export declare function optimizeBatches(batches: Subtask[][], agents: Agent[], strategy: 'parallel' | 'serial'): Subtask[][];
//# sourceMappingURL=executionPlanner.d.ts.map