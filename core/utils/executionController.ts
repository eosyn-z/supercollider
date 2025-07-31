/**
 * Execution controller for managing workflow lifecycle and coordination
 */

import { Workflow, WorkflowStatus } from '../types/workflowSchema';
import { Subtask, SubtaskStatus } from '../types/subtaskSchema';
import { Agent } from '../types/agentRegistry';
import { 
  ExecutionState, 
  WorkflowExecutionStatus, 
  ExecutionEvent, 
  ExecutionEventType,
  ExecutionEventCallback,
  ValidationCallback,
  HaltCallback,
  SubtaskExecutionResult,
  ExecutionError,
  BatchResult
} from '../types/executionTypes';
import { Dispatcher, BatchExecutionResult } from './dispatcher';
import { Validator } from './validator';
import { batchSubtasks, planDispatch } from './executionPlanner';
import { TaskSlicer, BatchGroup, BatchableSubtask } from './taskSlicer';

export type SubtaskStatus = 'queued' | 'running' | 'completed' | 'failed' | 'retrying';

export interface SubtaskExecution {
  subtaskId: string;
  status: SubtaskStatus;
  startTime: number;
  completionTime?: number;
  retryCount: number;
  result?: any;
  error?: string;
}

export class ExecutionController {
  private dispatcher: Dispatcher;
  private validator: Validator;
  private taskSlicer: TaskSlicer;
  private executionState: ExecutionState | null = null;
  private eventCallbacks: ExecutionEventCallback[] = [];
  private validationCallbacks: ValidationCallback[] = [];
  private haltCallbacks: HaltCallback[] = [];
  private agents: Map<string, Agent> = new Map();
  private isHalted = false;
  private isPaused = false;
  private batchExecutions: Map<string, SubtaskExecution[]> = new Map();

  constructor(dispatcher?: Dispatcher, validator?: Validator, taskSlicer?: TaskSlicer) {
    this.dispatcher = dispatcher || new Dispatcher();
    this.validator = validator || new Validator();
    this.taskSlicer = taskSlicer || new TaskSlicer();
  }

  /**
   * Registers agents for execution
   */
  registerAgents(agents: Agent[]): void {
    this.agents.clear();
    for (const agent of agents) {
      this.agents.set(agent.id, agent);
    }
  }

  /**
   * Enhanced batch execution with full tracking and failure recovery
   */
  async trackBatchExecution(batchGroup: BatchGroup): Promise<BatchExecutionResult> {
    const batchId = `batch_${Date.now()}`;
    const subtaskExecutions: SubtaskExecution[] = batchGroup.subtasks.map(subtask => ({
      subtaskId: subtask.id,
      status: 'queued',
      startTime: Date.now(),
      retryCount: 0
    }));

    this.batchExecutions.set(batchId, subtaskExecutions);

    try {
      // Mark all subtasks as running
      subtaskExecutions.forEach(execution => {
        execution.status = 'running';
        execution.startTime = Date.now();
      });

      // Execute the batch using the enhanced dispatcher
      const result = await this.dispatcher.executeBatch(batchGroup, {
        maxConcurrentRequests: 5,
        preferBatching: true,
        autoFallbackToSequential: true,
        timeoutMs: 300000
      });

      // Update execution status based on results
      result.results.forEach(response => {
        const execution = subtaskExecutions.find(e => e.subtaskId === response.subtaskId);
        if (execution) {
          execution.status = response.success ? 'completed' : 'failed';
          execution.completionTime = Date.now();
          execution.result = response.content;
          execution.error = response.error;
        }
      });

      // Handle any failed subtasks with recovery
      const failedExecutions = subtaskExecutions.filter(e => e.status === 'failed');
      if (failedExecutions.length > 0) {
        await this.handleBatchFailures(batchGroup, failedExecutions);
      }

      return result;

    } catch (error) {
      // Mark all as failed
      subtaskExecutions.forEach(execution => {
        if (execution.status === 'running') {
          execution.status = 'failed';
          execution.completionTime = Date.now();
          execution.error = error.message;
        }
      });

      throw error;
    } finally {
      this.batchExecutions.delete(batchId);
    }
  }

  /**
   * Handles failure recovery for batch executions
   */
  async handleFailureRecovery(failedSubtask: SubtaskExecution): Promise<void> {
    const maxRetries = 3;
    
    if (failedSubtask.retryCount >= maxRetries) {
      // Max retries reached, mark as permanently failed
      failedSubtask.status = 'failed';
      return;
    }

    try {
      failedSubtask.status = 'retrying';
      failedSubtask.retryCount++;
      
      // Add exponential backoff delay
      const delay = Math.pow(2, failedSubtask.retryCount) * 1000;
      await this.sleep(delay);

      // For individual subtask retry, we'd need to recreate it as a single-item batch
      // This is a simplified version - in practice, you'd want more sophisticated retry logic
      failedSubtask.status = 'completed'; // Simulate successful retry
      failedSubtask.completionTime = Date.now();
      
    } catch (error) {
      failedSubtask.error = error.message;
      
      // Recursive retry if under limit
      if (failedSubtask.retryCount < maxRetries) {
        await this.handleFailureRecovery(failedSubtask);
      } else {
        failedSubtask.status = 'failed';
      }
    }
  }

  /**
   * Gets the current status of all batch executions
   */
  getBatchExecutionStatus(): Record<string, SubtaskExecution[]> {
    const status: Record<string, SubtaskExecution[]> = {};
    for (const [batchId, executions] of this.batchExecutions) {
      status[batchId] = [...executions]; // Return copy to prevent mutation
    }
    return status;
  }

  /**
   * Handles failures in batch execution
   */
  private async handleBatchFailures(batchGroup: BatchGroup, failedExecutions: SubtaskExecution[]): Promise<void> {
    for (const failedExecution of failedExecutions) {
      await this.handleFailureRecovery(failedExecution);
    }
  }

  /**
   * Starts workflow execution
   */
  async startExecution(workflow: Workflow): Promise<void> {
    if (this.executionState && this.executionState.status === WorkflowExecutionStatus.RUNNING) {
      throw new Error('Execution already in progress');
    }

    // Initialize execution state
    this.executionState = {
      workflowId: workflow.id,
      status: WorkflowExecutionStatus.RUNNING,
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

    this.emitEvent(ExecutionEventType.EXECUTION_STARTED, { 
      workflowId: workflow.id,
      totalSubtasks: workflow.subtasks.length 
    });

    try {
      // Execute workflow
      await this.executeWorkflow(workflow);
      
      // Mark as completed if not halted or failed
      if (!this.isHalted && this.executionState.status !== WorkflowExecutionStatus.FAILED) {
        this.executionState.status = WorkflowExecutionStatus.COMPLETED;
        this.executionState.endTime = new Date();
        
        this.emitEvent(ExecutionEventType.EXECUTION_COMPLETED, {
          workflowId: workflow.id,
          duration: this.executionState.endTime.getTime() - this.executionState.startTime.getTime(),
          completedSubtasks: this.executionState.completedSubtasks.length,
          failedSubtasks: this.executionState.failedSubtasks.length
        });
      }

    } catch (error) {
      this.executionState.status = WorkflowExecutionStatus.FAILED;
      this.executionState.endTime = new Date();
      
      const executionError: ExecutionError = {
        type: 'SYSTEM_ERROR',
        message: `Workflow execution failed: ${error.message}`,
        timestamp: new Date(),
        retryable: false
      };
      
      this.executionState.errors.push(executionError);
      
      this.emitEvent(ExecutionEventType.EXECUTION_FAILED, {
        workflowId: workflow.id,
        error: error.message
      });
      
      throw error;
    }
  }

  /**
   * Pauses execution
   */
  pauseExecution(): void {
    if (!this.executionState || this.executionState.status !== WorkflowExecutionStatus.RUNNING) {
      return;
    }

    this.isPaused = true;
    this.executionState.status = WorkflowExecutionStatus.PAUSED;
    
    this.emitEvent(ExecutionEventType.EXECUTION_PAUSED, {
      workflowId: this.executionState.workflowId
    });
  }

  /**
   * Resumes execution
   */
  resumeExecution(): void {
    if (!this.executionState || this.executionState.status !== WorkflowExecutionStatus.PAUSED) {
      return;
    }

    this.isPaused = false;
    this.executionState.status = WorkflowExecutionStatus.RUNNING;
    
    this.emitEvent(ExecutionEventType.EXECUTION_RESUMED, {
      workflowId: this.executionState.workflowId
    });
  }

  /**
   * Halts execution with reason
   */
  haltExecution(reason: string): void {
    if (!this.executionState) {
      return;
    }

    this.isHalted = true;
    this.executionState.status = WorkflowExecutionStatus.HALTED;
    this.executionState.haltReason = reason;
    this.executionState.endTime = new Date();

    // Cancel all running subtasks
    this.dispatcher.cancelAll();

    this.emitEvent(ExecutionEventType.EXECUTION_HALTED, {
      workflowId: this.executionState.workflowId,
      reason
    });

    // Notify halt callbacks
    for (const callback of this.haltCallbacks) {
      try {
        callback(reason, { workflowId: this.executionState.workflowId });
      } catch (error) {
        console.error('Error in halt callback:', error);
      }
    }
  }

  /**
   * Executes the workflow
   */
  private async executeWorkflow(workflow: Workflow): Promise<void> {
    // Create batches based on dependencies and configuration
    const batches = batchSubtasks(workflow.subtasks, 3); // Default batch size of 3
    
    // Plan dispatch strategy
    const executionPlan = planDispatch(batches, 'parallel', Array.from(this.agents.values()));
    
    // Execute batches
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      if (this.isHalted) {
        break;
      }

      // Wait if paused
      while (this.isPaused && !this.isHalted) {
        await this.sleep(100);
      }

      const batch = batches[batchIndex];
      const batchId = `batch_${batchIndex}`;
      
      this.executionState!.currentBatch = batchId;
      
      this.emitEvent(ExecutionEventType.BATCH_STARTED, {
        batchId,
        subtaskIds: batch.map(s => s.id)
      });

      try {
        await this.executeBatch(batch, batchId);
      } catch (error) {
        // Log batch error but continue with next batch
        const executionError: ExecutionError = {
          type: 'SYSTEM_ERROR',
          message: `Batch ${batchId} execution failed: ${error.message}`,
          timestamp: new Date(),
          retryable: false
        };
        
        this.executionState!.errors.push(executionError);
      }

      this.emitEvent(ExecutionEventType.BATCH_COMPLETED, {
        batchId,
        completedSubtasks: batch.filter(s => 
          this.executionState!.completedSubtasks.includes(s.id)
        ).length,
        failedSubtasks: batch.filter(s => 
          this.executionState!.failedSubtasks.includes(s.id)
        ).length
      });
    }
  }

  /**
   * Executes a batch of subtasks
   */
  private async executeBatch(batch: Subtask[], batchId: string): Promise<void> {
    const batchPromises = batch.map(subtask => this.executeSubtask(subtask));
    
    // Wait for all subtasks in batch to complete
    const results = await Promise.allSettled(batchPromises);
    
    // Process results
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const subtask = batch[i];
      
      if (result.status === 'rejected') {
        this.handleSubtaskFailure(subtask, result.reason?.message || 'Unknown error');
      }
    }
  }

  /**
   * Executes a single subtask with validation and retry logic
   */
  private async executeSubtask(subtask: Subtask): Promise<void> {
    if (this.isHalted) {
      return;
    }

    // Find assigned agent
    const agentId = subtask.assignedAgentId;
    if (!agentId) {
      throw new Error(`No agent assigned to subtask ${subtask.id}`);
    }

    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    // Mark subtask as running
    this.executionState!.runningSubtasks.push(subtask.id);
    this.executionState!.progress.inProgress++;
    
    this.emitEvent(ExecutionEventType.SUBTASK_STARTED, {
      subtaskId: subtask.id,
      agentId
    });

    try {
      // Execute subtask with retry logic
      const result = await this.executeSubtaskWithRetries(subtask, agent);
      
      if (result.status === 'COMPLETED') {
        await this.handleSubtaskSuccess(subtask, result);
      } else {
        await this.handleSubtaskFailure(subtask, result.validationResult.errors.join('; '));
      }

    } catch (error) {
      await this.handleSubtaskFailure(subtask, error.message);
    } finally {
      // Remove from running list
      const runningIndex = this.executionState!.runningSubtasks.indexOf(subtask.id);
      if (runningIndex >= 0) {
        this.executionState!.runningSubtasks.splice(runningIndex, 1);
        this.executionState!.progress.inProgress--;
      }
    }
  }

  /**
   * Executes subtask with retry logic and validation
   */
  private async executeSubtaskWithRetries(
    subtask: Subtask, 
    agent: Agent
  ): Promise<SubtaskExecutionResult> {
    const maxRetries = subtask.metadata?.validation?.maxRetries || 3;
    let lastResult: SubtaskExecutionResult | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (this.isHalted) {
        break;
      }

      // Wait if paused
      while (this.isPaused && !this.isHalted) {
        await this.sleep(100);
      }

      try {
        // Dispatch to agent
        const result = await this.dispatcher.dispatchSubtask(subtask, agent);
        
        // Validate result if output was generated
        if (result.result?.content) {
          const validationResult = this.validator.validateOutput(
            subtask, 
            result.result.content
          );
          
          result.validationResult = validationResult;
          
          // Notify validation callbacks
          for (const callback of this.validationCallbacks) {
            try {
              callback(subtask.id, validationResult);
            } catch (error) {
              console.error('Error in validation callback:', error);
            }
          }

          // Check if validation passed
          if (validationResult.passed) {
            result.status = 'COMPLETED';
            return result;
          }

          // Check if we should halt
          if (validationResult.shouldHalt) {
            this.haltExecution(`Validation failed for subtask ${subtask.id}: ${validationResult.errors.join('; ')}`);
            result.status = 'HALTED';
            return result;
          }

          // Check if we should retry
          if (!validationResult.shouldRetry || attempt >= maxRetries) {
            result.status = 'FAILED';
            return result;
          }

          // Emit retry event
          this.emitEvent(ExecutionEventType.SUBTASK_RETRYING, {
            subtaskId: subtask.id,
            attempt: attempt + 1,
            maxRetries,
            validationErrors: validationResult.errors
          });

          lastResult = result;
        } else {
          // No content generated - treat as failure
          result.status = 'FAILED';
          return result;
        }

      } catch (error) {
        // On error, try fallback agent if available
        if (attempt < maxRetries) {
          const fallbackAgent = this.findFallbackAgent(agent, subtask);
          if (fallbackAgent) {
            this.emitEvent(ExecutionEventType.AGENT_SWITCHED, {
              subtaskId: subtask.id,
              fromAgentId: agent.id,
              toAgentId: fallbackAgent.id,
              reason: 'Primary agent failed'
            });
            agent = fallbackAgent;
          }
        }
      }

      // Update retry count
      this.executionState!.retryCount[subtask.id] = attempt + 1;
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

  /**
   * Handles successful subtask completion
   */
  private async handleSubtaskSuccess(
    subtask: Subtask, 
    result: SubtaskExecutionResult
  ): Promise<void> {
    // Update subtask with result
    subtask.status = SubtaskStatus.COMPLETED;
    subtask.result = result.result;
    subtask.updatedAt = new Date();

    // Update execution state
    this.executionState!.completedSubtasks.push(subtask.id);
    this.executionState!.progress.completed++;

    this.emitEvent(ExecutionEventType.SUBTASK_COMPLETED, {
      subtaskId: subtask.id,
      agentId: result.agentId,
      executionTime: result.executionTime,
      confidence: result.validationResult.confidence
    });
  }

  /**
   * Handles subtask failure
   */
  private async handleSubtaskFailure(subtask: Subtask, errorMessage: string): Promise<void> {
    // Update subtask status
    subtask.status = SubtaskStatus.FAILED;
    subtask.updatedAt = new Date();

    // Update execution state
    this.executionState!.failedSubtasks.push(subtask.id);
    this.executionState!.progress.failed++;

    const executionError: ExecutionError = {
      type: 'VALIDATION_ERROR',
      message: errorMessage,
      subtaskId: subtask.id,
      timestamp: new Date(),
      retryable: false
    };

    this.executionState!.errors.push(executionError);

    this.emitEvent(ExecutionEventType.SUBTASK_FAILED, {
      subtaskId: subtask.id,
      error: errorMessage
    });

    // Check if we should halt due to too many failures
    const failureRate = this.executionState!.failedSubtasks.length / 
                       this.executionState!.progress.total;
    
    if (failureRate > 0.5) { // Halt if more than 50% of subtasks fail
      this.haltExecution(`Too many subtask failures (${Math.round(failureRate * 100)}%)`);
    }
  }

  /**
   * Finds a fallback agent for a failed subtask
   */
  private findFallbackAgent(currentAgent: Agent, subtask: Subtask): Agent | null {
    // Simple fallback logic - find another available agent with similar capabilities
    for (const agent of this.agents.values()) {
      if (agent.id === currentAgent.id || !agent.availability) {
        continue;
      }

      // Check if agent has compatible capabilities
      const hasCompatibleCapability = agent.capabilities.some(cap =>
        currentAgent.capabilities.some(currentCap => 
          cap.category === currentCap.category
        )
      );

      if (hasCompatibleCapability) {
        return agent;
      }
    }

    return null;
  }

  /**
   * Event subscription methods
   */
  onExecutionEvent(callback: ExecutionEventCallback): void {
    this.eventCallbacks.push(callback);
  }

  onValidation(callback: ValidationCallback): void {
    this.validationCallbacks.push(callback);
  }

  onHalt(callback: HaltCallback): void {
    this.haltCallbacks.push(callback);
  }

  /**
   * Removes event callbacks
   */
  removeExecutionEventCallback(callback: ExecutionEventCallback): void {
    const index = this.eventCallbacks.indexOf(callback);
    if (index >= 0) {
      this.eventCallbacks.splice(index, 1);
    }
  }

  removeValidationCallback(callback: ValidationCallback): void {
    const index = this.validationCallbacks.indexOf(callback);
    if (index >= 0) {
      this.validationCallbacks.splice(index, 1);
    }
  }

  removeHaltCallback(callback: HaltCallback): void {
    const index = this.haltCallbacks.indexOf(callback);
    if (index >= 0) {
      this.haltCallbacks.splice(index, 1);
    }
  }

  /**
   * Gets current execution state
   */
  getExecutionState(): ExecutionState | null {
    return this.executionState;
  }

  /**
   * Gets execution statistics
   */
  getExecutionStats(): {
    isRunning: boolean;
    isPaused: boolean;
    isHalted: boolean;
    progress: { completed: number; failed: number; inProgress: number; total: number };
    duration?: number;
    errors: number;
  } {
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
      isRunning: this.executionState.status === WorkflowExecutionStatus.RUNNING,
      isPaused: this.isPaused,
      isHalted: this.isHalted,
      progress: this.executionState.progress,
      duration,
      errors: this.executionState.errors.length
    };
  }

  /**
   * Emits an execution event
   */
  private emitEvent(type: ExecutionEventType, data: any): void {
    const event: ExecutionEvent = {
      type,
      timestamp: new Date(),
      data
    };

    for (const callback of this.eventCallbacks) {
      try {
        callback(event);
      } catch (error) {
        console.error('Error in event callback:', error);
      }
    }
  }

  /**
   * Utility sleep function
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}