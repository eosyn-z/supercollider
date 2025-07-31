import { Workflow } from '../types/workflowSchema';
import { Agent } from '../types/agentRegistry';
import { ExecutionState, ExecutionEventCallback, ValidationCallback, HaltCallback } from '../types/executionTypes';
import { Dispatcher } from './dispatcher';
import { Validator } from './validator';
export declare class ExecutionController {
    private dispatcher;
    private validator;
    private executionState;
    private eventCallbacks;
    private validationCallbacks;
    private haltCallbacks;
    private agents;
    private isHalted;
    private isPaused;
    constructor(dispatcher?: Dispatcher, validator?: Validator);
    registerAgents(agents: Agent[]): void;
    startExecution(workflow: Workflow): Promise<void>;
    pauseExecution(): void;
    resumeExecution(): void;
    haltExecution(reason: string): void;
    private executeWorkflow;
    private executeBatch;
    private executeSubtask;
    private executeSubtaskWithRetries;
    private handleSubtaskSuccess;
    private handleSubtaskFailure;
    private findFallbackAgent;
    onExecutionEvent(callback: ExecutionEventCallback): void;
    onValidation(callback: ValidationCallback): void;
    onHalt(callback: HaltCallback): void;
    removeExecutionEventCallback(callback: ExecutionEventCallback): void;
    removeValidationCallback(callback: ValidationCallback): void;
    removeHaltCallback(callback: HaltCallback): void;
    getExecutionState(): ExecutionState | null;
    getExecutionStats(): {
        isRunning: boolean;
        isPaused: boolean;
        isHalted: boolean;
        progress: {
            completed: number;
            failed: number;
            inProgress: number;
            total: number;
        };
        duration?: number;
        errors: number;
    };
    private emitEvent;
    private sleep;
}
//# sourceMappingURL=executionController.d.ts.map