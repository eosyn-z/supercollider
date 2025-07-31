import { Subtask } from '../types/subtaskSchema';
import { Agent } from '../types/agentRegistry';
import { BatchResult, SubtaskExecutionResult, DispatchConfig } from '../types/executionTypes';
import { SecureApiKeyManager } from './apiKeyManager';
import { ResultStore } from './resultStore';
export declare class EnhancedDispatcher {
    private config;
    private runningSubtasks;
    private semaphore;
    private apiKeyManager;
    private resultStore;
    private executionOrderCounter;
    constructor(config?: Partial<DispatchConfig>, apiKeyManager?: SecureApiKeyManager, resultStore?: ResultStore);
    validateAgentKeys(agents: Agent[]): Promise<Map<string, boolean>>;
    dispatchBatch(batch: Subtask[], agent: Agent, workflowId: string, batchIndex?: number): Promise<BatchResult>;
    dispatchSubtask(subtask: Subtask, agent: Agent, workflowId: string, batchId: string, batchIndex: number): Promise<SubtaskExecutionResult>;
    private executeSingleAttempt;
    private callAgentApi;
    private buildApiRequest;
    private buildHeaders;
    private parseApiResponse;
    private saveSubtaskResult;
    private calculateExecutionLevel;
    private buildPrompt;
    private generateMockResponse;
    private shouldContinueMultipass;
    private waitForBatchSlot;
    private waitForAgentSlot;
    private releaseAgentSlot;
    cancelSubtask(subtaskId: string): boolean;
    cancelAll(): void;
    getStats(): {
        runningCount: number;
        agentLoad: Record<string, number>;
    };
    private generateId;
    private sleep;
    private chunkArray;
}
//# sourceMappingURL=enhancedDispatcher.d.ts.map