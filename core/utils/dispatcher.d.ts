import { Subtask } from '../types/subtaskSchema';
import { Agent } from '../types/agentRegistry';
import { BatchResult, SubtaskExecutionResult, DispatchConfig } from '../types/executionTypes';
export declare class Dispatcher {
    private config;
    private runningSubtasks;
    private semaphore;
    constructor(config?: Partial<DispatchConfig>);
    dispatchBatch(batch: Subtask[], agent: Agent): Promise<BatchResult>;
    dispatchSubtask(subtask: Subtask, agent: Agent): Promise<SubtaskExecutionResult>;
    private executeSingleAttempt;
    private callAgentApi;
    private buildPrompt;
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
//# sourceMappingURL=dispatcher.d.ts.map