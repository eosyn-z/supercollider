/**
 * Simplified workflow execution service without core dependencies
 */

import { EventEmitter } from 'events';
import { Agent } from './AgentService';

export interface WorkflowExecutionRequest {
  workflowId: string;
  config?: {
    concurrency?: {
      maxConcurrentSubtasks: number;
      maxConcurrentBatches: number;
    };
    retry?: {
      maxRetries: number;
      backoffMultiplier: number;
      initialDelayMs: number;
    };
    validation?: {
      enabled: boolean;
      strictMode: boolean;
    };
  };
}

export interface ExecutionState {
  workflowId: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'HALTED';
  startTime: Date;
  endTime?: Date;
  runningSubtasks: string[];
  completedSubtasks: string[];
  failedSubtasks: string[];
  retryCount: Record<string, number>;
  errors: ExecutionError[];
  progress: {
    total: number;
    completed: number;
    failed: number;
    inProgress: number;
  };
  haltReason?: string;
}

export interface ExecutionError {
  type: 'API_ERROR' | 'VALIDATION_ERROR' | 'SYSTEM_ERROR' | 'TIMEOUT_ERROR' | 'RECOVERY';
  message: string;
  subtaskId?: string;
  agentId: string;
  timestamp: Date;
  retryable: boolean;
}

export class ExecutionService extends EventEmitter {
  private executionStates: Map<string, ExecutionState> = new Map();

  constructor() {
    super();
  }

  // Lazy imports to prevent circular dependencies
  private get workflowService() {
    const { serviceRegistry } = require('./ServiceRegistry');
    return serviceRegistry.workflowService;
  }

  private get agentService() {
    const { serviceRegistry } = require('./ServiceRegistry');
    return serviceRegistry.agentService;
  }

  async startExecution(request: WorkflowExecutionRequest): Promise<ExecutionState> {
    const { workflowId } = request;
    
    console.log(`Starting execution for workflow ${workflowId}`);
    
    // Get workflow
    const workflow = await this.workflowService.getWorkflow(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    // Get agents
    const agents = await this.agentService.getAllAgents();
    if (agents.length === 0) {
      throw new Error('No agents available for execution');
    }

    // Initialize execution state
    const executionState: ExecutionState = {
      workflowId,
      status: 'RUNNING',
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

    this.executionStates.set(workflowId, executionState);

    // Start execution in background
    this.executeWorkflowAsync(workflow, agents, request.config || {});

    this.emit('execution-started', { workflowId, executionState });
    
    return executionState;
  }

  private async executeWorkflowAsync(workflow: any, agents: Agent[], config: any): Promise<void> {
    const workflowId = workflow.id;
    
    try {
      console.log(`Executing workflow ${workflowId} with ${workflow.subtasks.length} subtasks`);
      
      // Execute subtasks sequentially for demo
      for (let i = 0; i < workflow.subtasks.length; i++) {
        const subtask = workflow.subtasks[i];
        const executionState = this.executionStates.get(workflowId);
        
        if (!executionState || executionState.status === 'HALTED') {
          console.log(`Execution halted for workflow ${workflowId}`);
          break;
        }

        // Update running subtasks
        executionState.runningSubtasks.push(subtask.id);
        executionState.progress.inProgress++;

        this.emit('subtask-started', { 
          workflowId, 
          subtaskId: subtask.id, 
          subtask 
        });

        try {
          // Select best agent for subtask (simplified)
          const suitableAgents = agents.filter(agent => 
            agent.availability && 
            agent.capabilities.some(cap => cap.category === subtask.type)
          );

          const agent = suitableAgents.length > 0 
            ? suitableAgents[Math.floor(Math.random() * suitableAgents.length)]
            : agents.find(a => a.availability) || agents[0];

          if (!agent) {
            throw new Error(`No suitable agent found for subtask ${subtask.id}`);
          }

          console.log(`Executing subtask ${subtask.id} with agent ${agent.id}`);
          
          // Simulate processing time (1-4 seconds)
          await new Promise(resolve => setTimeout(resolve, Math.random() * 3000 + 1000));
          
          // Simulate success (85% success rate)
          if (Math.random() < 0.85) {
            // Success
            executionState.runningSubtasks = executionState.runningSubtasks.filter(id => id !== subtask.id);
            executionState.completedSubtasks.push(subtask.id);
            executionState.progress.completed++;
            executionState.progress.inProgress--;

            this.emit('subtask-completed', { 
              workflowId, 
              subtaskId: subtask.id,
              agent,
              result: { 
                success: true,
                content: `Mock result for ${subtask.title}`,
                confidence: 0.85 + Math.random() * 0.15
              }
            });

          } else {
            // Failure - try one more time with different agent
            const fallbackAgents = agents.filter(a => a.id !== agent.id && a.availability);
            
            if (fallbackAgents.length > 0) {
              const fallbackAgent = fallbackAgents[0];
              console.log(`Retrying subtask ${subtask.id} with fallback agent ${fallbackAgent.id}`);
              
              // Simulate fallback execution
              await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 500));
              
              // Higher success rate for fallback (90%)
              if (Math.random() < 0.9) {
                executionState.runningSubtasks = executionState.runningSubtasks.filter(id => id !== subtask.id);
                executionState.completedSubtasks.push(subtask.id);
                executionState.progress.completed++;
                executionState.progress.inProgress--;

                this.emit('subtask-completed', { 
                  workflowId, 
                  subtaskId: subtask.id,
                  agent: fallbackAgent,
                  result: { 
                    success: true, 
                    fallback: true,
                    content: `Fallback result for ${subtask.title}`,
                    confidence: 0.75 + Math.random() * 0.15
                  }
                });
              } else {
                // Complete failure
                this.handleSubtaskFailure(workflowId, subtask.id, agent, 'Execution failed after fallback attempt');
              }
            } else {
              // No fallback available
              this.handleSubtaskFailure(workflowId, subtask.id, agent, 'Execution failed and no fallback agents available');
            }
          }

        } catch (error) {
          console.error(`Error executing subtask ${subtask.id}:`, error);
          this.handleSubtaskFailure(workflowId, subtask.id, null, error instanceof Error ? error.message : 'Unknown error');
        }

        // Update state
        this.executionStates.set(workflowId, executionState);
      }

      // Finalize execution
      const finalState = this.executionStates.get(workflowId);
      if (finalState && finalState.status !== 'HALTED') {
        finalState.status = finalState.failedSubtasks.length > 0 ? 'FAILED' : 'COMPLETED';
        finalState.endTime = new Date();
        
        await this.workflowService.updateWorkflow(workflowId, { 
          status: finalState.status
        });

        this.emit('execution-completed', { 
          workflowId, 
          executionState: finalState 
        });

        console.log(`Workflow ${workflowId} execution completed with status: ${finalState.status}`);
      }

    } catch (error) {
      console.error(`Workflow execution failed for ${workflowId}:`, error);
      
      const executionState = this.executionStates.get(workflowId);
      if (executionState) {
        executionState.status = 'FAILED';
        executionState.endTime = new Date();
        executionState.errors.push({
          type: 'SYSTEM_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          agentId: 'system',
          timestamp: new Date(),
          retryable: false
        });

        await this.workflowService.updateWorkflow(workflowId, { status: 'FAILED' });
        
        this.emit('execution-failed', { 
          workflowId, 
          executionState,
          error 
        });
      }
    }
  }

  private handleSubtaskFailure(workflowId: string, subtaskId: string, agent: Agent | null, message: string): void {
    const executionState = this.executionStates.get(workflowId);
    if (!executionState) return;

    executionState.runningSubtasks = executionState.runningSubtasks.filter(id => id !== subtaskId);
    executionState.failedSubtasks.push(subtaskId);
    executionState.progress.failed++;
    executionState.progress.inProgress--;

    const error: ExecutionError = {
      type: 'API_ERROR',
      message,
      subtaskId,
      agentId: agent?.id || 'unknown',
      timestamp: new Date(),
      retryable: true
    };

    executionState.errors.push(error);

    this.emit('subtask-failed', { 
      workflowId, 
      subtaskId,
      error
    });
  }

  async getExecutionState(workflowId: string): Promise<ExecutionState | null> {
    return this.executionStates.get(workflowId) || null;
  }

  async haltExecution(workflowId: string, reason?: string): Promise<boolean> {
    const executionState = this.executionStates.get(workflowId);
    if (!executionState) {
      return false;
    }

    executionState.status = 'HALTED';
    executionState.haltReason = reason || 'User requested halt';
    executionState.endTime = new Date();

    await this.workflowService.updateWorkflow(workflowId, { status: 'HALTED' });
    
    this.emit('execution-halted', { 
      workflowId, 
      executionState,
      reason 
    });

    return true;
  }

  async resumeExecution(workflowId: string): Promise<boolean> {
    const executionState = this.executionStates.get(workflowId);
    if (!executionState || executionState.status !== 'HALTED') {
      return false;
    }

    executionState.status = 'RUNNING';
    delete executionState.haltReason;
    delete executionState.endTime;

    await this.workflowService.updateWorkflow(workflowId, { status: 'RUNNING' });
    
    this.emit('execution-resumed', { 
      workflowId, 
      executionState 
    });

    return true;
  }

  async haltSubtask(workflowId: string, subtaskId: string): Promise<boolean> {
    const executionState = this.executionStates.get(workflowId);
    if (!executionState) {
      return false;
    }

    // Remove from running subtasks
    executionState.runningSubtasks = executionState.runningSubtasks.filter(id => id !== subtaskId);
    if (executionState.progress.inProgress > 0) {
      executionState.progress.inProgress--;
    }

    this.emit('subtask-halted', { 
      workflowId, 
      subtaskId 
    });

    return true;
  }

  async getExecutionLogs(workflowId: string, limit: number = 100): Promise<any[]> {
    const executionState = this.executionStates.get(workflowId);
    if (!executionState) {
      return [];
    }

    const logs = [
      {
        timestamp: executionState.startTime,
        level: 'info',
        message: `Execution started for workflow ${workflowId}`,
        workflowId
      }
    ];

    // Add error logs
    executionState.errors.forEach(error => {
      logs.push({
        timestamp: error.timestamp,
        level: 'error',
        message: error.message,
        workflowId,
        subtaskId: error.subtaskId,
        agentId: error.agentId
      });
    });

    // Add completion log if finished
    if (executionState.endTime) {
      logs.push({
        timestamp: executionState.endTime,
        level: 'info',
        message: `Execution ${executionState.status.toLowerCase()} for workflow ${workflowId}`,
        workflowId
      });
    }

    return logs.slice(0, limit);
  }

  async getExecutionStats(): Promise<any> {
    const executions = Array.from(this.executionStates.values());
    
    return {
      total: executions.length,
      byStatus: {
        running: executions.filter(e => e.status === 'RUNNING').length,
        completed: executions.filter(e => e.status === 'COMPLETED').length,
        failed: executions.filter(e => e.status === 'FAILED').length,
        halted: executions.filter(e => e.status === 'HALTED').length
      },
      averageExecutionTime: this.calculateAverageExecutionTime(executions),
      totalSubtasksProcessed: executions.reduce((sum, e) => sum + e.progress.completed, 0),
      successRate: executions.length > 0 
        ? executions.reduce((sum, e) => sum + (e.progress.completed / (e.progress.completed + e.progress.failed || 1)), 0) / executions.length
        : 0
    };
  }

  private calculateAverageExecutionTime(executions: ExecutionState[]): number {
    const completedExecutions = executions.filter(e => e.endTime);
    if (completedExecutions.length === 0) return 0;

    const totalTime = completedExecutions.reduce((sum, e) => {
      return sum + (e.endTime!.getTime() - e.startTime.getTime());
    }, 0);

    return totalTime / completedExecutions.length;
  }
}