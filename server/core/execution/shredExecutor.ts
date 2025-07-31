import { PromptShred } from '../utils/smartShredder';
import { BatchGroup } from '../batch/batchOptimizer';

interface ShredResult {
  shredId: string;
  status: 'completed' | 'failed' | 'timeout';
  output: any;
  executionTime: number;
  tokensUsed: number;
  error?: string;
  metadata?: {
    agentUsed?: string;
    retryCount?: number;
    startTime?: string;
    endTime?: string;
    processingSteps?: string[];
  };
}

interface BatchExecutionResult {
  batchId: string;
  results: ShredResult[];
  totalExecutionTime: number;
  successRate: number;
  assembledOutput: any;
  batchMetadata: {
    parallelExecution: boolean;
    contextSharing: boolean;
    totalTokensUsed: number;
    averageExecutionTime: number;
    failedShreds: string[];
    completedShreds: string[];
  };
}

interface ExecutionContext {
  workflowId: string;
  userId: string;
  maxRetries: number;
  timeoutMs: number;
  contextSharing: boolean;
  priorityLevel: 'low' | 'medium' | 'high' | 'urgent';
}

interface ProgressEvent {
  type: 'progress' | 'error' | 'completed' | 'started';
  shredId: string;
  batchId?: string;
  percentage?: number;
  message?: string;
  timestamp: string;
}

type ProgressCallback = (event: ProgressEvent) => void;
type AgentExecutor = (shred: PromptShred, context: ExecutionContext) => Promise<any>;

class ShredExecutor {
  private progressCallbacks: Map<string, ProgressCallback[]> = new Map();
  private executionHistory: Map<string, BatchExecutionResult[]> = new Map();
  private agentExecutors: Map<string, AgentExecutor> = new Map();
  
  private readonly DEFAULT_TIMEOUT = 300000; // 5 minutes
  private readonly DEFAULT_MAX_RETRIES = 3;

  constructor() {
    this.initializeDefaultAgents();
  }

  private initializeDefaultAgents(): void {
    this.registerAgentExecutor('general-purpose', this.mockGeneralPurposeAgent);
    this.registerAgentExecutor('web-search', this.mockWebSearchAgent);
    this.registerAgentExecutor('data-analysis', this.mockDataAnalysisAgent);
    this.registerAgentExecutor('content-generation', this.mockContentGenerationAgent);
    this.registerAgentExecutor('coding', this.mockCodingAgent);
  }

  registerAgentExecutor(capability: string, executor: AgentExecutor): void {
    this.agentExecutors.set(capability, executor);
  }

  addProgressCallback(workflowId: string, callback: ProgressCallback): void {
    if (!this.progressCallbacks.has(workflowId)) {
      this.progressCallbacks.set(workflowId, []);
    }
    this.progressCallbacks.get(workflowId)!.push(callback);
  }

  removeProgressCallbacks(workflowId: string): void {
    this.progressCallbacks.delete(workflowId);
  }

  private emitProgress(workflowId: string, event: ProgressEvent): void {
    const callbacks = this.progressCallbacks.get(workflowId) || [];
    callbacks.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('Progress callback error:', error);
      }
    });
  }

  private trackProgress(workflowId: string, shredId: string, percentage: number, batchId?: string): void {
    this.emitProgress(workflowId, {
      type: 'progress',
      shredId,
      batchId,
      percentage,
      message: `[PROGRESS:${shredId}:${percentage}]`,
      timestamp: new Date().toISOString()
    });
  }

  private trackError(workflowId: string, shredId: string, error: string, batchId?: string): void {
    this.emitProgress(workflowId, {
      type: 'error',
      shredId,
      batchId,
      message: `[ISSUE:${shredId}:${error}]`,
      timestamp: new Date().toISOString()
    });
  }

  private trackCompleted(workflowId: string, shredId: string, batchId?: string): void {
    this.emitProgress(workflowId, {
      type: 'completed',
      shredId,
      batchId,
      percentage: 100,
      message: `[COMPLETE:${shredId}]`,
      timestamp: new Date().toISOString()
    });
  }

  private async executeShred(
    shred: PromptShred, 
    context: ExecutionContext
  ): Promise<ShredResult> {
    const startTime = Date.now();
    let retryCount = 0;
    
    this.trackProgress(context.workflowId, shred.id, 0);
    
    const result: ShredResult = {
      shredId: shred.id,
      status: 'failed',
      output: null,
      executionTime: 0,
      tokensUsed: 0,
      metadata: {
        startTime: new Date().toISOString(),
        processingSteps: []
      }
    };

    while (retryCount <= context.maxRetries) {
      try {
        this.trackProgress(context.workflowId, shred.id, 25);
        
        const selectedAgent = this.selectBestAgent(shred);
        const agentExecutor = this.agentExecutors.get(selectedAgent);
        
        if (!agentExecutor) {
          throw new Error(`No executor found for agent capability: ${selectedAgent}`);
        }

        result.metadata!.agentUsed = selectedAgent;
        result.metadata!.retryCount = retryCount;
        result.metadata!.processingSteps!.push(`Attempting execution with ${selectedAgent}`);
        
        this.trackProgress(context.workflowId, shred.id, 50);
        
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Execution timeout')), context.timeoutMs);
        });
        
        const executionPromise = agentExecutor(shred, context);
        
        this.trackProgress(context.workflowId, shred.id, 75);
        
        const output = await Promise.race([executionPromise, timeoutPromise]);
        
        result.status = 'completed';
        result.output = output;
        result.tokensUsed = shred.estimatedTokens;
        result.metadata!.processingSteps!.push('Execution completed successfully');
        
        this.trackProgress(context.workflowId, shred.id, 100);
        this.trackCompleted(context.workflowId, shred.id);
        
        break;
        
      } catch (error) {
        retryCount++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        result.metadata!.processingSteps!.push(`Retry ${retryCount}: ${errorMessage}`);
        
        if (errorMessage.includes('timeout')) {
          result.status = 'timeout';
        }
        
        if (retryCount > context.maxRetries) {
          result.error = errorMessage;
          this.trackError(context.workflowId, shred.id, errorMessage);
          break;
        } else {
          this.trackProgress(context.workflowId, shred.id, 0);
          await this.delay(Math.pow(2, retryCount) * 1000); // Exponential backoff
        }
      }
    }

    result.executionTime = Date.now() - startTime;
    result.metadata!.endTime = new Date().toISOString();
    
    return result;
  }

  private selectBestAgent(shred: PromptShred): string {
    if (shred.agentCapabilities.length === 0) {
      return 'general-purpose';
    }
    
    for (const capability of shred.agentCapabilities) {
      if (this.agentExecutors.has(capability)) {
        return capability;
      }
    }
    
    return 'general-purpose';
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async executeBatch(
    batchGroup: BatchGroup, 
    context: ExecutionContext
  ): Promise<BatchExecutionResult> {
    const startTime = Date.now();
    const results: ShredResult[] = [];
    
    this.emitProgress(context.workflowId, {
      type: 'started',
      shredId: 'batch',
      batchId: batchGroup.groupId,
      message: `Starting batch execution: ${batchGroup.groupId}`,
      timestamp: new Date().toISOString()
    });

    try {
      if (batchGroup.canExecuteInParallel) {
        const promises = batchGroup.tasks.map(shred => 
          this.executeShred(shred, context)
        );
        
        const batchResults = await Promise.allSettled(promises);
        
        batchResults.forEach((promiseResult, index) => {
          if (promiseResult.status === 'fulfilled') {
            results.push(promiseResult.value);
          } else {
            results.push({
              shredId: batchGroup.tasks[index].id,
              status: 'failed',
              output: null,
              executionTime: 0,
              tokensUsed: 0,
              error: promiseResult.reason?.message || 'Promise rejected'
            });
          }
        });
      } else {
        for (const shred of batchGroup.tasks) {
          if (shred.dependencies.length > 0) {
            const dependencyResults = results.filter(r => 
              shred.dependencies.includes(r.shredId) && r.status === 'completed'
            );
            
            if (dependencyResults.length !== shred.dependencies.length) {
              results.push({
                shredId: shred.id,
                status: 'failed',
                output: null,
                executionTime: 0,
                tokensUsed: 0,
                error: 'Dependency execution failed'
              });
              continue;
            }
          }
          
          const result = await this.executeShred(shred, context);
          results.push(result);
        }
      }
      
      const assembledOutput = this.assembleResults(results, batchGroup.workflowType);
      const successfulResults = results.filter(r => r.status === 'completed');
      const failedResults = results.filter(r => r.status !== 'completed');
      
      const batchResult: BatchExecutionResult = {
        batchId: batchGroup.groupId,
        results,
        totalExecutionTime: Date.now() - startTime,
        successRate: results.length > 0 ? successfulResults.length / results.length : 0,
        assembledOutput,
        batchMetadata: {
          parallelExecution: batchGroup.canExecuteInParallel,
          contextSharing: context.contextSharing,
          totalTokensUsed: results.reduce((sum, r) => sum + r.tokensUsed, 0),
          averageExecutionTime: results.length > 0 
            ? results.reduce((sum, r) => sum + r.executionTime, 0) / results.length 
            : 0,
          failedShreds: failedResults.map(r => r.shredId),
          completedShreds: successfulResults.map(r => r.shredId)
        }
      };
      
      if (!this.executionHistory.has(context.workflowId)) {
        this.executionHistory.set(context.workflowId, []);
      }
      this.executionHistory.get(context.workflowId)!.push(batchResult);
      
      return batchResult;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Batch execution failed';
      
      return {
        batchId: batchGroup.groupId,
        results: results.length > 0 ? results : [{
          shredId: 'batch_error',
          status: 'failed',
          output: null,
          executionTime: Date.now() - startTime,
          tokensUsed: 0,
          error: errorMessage
        }],
        totalExecutionTime: Date.now() - startTime,
        successRate: 0,
        assembledOutput: null,
        batchMetadata: {
          parallelExecution: false,
          contextSharing: false,
          totalTokensUsed: 0,
          averageExecutionTime: 0,
          failedShreds: [batchGroup.groupId],
          completedShreds: []
        }
      };
    }
  }

  private assembleResults(results: ShredResult[], workflowType: string): any {
    const successfulResults = results.filter(r => r.status === 'completed');
    
    if (successfulResults.length === 0) {
      return null;
    }
    
    switch (workflowType) {
      case 'RESEARCH':
        return this.assembleResearchResults(successfulResults);
      case 'ANALYSIS':
        return this.assembleAnalysisResults(successfulResults);
      case 'CREATION':
        return this.assembleCreationResults(successfulResults);
      case 'DOCUMENTATION':
        return this.assembleDocumentationResults(successfulResults);
      default:
        return this.assembleGenericResults(successfulResults);
    }
  }

  private assembleResearchResults(results: ShredResult[]): any {
    return {
      type: 'research_compilation',
      findings: results.map(r => r.output),
      summary: 'Research findings compiled from multiple sources',
      confidence: this.calculateConfidenceScore(results),
      sources: results.length,
      timestamp: new Date().toISOString()
    };
  }

  private assembleAnalysisResults(results: ShredResult[]): any {
    return {
      type: 'analysis_report',
      analyses: results.map(r => r.output),
      overallInsights: 'Combined analysis from multiple perspectives',
      dataPoints: results.length,
      reliability: this.calculateConfidenceScore(results),
      timestamp: new Date().toISOString()
    };
  }

  private assembleCreationResults(results: ShredResult[]): any {
    return {
      type: 'creation_compilation',
      components: results.map(r => r.output),
      assembledOutput: results.map(r => r.output).join('\n\n'),
      partCount: results.length,
      quality: this.calculateConfidenceScore(results),
      timestamp: new Date().toISOString()
    };
  }

  private assembleDocumentationResults(results: ShredResult[]): any {
    return {
      type: 'documentation_compilation',
      sections: results.map(r => r.output),
      combinedDocument: results.map(r => r.output).join('\n\n---\n\n'),
      sectionCount: results.length,
      completeness: this.calculateConfidenceScore(results),
      timestamp: new Date().toISOString()
    };
  }

  private assembleGenericResults(results: ShredResult[]): any {
    return {
      type: 'generic_compilation',
      outputs: results.map(r => r.output),
      combinedResult: results.map(r => r.output),
      resultCount: results.length,
      score: this.calculateConfidenceScore(results),
      timestamp: new Date().toISOString()
    };
  }

  private calculateConfidenceScore(results: ShredResult[]): number {
    if (results.length === 0) return 0;
    
    const avgExecutionTime = results.reduce((sum, r) => sum + r.executionTime, 0) / results.length;
    const avgTokensUsed = results.reduce((sum, r) => sum + r.tokensUsed, 0) / results.length;
    
    const timeScore = Math.min(100, Math.max(0, 100 - (avgExecutionTime / 1000) * 2));
    const tokenScore = Math.min(100, (avgTokensUsed / 1000) * 10);
    const completionScore = 100;
    
    return (timeScore + tokenScore + completionScore) / 3;
  }

  getExecutionHistory(workflowId: string): BatchExecutionResult[] {
    return this.executionHistory.get(workflowId) || [];
  }

  clearExecutionHistory(workflowId: string): void {
    this.executionHistory.delete(workflowId);
  }

  // Mock agent implementations
  private async mockGeneralPurposeAgent(shred: PromptShred, context: ExecutionContext): Promise<any> {
    await this.delay(Math.random() * 2000 + 1000);
    return `General purpose result for: ${shred.content.substring(0, 50)}...`;
  }

  private async mockWebSearchAgent(shred: PromptShred, context: ExecutionContext): Promise<any> {
    await this.delay(Math.random() * 3000 + 2000);
    return {
      searchResults: [
        { title: 'Mock Result 1', url: 'https://example.com/1', snippet: 'Mock search result' },
        { title: 'Mock Result 2', url: 'https://example.com/2', snippet: 'Another mock result' }
      ],
      query: shred.content.substring(0, 100)
    };
  }

  private async mockDataAnalysisAgent(shred: PromptShred, context: ExecutionContext): Promise<any> {
    await this.delay(Math.random() * 4000 + 2000);
    return {
      analysis: `Analysis of: ${shred.content.substring(0, 50)}...`,
      insights: ['Insight 1', 'Insight 2', 'Insight 3'],
      confidence: Math.random() * 0.4 + 0.6,
      dataPoints: Math.floor(Math.random() * 100) + 10
    };
  }

  private async mockContentGenerationAgent(shred: PromptShred, context: ExecutionContext): Promise<any> {
    await this.delay(Math.random() * 3000 + 1500);
    return {
      content: `Generated content based on: ${shred.content.substring(0, 50)}...`,
      wordCount: Math.floor(Math.random() * 500) + 100,
      style: 'professional',
      quality: Math.random() * 0.3 + 0.7
    };
  }

  private async mockCodingAgent(shred: PromptShred, context: ExecutionContext): Promise<any> {
    await this.delay(Math.random() * 5000 + 2000);
    return {
      code: `// Code generated for: ${shred.content.substring(0, 30)}...\nfunction mockFunction() {\n  return 'Mock implementation';\n}`,
      language: 'javascript',
      linesOfCode: Math.floor(Math.random() * 50) + 10,
      complexity: Math.random() * 5 + 1
    };
  }
}

export { ShredExecutor, ShredResult, BatchExecutionResult, ExecutionContext, ProgressEvent, ProgressCallback };