/**
 * Dispatcher for executing subtasks and batches via AI agent APIs
 */

import { Subtask, SubtaskResult, SubtaskStatus } from '../types/subtaskSchema';
import { Agent } from '../types/agentRegistry';
import { 
  BatchResult, 
  SubtaskExecutionResult, 
  ExecutionStatus,
  ExecutionError,
  DispatchConfig,
  AgentApiRequest,
  AgentApiResponse,
  MultipassResult,
  ValidationResult
} from '../types/executionTypes';
import { BatchGroup, BatchableSubtask } from './taskSlicer';

export interface DispatchConfig {
  maxConcurrentRequests: number;
  preferBatching: boolean;
  autoFallbackToSequential: boolean;
  timeoutMs: number;
  concurrency?: {
    maxConcurrentSubtasks: number;
    maxConcurrentBatches: number;
  };
  retry?: {
    maxRetries: number;
    backoffMultiplier: number;
    initialDelayMs: number;
  };
  timeout?: {
    subtaskTimeoutMs: number;
    batchTimeoutMs: number;
  };
  multipass?: {
    enabled: boolean;
    maxPasses: number;
    improvementThreshold: number;
  };
  fallback?: {
    enabled: boolean;
    fallbackAgents: string[];
  };
}

export interface IsolatedPrompt {
  subtaskId: string;
  agentId: string;
  prompt: string;
  context: Record<string, any>;
}

export interface AgentResponse {
  subtaskId: string;
  agentId: string;
  content: string;
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
}

export interface BatchExecutionResult {
  batchId: string;
  groupId: string;
  subtasks: BatchableSubtask[];
  results: AgentResponse[];
  success: boolean;
  executionTime: number;
  errors: ExecutionError[];
}

export class Dispatcher {
  private config: DispatchConfig;
  private runningSubtasks: Map<string, AbortController> = new Map();
  private semaphore: Map<string, number> = new Map(); // Track concurrent tasks per agent

  constructor(config: Partial<DispatchConfig> = {}) {
    this.config = {
      maxConcurrentRequests: config.maxConcurrentRequests || 10,
      preferBatching: config.preferBatching !== undefined ? config.preferBatching : true,
      autoFallbackToSequential: config.autoFallbackToSequential !== undefined ? config.autoFallbackToSequential : true,
      timeoutMs: config.timeoutMs || 300000,
      concurrency: {
        maxConcurrentSubtasks: 5,
        maxConcurrentBatches: 2,
        ...config.concurrency
      },
      retry: {
        maxRetries: 3,
        backoffMultiplier: 2,
        initialDelayMs: 1000,
        ...config.retry
      },
      timeout: {
        subtaskTimeoutMs: 300000, // 5 minutes
        batchTimeoutMs: 1800000,  // 30 minutes
        ...config.timeout
      },
      multipass: {
        enabled: true,
        maxPasses: 3,
        improvementThreshold: 0.1,
        ...config.multipass
      },
      fallback: {
        enabled: true,
        fallbackAgents: [],
        ...config.fallback
      }
    };
  }

  /**
   * Enhanced batch execution with full isolation and parallel processing using Promise.allSettled
   */
  async executeBatch(batchGroup: BatchGroup, config: DispatchConfig): Promise<BatchExecutionResult> {
    const startTime = Date.now();
    const isolatedPrompts = this.prepareIsolatedPrompts(batchGroup);
    
    // Use Promise.allSettled to ensure all subtasks complete regardless of individual failures
    const settledResults = await Promise.allSettled(
      isolatedPrompts.map(async (prompt): Promise<AgentResponse> => {
        try {
          // Simulate finding appropriate agent - in real implementation this would use agent registry
          const mockAgent: Agent = {
            id: prompt.agentId,
            name: `Agent ${prompt.agentId}`,
            apiKey: 'mock-key',
            capabilities: [],
            performanceMetrics: {
              averageCompletionTime: 10,
              successRate: 0.95,
              qualityScore: 85,
              totalTasksCompleted: 100,
              lastUpdated: new Date()
            },
            availability: true
          };

          const response = await this.callAgentApiDirect(prompt, mockAgent);
          
          return {
            subtaskId: prompt.subtaskId,
            agentId: prompt.agentId,
            content: response.content || '',
            success: response.success,
            error: response.error?.message,
            metadata: response.metadata
          };
        } catch (error) {
          return {
            subtaskId: prompt.subtaskId,
            agentId: prompt.agentId,
            content: '',
            success: false,
            error: error.message,
            metadata: {}
          };
        }
      })
    );

    // Process settled results into standard format
    const results: AgentResponse[] = [];
    const errors: ExecutionError[] = [];
    
    settledResults.forEach((settled, index) => {
      if (settled.status === 'fulfilled') {
        results.push(settled.value);
        
        // Track errors from failed responses
        if (!settled.value.success) {
          errors.push({
            type: 'API_ERROR' as const,
            message: settled.value.error || 'Unknown error',
            subtaskId: settled.value.subtaskId,
            agentId: settled.value.agentId,
            timestamp: new Date(),
            retryable: true
          });
        }
      } else {
        // Handle Promise rejection (shouldn't happen due to try-catch, but safety net)
        const prompt = isolatedPrompts[index];
        results.push({
          subtaskId: prompt.subtaskId,
          agentId: prompt.agentId,
          content: '',
          success: false,
          error: settled.reason?.message || 'Promise rejected',
          metadata: {}
        });
        
        errors.push({
          type: 'SYSTEM_ERROR' as const,
          message: settled.reason?.message || 'Promise rejected',
          subtaskId: prompt.subtaskId,
          agentId: prompt.agentId,
          timestamp: new Date(),
          retryable: false
        });
      }
    });
    
    return {
      batchId: this.generateId(),
      groupId: batchGroup.groupId,
      subtasks: batchGroup.subtasks,
      results: results,
      success: results.every(r => r.success),
      executionTime: Date.now() - startTime,
      errors: errors
    };
  }

  /**
   * Dispatches multiple prompts concurrently to different agents
   */
  private async dispatchConcurrent(prompts: IsolatedPrompt[]): Promise<AgentResponse[]> {
    const maxConcurrent = Math.min(prompts.length, this.config.maxConcurrentRequests);
    const chunks = this.chunkArray(prompts, maxConcurrent);
    const allResults: AgentResponse[] = [];

    for (const chunk of chunks) {
      const chunkPromises = chunk.map(async (prompt): Promise<AgentResponse> => {
        try {
          // Simulate finding appropriate agent - in real implementation this would use agent registry
          const mockAgent: Agent = {
            id: prompt.agentId,
            name: `Agent ${prompt.agentId}`,
            apiKey: 'mock-key',
            capabilities: [],
            performanceMetrics: {
              averageCompletionTime: 10,
              successRate: 0.95,
              qualityScore: 85,
              totalTasksCompleted: 100,
              lastUpdated: new Date()
            },
            availability: true
          };

          const response = await this.callAgentApiDirect(prompt, mockAgent);
          
          return {
            subtaskId: prompt.subtaskId,
            agentId: prompt.agentId,
            content: response.content || '',
            success: response.success,
            error: response.error?.message,
            metadata: response.metadata
          };
        } catch (error) {
          return {
            subtaskId: prompt.subtaskId,
            agentId: prompt.agentId,
            content: '',
            success: false,
            error: error.message,
            metadata: {}
          };
        }
      });

      const chunkResults = await Promise.all(chunkPromises);
      allResults.push(...chunkResults);
    }

    return allResults;
  }

  /**
   * Prepares isolated prompts from batch group
   */
  private prepareIsolatedPrompts(batchGroup: BatchGroup): IsolatedPrompt[] {
    return batchGroup.subtasks.map(subtask => ({
      subtaskId: subtask.id,
      agentId: subtask.assignedAgentId || 'default-agent',
      prompt: subtask.injectedContext,
      context: subtask.metadata || {}
    }));
  }

  /**
   * Direct API call for isolated prompts
   */
  private async callAgentApiDirect(prompt: IsolatedPrompt, agent: Agent): Promise<AgentApiResponse> {
    const request: AgentApiRequest = {
      subtaskId: prompt.subtaskId,
      prompt: prompt.prompt,
      context: prompt.context,
      maxTokens: 4000,
      temperature: 0.7
    };

    try {
      // In development mode, return mock response
      if (process.env.NODE_ENV === 'development') {
        await this.sleep(Math.random() * 3000 + 1000); // Simulate processing time
        
        return {
          success: true,
          content: `Isolated response for subtask ${prompt.subtaskId}:\n\n${prompt.prompt.slice(0, 200)}...\n\nThis is a comprehensive response addressing the specific requirements.`,
          usage: {
            promptTokens: Math.floor(prompt.prompt.length / 4),
            completionTokens: 100,
            totalTokens: Math.floor(prompt.prompt.length / 4) + 100
          },
          metadata: {
            model: 'mock-model',
            processingTime: Math.random() * 2000 + 500
          }
        };
      }

      // Real API call would go here
      const response = await fetch(`https://api.agent-service.com/${agent.id}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${agent.apiKey}`
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        throw new Error(`Agent API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        success: true,
        content: data.content || data.message || data.text,
        usage: data.usage,
        metadata: data.metadata
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'API_ERROR',
          message: error.message
        }
      };
    }
  }

  /**
   * Dispatches a batch of subtasks to an agent (legacy method)
   */
  async dispatchBatch(batch: Subtask[], agent: Agent): Promise<BatchResult> {
    const batchId = this.generateId();
    const startTime = Date.now();
    const subtaskResults: SubtaskExecutionResult[] = [];
    const errors: ExecutionError[] = [];

    // Check concurrency limits
    await this.waitForBatchSlot();

    try {
      // Process subtasks with concurrency control
      const concurrentTasks = Math.min(
        batch.length,
        this.config.concurrency.maxConcurrentSubtasks
      );

      const chunks = this.chunkArray(batch, concurrentTasks);
      
      for (const chunk of chunks) {
        const chunkPromises = chunk.map(subtask => 
          this.dispatchSubtask(subtask, agent)
            .then(result => ({ subtask, result }))
            .catch(error => ({ subtask, error }))
        );

        const chunkResults = await Promise.all(chunkPromises);
        
        for (const { subtask, result, error } of chunkResults) {
          if (error) {
            const executionError: ExecutionError = {
              type: 'API_ERROR',
              message: error.message,
              subtaskId: subtask.id,
              agentId: agent.id,
              timestamp: new Date(),
              retryable: true
            };
            errors.push(executionError);
            
            subtaskResults.push({
              subtaskId: subtask.id,
              agentId: agent.id,
              validationResult: {
                passed: false,
                confidence: 0,
                ruleResults: [],
                shouldHalt: false,
                shouldRetry: true,
                errors: [error.message],
                warnings: []
              },
              retryCount: 0,
              executionTime: 0,
              status: ExecutionStatus.FAILED
            });
          } else {
            subtaskResults.push(result);
          }
        }
      }

      const executionTime = Date.now() - startTime;
      const overallSuccess = subtaskResults.every(result => 
        result.status === ExecutionStatus.COMPLETED
      );

      return {
        batchId,
        subtaskResults,
        overallSuccess,
        executionTime,
        errors
      };

    } catch (error) {
      const executionError: ExecutionError = {
        type: 'SYSTEM_ERROR',
        message: `Batch execution failed: ${error.message}`,
        agentId: agent.id,
        timestamp: new Date(),
        retryable: false
      };

      return {
        batchId,
        subtaskResults,
        overallSuccess: false,
        executionTime: Date.now() - startTime,
        errors: [executionError]
      };
    }
  }

  /**
   * Dispatches a single subtask to an agent with multipass support
   */
  async dispatchSubtask(subtask: Subtask, agent: Agent): Promise<SubtaskExecutionResult> {
    const startTime = Date.now();
    let retryCount = 0;
    let bestResult: SubtaskExecutionResult | null = null;

    // Check if multipass is enabled for this subtask
    const isMultipass = this.config.multipass.enabled && 
                       subtask.metadata?.multipass === true;

    const maxAttempts = isMultipass ? 
      this.config.multipass.maxPasses : 
      this.config.retry.maxRetries + 1;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        // Apply retry delay if this is a retry
        if (attempt > 0) {
          const delay = this.config.retry.initialDelayMs * 
                       Math.pow(this.config.retry.backoffMultiplier, attempt - 1);
          await this.sleep(delay);
        }

        const result = await this.executeSingleAttempt(subtask, agent, attempt);
        
        if (isMultipass) {
          // For multipass, check if we should continue or use this result
          const shouldContinue = this.shouldContinueMultipass(
            result, bestResult, attempt
          );
          
          if (!bestResult || result.validationResult.confidence > bestResult.validationResult.confidence) {
            bestResult = result;
          }

          if (!shouldContinue || result.validationResult.passed) {
            break;
          }
        } else {
          // For single-pass, return immediately if successful
          if (result.status === ExecutionStatus.COMPLETED) {
            return result;
          }
          
          // For failures, retry if configured
          if (!result.validationResult.shouldRetry || 
              attempt >= this.config.retry.maxRetries) {
            return result;
          }
        }

        retryCount = attempt + 1;

      } catch (error) {
        retryCount = attempt + 1;
        
        // If this is the last attempt, return failure
        if (attempt >= maxAttempts - 1) {
          return {
            subtaskId: subtask.id,
            agentId: agent.id,
            validationResult: {
              passed: false,
              confidence: 0,
              ruleResults: [],
              shouldHalt: false,
              shouldRetry: false,
              errors: [`Final attempt failed: ${error.message}`],
              warnings: []
            },
            retryCount,
            executionTime: Date.now() - startTime,
            status: ExecutionStatus.FAILED
          };
        }
      }
    }

    // Return the best result if multipass, or the last result
    return bestResult || {
      subtaskId: subtask.id,
      agentId: agent.id,
      validationResult: {
        passed: false,
        confidence: 0,
        ruleResults: [],
        shouldHalt: false,
        shouldRetry: false,
        errors: ['No valid result obtained'],
        warnings: []
      },
      retryCount,
      executionTime: Date.now() - startTime,
      status: ExecutionStatus.FAILED
    };
  }

  /**
   * Executes a single attempt for a subtask
   */
  private async executeSingleAttempt(
    subtask: Subtask, 
    agent: Agent, 
    attemptNumber: number
  ): Promise<SubtaskExecutionResult> {
    const startTime = Date.now();
    
    // Create abort controller for timeout handling
    const abortController = new AbortController();
    this.runningSubtasks.set(subtask.id, abortController);

    try {
      // Set timeout
      const timeoutId = setTimeout(() => {
        abortController.abort();
      }, this.config.timeout.subtaskTimeoutMs);

      // Wait for agent availability
      await this.waitForAgentSlot(agent.id);

      try {
        // Make API call to agent
        const apiResponse = await this.callAgentApi(
          subtask, 
          agent, 
          abortController.signal
        );

        clearTimeout(timeoutId);

        if (!apiResponse.success || !apiResponse.content) {
          throw new Error(apiResponse.error?.message || 'Empty response from agent');
        }

        // Create subtask result
        const subtaskResult: SubtaskResult = {
          content: apiResponse.content,
          metadata: apiResponse.metadata,
          generatedAt: new Date(),
          agentId: agent.id,
          confidence: 1.0 // Will be updated by validation
        };

        // For now, return with basic validation (actual validation happens in controller)
        return {
          subtaskId: subtask.id,
          agentId: agent.id,
          result: subtaskResult,
          validationResult: {
            passed: true,
            confidence: 1.0,
            ruleResults: [],
            shouldHalt: false,
            shouldRetry: false,
            errors: [],
            warnings: []
          },
          retryCount: attemptNumber,
          executionTime: Date.now() - startTime,
          status: ExecutionStatus.COMPLETED
        };

      } finally {
        this.releaseAgentSlot(agent.id);
        clearTimeout(timeoutId);
      }

    } catch (error) {
      const isTimeout = error.name === 'AbortError';
      const errorType = isTimeout ? 'TIMEOUT_ERROR' : 'API_ERROR';

      return {
        subtaskId: subtask.id,
        agentId: agent.id,
        validationResult: {
          passed: false,
          confidence: 0,
          ruleResults: [],
          shouldHalt: isTimeout,
          shouldRetry: !isTimeout,
          errors: [error.message],
          warnings: []
        },
        retryCount: attemptNumber,
        executionTime: Date.now() - startTime,
        status: ExecutionStatus.FAILED
      };

    } finally {
      this.runningSubtasks.delete(subtask.id);
    }
  }

  /**
   * Makes an API call to an agent
   */
  private async callAgentApi(
    subtask: Subtask, 
    agent: Agent, 
    signal: AbortSignal
  ): Promise<AgentApiResponse> {
    const request: AgentApiRequest = {
      subtaskId: subtask.id,
      prompt: this.buildPrompt(subtask),
      context: subtask.metadata,
      maxTokens: 4000,
      temperature: 0.7
    };

    // Simulate API call - in real implementation, this would call the actual agent API
    // using agent.apiKey and agent-specific endpoints
    
    try {
      const response = await fetch(`https://api.agent-service.com/${agent.id}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${agent.apiKey}`
        },
        body: JSON.stringify(request),
        signal
      });

      if (!response.ok) {
        throw new Error(`Agent API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        success: true,
        content: data.content || data.message || data.text,
        usage: data.usage,
        metadata: data.metadata
      };

    } catch (error) {
      if (error.name === 'AbortError') {
        throw error;
      }

      // For development/testing, return a mock response
      if (process.env.NODE_ENV === 'development') {
        await this.sleep(Math.random() * 2000 + 1000); // Simulate processing time
        
        return {
          success: true,
          content: `Mock response for subtask: ${subtask.title}\n\nThis is a simulated response for ${subtask.description}`,
          usage: {
            promptTokens: 100,
            completionTokens: 50,
            totalTokens: 150
          }
        };
      }

      return {
        success: false,
        error: {
          code: 'API_ERROR',
          message: error.message
        }
      };
    }
  }

  /**
   * Builds a prompt for the agent based on subtask details
   */
  private buildPrompt(subtask: Subtask): string {
    let prompt = `Task: ${subtask.title}\n\n`;
    prompt += `Description: ${subtask.description}\n\n`;
    
    if (subtask.type) {
      prompt += `Type: ${subtask.type}\n\n`;
    }
    
    prompt += 'Please provide a comprehensive response to complete this task.';
    
    return prompt;
  }

  /**
   * Determines if multipass execution should continue
   */
  private shouldContinueMultipass(
    currentResult: SubtaskExecutionResult,
    bestResult: SubtaskExecutionResult | null,
    attemptNumber: number
  ): boolean {
    // Stop if validation passed
    if (currentResult.validationResult.passed) {
      return false;
    }

    // Stop if we've reached max passes
    if (attemptNumber >= this.config.multipass.maxPasses - 1) {
      return false;
    }

    // Continue if this is the first attempt
    if (!bestResult) {
      return true;
    }

    // Continue if there's significant improvement
    const improvement = currentResult.validationResult.confidence - 
                       bestResult.validationResult.confidence;
    
    return improvement >= this.config.multipass.improvementThreshold;
  }

  /**
   * Waits for an available batch slot
   */
  private async waitForBatchSlot(): Promise<void> {
    // Simple implementation - could be enhanced with proper queue management
    while (this.runningSubtasks.size >= this.config.concurrency.maxConcurrentBatches) {
      await this.sleep(100);
    }
  }

  /**
   * Waits for an available agent slot
   */
  private async waitForAgentSlot(agentId: string): Promise<void> {
    const currentCount = this.semaphore.get(agentId) || 0;
    
    while (currentCount >= this.config.concurrency.maxConcurrentSubtasks) {
      await this.sleep(100);
    }
    
    this.semaphore.set(agentId, currentCount + 1);
  }

  /**
   * Releases an agent slot
   */
  private releaseAgentSlot(agentId: string): void {
    const currentCount = this.semaphore.get(agentId) || 0;
    this.semaphore.set(agentId, Math.max(0, currentCount - 1));
  }

  /**
   * Cancels a running subtask
   */
  public cancelSubtask(subtaskId: string): boolean {
    const controller = this.runningSubtasks.get(subtaskId);
    if (controller) {
      controller.abort();
      this.runningSubtasks.delete(subtaskId);
      return true;
    }
    return false;
  }

  /**
   * Cancels all running subtasks
   */
  public cancelAll(): void {
    for (const [subtaskId, controller] of this.runningSubtasks) {
      controller.abort();
    }
    this.runningSubtasks.clear();
    this.semaphore.clear();
  }

  /**
   * Gets current execution statistics
   */
  public getStats(): { runningCount: number; agentLoad: Record<string, number> } {
    const agentLoad: Record<string, number> = {};
    for (const [agentId, count] of this.semaphore) {
      agentLoad[agentId] = count;
    }

    return {
      runningCount: this.runningSubtasks.size,
      agentLoad
    };
  }

  // Utility methods
  private generateId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
}