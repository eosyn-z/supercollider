/**
 * Persistent result storage with proper indexing for reintegration
 */

import { SubtaskExecutionResult, ExecutionState, ExecutionStatus } from '../types/executionTypes';
import { Subtask } from '../types/subtaskSchema';

export interface StoredSubtaskResult extends SubtaskExecutionResult {
  workflowId: string;
  batchId: string;
  batchIndex: number;
  executionOrder: number;
  dependencyChain: string[];
  parentSubtaskIds: string[];
  childSubtaskIds: string[];
  executionLevel: number; // Depth in dependency tree
  storageTimestamp: Date;
  checksum: string; // For data integrity
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

/**
 * Interface for result storage implementations
 */
export interface ResultStore {
  // Core storage operations
  saveSubtaskResult(result: StoredSubtaskResult): Promise<void>;
  updateSubtaskStatus(subtaskId: string, status: ExecutionStatus): Promise<void>;
  getSubtaskResult(subtaskId: string): Promise<StoredSubtaskResult | null>;
  
  // Workflow operations
  saveExecutionState(state: ExecutionState): Promise<void>;
  loadExecutionState(workflowId: string): Promise<ExecutionState | null>;
  getWorkflowResults(workflowId: string): Promise<WorkflowResults>;
  
  // Batch operations
  saveBatchMetadata(metadata: BatchMetadata): Promise<void>;
  updateBatchStatus(batchId: string, status: BatchMetadata['status']): Promise<void>;
  getBatchResults(batchId: string): Promise<StoredSubtaskResult[]>;
  
  // Query operations
  queryResults(query: ResultQuery): Promise<StoredSubtaskResult[]>;
  getReintegrationData(workflowId: string): Promise<ReintegrationData>;
  
  // Maintenance operations
  cleanup(olderThan: Date): Promise<number>;
  validateIntegrity(workflowId: string): Promise<boolean>;
}

/**
 * In-memory implementation of ResultStore (for development/testing)
 */
export class InMemoryResultStore implements ResultStore {
  private subtaskResults: Map<string, StoredSubtaskResult> = new Map();
  private executionStates: Map<string, ExecutionState> = new Map();
  private batchMetadata: Map<string, BatchMetadata> = new Map();
  private workflowIndex: Map<string, string[]> = new Map(); // workflowId -> subtaskIds
  private executionOrderCounter = 0;

  async saveSubtaskResult(result: StoredSubtaskResult): Promise<void> {
    // Add storage metadata
    result.storageTimestamp = new Date();
    result.checksum = this.calculateChecksum(result);
    
    // Store the result
    this.subtaskResults.set(result.subtaskId, result);
    
    // Update workflow index
    const workflowSubtasks = this.workflowIndex.get(result.workflowId) || [];
    if (!workflowSubtasks.includes(result.subtaskId)) {
      workflowSubtasks.push(result.subtaskId);
      this.workflowIndex.set(result.workflowId, workflowSubtasks);
    }
  }

  async updateSubtaskStatus(subtaskId: string, status: ExecutionStatus): Promise<void> {
    const result = this.subtaskResults.get(subtaskId);
    if (result) {
      result.status = status;
      result.storageTimestamp = new Date();
      result.checksum = this.calculateChecksum(result);
      this.subtaskResults.set(subtaskId, result);
    }
  }

  async getSubtaskResult(subtaskId: string): Promise<StoredSubtaskResult | null> {
    return this.subtaskResults.get(subtaskId) || null;
  }

  async saveExecutionState(state: ExecutionState): Promise<void> {
    this.executionStates.set(state.workflowId, { ...state });
  }

  async loadExecutionState(workflowId: string): Promise<ExecutionState | null> {
    return this.executionStates.get(workflowId) || null;
  }

  async getWorkflowResults(workflowId: string): Promise<WorkflowResults> {
    const subtaskIds = this.workflowIndex.get(workflowId) || [];
    const subtaskResults = subtaskIds
      .map(id => this.subtaskResults.get(id))
      .filter((result): result is StoredSubtaskResult => result !== undefined)
      .sort((a, b) => a.executionOrder - b.executionOrder);

    const batchIds = [...new Set(subtaskResults.map(r => r.batchId))];
    const batchMetadata = batchIds
      .map(id => this.batchMetadata.get(id))
      .filter((batch): batch is BatchMetadata => batch !== undefined);

    const executionOrder = subtaskResults.map(r => r.executionOrder);
    const totalDuration = subtaskResults.reduce((sum, r) => sum + r.executionTime, 0);
    const completedAt = subtaskResults.length > 0 ? 
      new Date(Math.max(...subtaskResults.map(r => r.storageTimestamp.getTime()))) : 
      undefined;

    return {
      workflowId,
      subtaskResults,
      batchMetadata,
      executionOrder,
      totalDuration,
      completedAt
    };
  }

  async saveBatchMetadata(metadata: BatchMetadata): Promise<void> {
    this.batchMetadata.set(metadata.batchId, { ...metadata });
  }

  async updateBatchStatus(batchId: string, status: BatchMetadata['status']): Promise<void> {
    const metadata = this.batchMetadata.get(batchId);
    if (metadata) {
      metadata.status = status;
      if (status === 'completed' || status === 'failed') {
        metadata.endTime = new Date();
      }
      this.batchMetadata.set(batchId, metadata);
    }
  }

  async getBatchResults(batchId: string): Promise<StoredSubtaskResult[]> {
    return Array.from(this.subtaskResults.values())
      .filter(result => result.batchId === batchId)
      .sort((a, b) => a.executionOrder - b.executionOrder);
  }

  async queryResults(query: ResultQuery): Promise<StoredSubtaskResult[]> {
    let results = Array.from(this.subtaskResults.values());

    // Apply filters
    if (query.workflowId) {
      results = results.filter(r => r.workflowId === query.workflowId);
    }
    if (query.subtaskId) {
      results = results.filter(r => r.subtaskId === query.subtaskId);
    }
    if (query.batchId) {
      results = results.filter(r => r.batchId === query.batchId);
    }
    if (query.status) {
      results = results.filter(r => r.status === query.status);
    }
    if (query.agentId) {
      results = results.filter(r => r.agentId === query.agentId);
    }
    if (query.dateRange) {
      results = results.filter(r => 
        r.storageTimestamp >= query.dateRange!.start && 
        r.storageTimestamp <= query.dateRange!.end
      );
    }

    // Sort by execution order
    results.sort((a, b) => a.executionOrder - b.executionOrder);

    // Apply pagination
    if (query.offset) {
      results = results.slice(query.offset);
    }
    if (query.limit) {
      results = results.slice(0, query.limit);
    }

    return results;
  }

  async getReintegrationData(workflowId: string): Promise<ReintegrationData> {
    const workflowResults = await this.getWorkflowResults(workflowId);
    const dependencyGraph = this.buildDependencyGraph(workflowResults.subtaskResults);
    
    // Calculate execution summary
    const completed = workflowResults.subtaskResults.filter(r => r.status === ExecutionStatus.COMPLETED).length;
    const failed = workflowResults.subtaskResults.filter(r => r.status === ExecutionStatus.FAILED).length;
    const averageExecutionTime = workflowResults.subtaskResults.length > 0 ?
      workflowResults.totalDuration / workflowResults.subtaskResults.length : 0;

    const executionSummary = {
      totalSubtasks: workflowResults.subtaskResults.length,
      completed,
      failed,
      totalDuration: workflowResults.totalDuration,
      averageExecutionTime
    };

    return {
      workflowId,
      subtaskResults: workflowResults.subtaskResults,
      executionOrder: workflowResults.executionOrder,
      dependencyGraph,
      batchMetadata: workflowResults.batchMetadata,
      executionSummary
    };
  }

  async cleanup(olderThan: Date): Promise<number> {
    let cleaned = 0;
    
    // Clean subtask results
    for (const [id, result] of this.subtaskResults.entries()) {
      if (result.storageTimestamp < olderThan) {
        this.subtaskResults.delete(id);
        cleaned++;
      }
    }
    
    // Clean execution states
    for (const [id, state] of this.executionStates.entries()) {
      if (state.startTime < olderThan) {
        this.executionStates.delete(id);
        cleaned++;
      }
    }
    
    // Clean batch metadata
    for (const [id, metadata] of this.batchMetadata.entries()) {
      if (metadata.startTime < olderThan) {
        this.batchMetadata.delete(id);
        cleaned++;
      }
    }
    
    // Rebuild workflow index
    this.rebuildWorkflowIndex();
    
    return cleaned;
  }

  async validateIntegrity(workflowId: string): Promise<boolean> {
    const subtaskIds = this.workflowIndex.get(workflowId) || [];
    
    for (const subtaskId of subtaskIds) {
      const result = this.subtaskResults.get(subtaskId);
      if (!result) {
        return false; // Missing result
      }
      
      // Verify checksum
      const expectedChecksum = this.calculateChecksum(result);
      if (result.checksum !== expectedChecksum) {
        return false; // Data corruption
      }
      
      // Verify dependency references
      for (const depId of result.dependencyChain) {
        if (!this.subtaskResults.has(depId)) {
          return false; // Missing dependency
        }
      }
    }
    
    return true;
  }

  /**
   * Helper method to create a StoredSubtaskResult from SubtaskExecutionResult
   */
  createStoredResult(
    result: SubtaskExecutionResult,
    workflowId: string,
    batchId: string,
    batchIndex: number,
    dependencyChain: string[] = [],
    parentSubtaskIds: string[] = [],
    childSubtaskIds: string[] = [],
    executionLevel: number = 0
  ): StoredSubtaskResult {
    const executionOrder = ++this.executionOrderCounter;
    
    return {
      ...result,
      workflowId,
      batchId,
      batchIndex,
      executionOrder,
      dependencyChain,
      parentSubtaskIds,
      childSubtaskIds,
      executionLevel,
      storageTimestamp: new Date(),
      checksum: '' // Will be calculated when saved
    };
  }

  private buildDependencyGraph(results: StoredSubtaskResult[]): DependencyNode[] {
    const nodes: DependencyNode[] = [];
    const resultMap = new Map(results.map(r => [r.subtaskId, r]));
    
    for (const result of results) {
      const node: DependencyNode = {
        subtaskId: result.subtaskId,
        dependencies: result.parentSubtaskIds,
        dependents: result.childSubtaskIds,
        level: result.executionLevel
      };
      nodes.push(node);
    }
    
    return nodes;
  }

  private calculateChecksum(result: StoredSubtaskResult): string {
    // Simple checksum calculation for data integrity
    const data = JSON.stringify({
      subtaskId: result.subtaskId,
      agentId: result.agentId,
      status: result.status,
      executionTime: result.executionTime,
      retryCount: result.retryCount,
      content: result.result?.content
    });
    
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    return hash.toString(36);
  }

  private rebuildWorkflowIndex(): void {
    this.workflowIndex.clear();
    
    for (const result of this.subtaskResults.values()) {
      const workflowSubtasks = this.workflowIndex.get(result.workflowId) || [];
      if (!workflowSubtasks.includes(result.subtaskId)) {
        workflowSubtasks.push(result.subtaskId);
        this.workflowIndex.set(result.workflowId, workflowSubtasks);
      }
    }
  }
}

/**
 * Database-backed implementation (placeholder for production use)
 */
export class DatabaseResultStore implements ResultStore {
  private dbConnection: any; // Database connection interface
  
  constructor(dbConnection: any) {
    this.dbConnection = dbConnection;
  }

  // Implement all ResultStore methods using actual database operations
  async saveSubtaskResult(result: StoredSubtaskResult): Promise<void> {
    // Implementation would use SQL/NoSQL database operations
    throw new Error('DatabaseResultStore not implemented - use InMemoryResultStore for now');
  }

  async updateSubtaskStatus(subtaskId: string, status: ExecutionStatus): Promise<void> {
    throw new Error('DatabaseResultStore not implemented');
  }

  async getSubtaskResult(subtaskId: string): Promise<StoredSubtaskResult | null> {
    throw new Error('DatabaseResultStore not implemented');
  }

  async saveExecutionState(state: ExecutionState): Promise<void> {
    throw new Error('DatabaseResultStore not implemented');
  }

  async loadExecutionState(workflowId: string): Promise<ExecutionState | null> {
    throw new Error('DatabaseResultStore not implemented');
  }

  async getWorkflowResults(workflowId: string): Promise<WorkflowResults> {
    throw new Error('DatabaseResultStore not implemented');
  }

  async saveBatchMetadata(metadata: BatchMetadata): Promise<void> {
    throw new Error('DatabaseResultStore not implemented');
  }

  async updateBatchStatus(batchId: string, status: BatchMetadata['status']): Promise<void> {
    throw new Error('DatabaseResultStore not implemented');
  }

  async getBatchResults(batchId: string): Promise<StoredSubtaskResult[]> {
    throw new Error('DatabaseResultStore not implemented');
  }

  async queryResults(query: ResultQuery): Promise<StoredSubtaskResult[]> {
    throw new Error('DatabaseResultStore not implemented');
  }

  async getReintegrationData(workflowId: string): Promise<ReintegrationData> {
    throw new Error('DatabaseResultStore not implemented');
  }

  async cleanup(olderThan: Date): Promise<number> {
    throw new Error('DatabaseResultStore not implemented');
  }

  async validateIntegrity(workflowId: string): Promise<boolean> {
    throw new Error('DatabaseResultStore not implemented');
  }
}