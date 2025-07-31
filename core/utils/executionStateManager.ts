/**
 * Execution state persistence for crash recovery and workflow resumption
 */

import { ExecutionState, ExecutionStatus, SubtaskExecutionResult } from '../types/executionTypes';
import { Subtask } from '../types/subtaskSchema';
import { Agent } from '../types/agentRegistry';
import { ResultStore, StoredSubtaskResult } from './resultStore';

export interface ExecutionSnapshot {
  workflowId: string;
  snapshotId: string;
  timestamp: Date;
  executionState: ExecutionState;
  subtaskProgress: Map<string, SubtaskProgressInfo>;
  batchProgress: Map<string, BatchProgressInfo>;
  agentAssignments: Map<string, string>; // subtaskId -> agentId
  checkpointData: CheckpointData;
}

export interface SubtaskProgressInfo {
  subtaskId: string;
  status: ExecutionStatus;
  attempts: number;
  lastAttemptTime?: Date;
  lastError?: string;
  partialResult?: any;
  estimatedCompletion: number; // 0-1
}

export interface BatchProgressInfo {
  batchId: string;
  totalSubtasks: number;
  completedSubtasks: number;
  failedSubtasks: number;
  startTime: Date;
  estimatedEndTime?: Date;
  agentId: string;
}

export interface CheckpointData {
  lastSuccessfulBatch?: string;
  recoveryStrategy: 'resume' | 'restart' | 'partial';
  failureCount: number;
  lastFailureReason?: string;
  criticalErrors: string[];
  memoryState: Record<string, any>;
}

export interface RecoveryPlan {
  canRecover: boolean;
  recoveryStrategy: 'resume' | 'restart' | 'partial';
  tasksToResume: string[];
  tasksToRestart: string[];
  tasksToSkip: string[];
  estimatedRecoveryTime: number;
  riskAssessment: {
    dataLossRisk: 'low' | 'medium' | 'high';
    integrityRisk: 'low' | 'medium' | 'high';
    timeImpact: number; // in minutes
    recommendations: string[];
  };
}

export interface StateManagerConfig {
  snapshotInterval: number; // milliseconds
  maxSnapshots: number;
  enableAutoRecovery: boolean;
  recoveryTimeout: number; // milliseconds
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
}

export class ExecutionStateManager {
  private snapshots: Map<string, ExecutionSnapshot[]> = new Map();
  private activeWorkflows: Map<string, ExecutionState> = new Map();
  private resultStore: ResultStore;
  private config: StateManagerConfig;
  private snapshotTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(resultStore: ResultStore, config: Partial<StateManagerConfig> = {}) {
    this.resultStore = resultStore;
    this.config = {
      snapshotInterval: 60000, // 1 minute
      maxSnapshots: 50,
      enableAutoRecovery: true,
      recoveryTimeout: 300000, // 5 minutes
      compressionEnabled: true,
      encryptionEnabled: false,
      ...config
    };
  }

  /**
   * Creates a new execution state and starts monitoring
   */
  async initializeExecution(
    workflowId: string,
    subtasks: Subtask[],
    agents: Agent[]
  ): Promise<ExecutionState> {
    const executionState: ExecutionState = {
      workflowId,
      status: ExecutionStatus.PENDING,
      subtasks: new Map(subtasks.map(task => [task.id, task])),
      completedSubtasks: new Set(),
      failedSubtasks: new Set(),
      currentBatch: [],
      batchHistory: [],
      startTime: new Date(),
      totalSubtasks: subtasks.length,
      agents: new Map(agents.map(agent => [agent.id, agent])),
      config: {},
      errors: []
    };

    this.activeWorkflows.set(workflowId, executionState);
    await this.createSnapshot(workflowId);
    this.startPeriodicSnapshotting(workflowId);

    return executionState;
  }

  /**
   * Updates execution state and creates snapshot if needed
   */
  async updateExecutionState(
    workflowId: string,
    updates: Partial<ExecutionState>,
    forceSnapshot: boolean = false
  ): Promise<void> {
    const currentState = this.activeWorkflows.get(workflowId);
    if (!currentState) {
      throw new Error(`No active execution state found for workflow ${workflowId}`);
    }

    // Apply updates
    Object.assign(currentState, updates);
    currentState.lastUpdated = new Date();

    // Save to persistent storage
    await this.resultStore.saveExecutionState(currentState);

    // Create snapshot if forced or at interval
    if (forceSnapshot) {
      await this.createSnapshot(workflowId);
    }
  }

  /**
   * Creates a comprehensive snapshot of execution state
   */
  async createSnapshot(workflowId: string): Promise<string> {
    const executionState = this.activeWorkflows.get(workflowId);
    if (!executionState) {
      throw new Error(`No active execution state found for workflow ${workflowId}`);
    }

    const snapshotId = this.generateId();
    const subtaskProgress = await this.buildSubtaskProgress(workflowId);
    const batchProgress = await this.buildBatchProgress(workflowId);
    const agentAssignments = this.buildAgentAssignments(executionState);
    const checkpointData = await this.buildCheckpointData(workflowId);

    const snapshot: ExecutionSnapshot = {
      workflowId,
      snapshotId,
      timestamp: new Date(),
      executionState: this.deepClone(executionState),
      subtaskProgress,
      batchProgress,
      agentAssignments,
      checkpointData
    };

    // Store snapshot
    const workflowSnapshots = this.snapshots.get(workflowId) || [];
    workflowSnapshots.push(snapshot);

    // Maintain max snapshots limit
    if (workflowSnapshots.length > this.config.maxSnapshots) {
      workflowSnapshots.shift(); // Remove oldest
    }

    this.snapshots.set(workflowId, workflowSnapshots);

    // Optionally compress and encrypt
    if (this.config.compressionEnabled) {
      await this.compressSnapshot(snapshot);
    }

    return snapshotId;
  }

  /**
   * Loads execution state from the most recent snapshot
   */
  async loadExecutionState(workflowId: string): Promise<ExecutionState | null> {
    // First try to load from persistent storage
    const persistedState = await this.resultStore.loadExecutionState(workflowId);
    if (persistedState) {
      this.activeWorkflows.set(workflowId, persistedState);
      return persistedState;
    }

    // Fall back to snapshots
    const workflowSnapshots = this.snapshots.get(workflowId);
    if (!workflowSnapshots || workflowSnapshots.length === 0) {
      return null;
    }

    const latestSnapshot = workflowSnapshots[workflowSnapshots.length - 1];
    const executionState = this.deepClone(latestSnapshot.executionState);
    
    this.activeWorkflows.set(workflowId, executionState);
    return executionState;
  }

  /**
   * Analyzes crash state and creates recovery plan
   */
  async analyzeRecoveryOptions(workflowId: string): Promise<RecoveryPlan> {
    const workflowSnapshots = this.snapshots.get(workflowId);
    if (!workflowSnapshots || workflowSnapshots.length === 0) {
      return {
        canRecover: false,
        recoveryStrategy: 'restart',
        tasksToResume: [],
        tasksToRestart: [],
        tasksToSkip: [],
        estimatedRecoveryTime: 0,
        riskAssessment: {
          dataLossRisk: 'high',
          integrityRisk: 'high',
          timeImpact: 0,
          recommendations: ['No recovery data available - full restart required']
        }
      };
    }

    const latestSnapshot = workflowSnapshots[workflowSnapshots.length - 1];
    const crashAge = Date.now() - latestSnapshot.timestamp.getTime();
    
    // Analyze subtask states
    const tasksToResume: string[] = [];
    const tasksToRestart: string[] = [];
    const tasksToSkip: string[] = [];
    
    for (const [subtaskId, progress] of latestSnapshot.subtaskProgress) {
      switch (progress.status) {
        case ExecutionStatus.COMPLETED:
          tasksToSkip.push(subtaskId);
          break;
        case ExecutionStatus.RUNNING:
          if (crashAge < this.config.recoveryTimeout) {
            tasksToResume.push(subtaskId);
          } else {
            tasksToRestart.push(subtaskId);
          }
          break;
        case ExecutionStatus.FAILED:
          if (progress.attempts < 3) {
            tasksToRestart.push(subtaskId);
          } else {
            tasksToSkip.push(subtaskId);
          }
          break;
        default:
          tasksToRestart.push(subtaskId);
      }
    }

    // Determine recovery strategy
    let recoveryStrategy: 'resume' | 'restart' | 'partial';
    if (tasksToResume.length > tasksToRestart.length) {
      recoveryStrategy = 'resume';
    } else if (tasksToSkip.length < latestSnapshot.subtaskProgress.size * 0.5) {
      recoveryStrategy = 'partial';
    } else {
      recoveryStrategy = 'restart';
    }

    // Risk assessment
    const dataLossRisk = this.assessDataLossRisk(latestSnapshot, crashAge);
    const integrityRisk = this.assessIntegrityRisk(latestSnapshot);
    const timeImpact = this.estimateTimeImpact(tasksToRestart.length, tasksToResume.length);
    
    const recommendations = this.generateRecoveryRecommendations(
      recoveryStrategy, dataLossRisk, integrityRisk, crashAge
    );

    return {
      canRecover: true,
      recoveryStrategy,
      tasksToResume,
      tasksToRestart,
      tasksToSkip,
      estimatedRecoveryTime: timeImpact,
      riskAssessment: {
        dataLossRisk,
        integrityRisk,
        timeImpact,
        recommendations
      }
    };
  }

  /**
   * Executes recovery plan
   */
  async executeRecovery(workflowId: string, plan: RecoveryPlan): Promise<ExecutionState> {
    const latestSnapshot = this.getLatestSnapshot(workflowId);
    if (!latestSnapshot) {
      throw new Error(`No snapshot available for recovery of workflow ${workflowId}`);
    }

    const recoveredState = this.deepClone(latestSnapshot.executionState);
    
    // Update state based on recovery plan
    switch (plan.recoveryStrategy) {
      case 'resume':
        await this.executeResumeRecovery(recoveredState, plan);
        break;
      case 'partial':
        await this.executePartialRecovery(recoveredState, plan);
        break;
      case 'restart':
        await this.executeRestartRecovery(recoveredState, plan);
        break;
    }

    // Reset failure counters and update status
    recoveredState.status = ExecutionStatus.RUNNING;
    recoveredState.lastUpdated = new Date();
    recoveredState.errors = recoveredState.errors || [];
    recoveredState.errors.push({
      type: 'RECOVERY',
      message: `Workflow recovered using ${plan.recoveryStrategy} strategy`,
      agentId: 'system',
      timestamp: new Date(),
      retryable: false
    });

    this.activeWorkflows.set(workflowId, recoveredState);
    await this.resultStore.saveExecutionState(recoveredState);
    await this.createSnapshot(workflowId);

    return recoveredState;
  }

  /**
   * Cleans up resources for completed or failed workflows
   */
  async cleanupWorkflow(workflowId: string): Promise<void> {
    // Stop periodic snapshotting
    const timer = this.snapshotTimers.get(workflowId);
    if (timer) {
      clearInterval(timer);
      this.snapshotTimers.delete(workflowId);
    }

    // Remove from active workflows
    this.activeWorkflows.delete(workflowId);

    // Optionally keep snapshots for audit purposes
    // this.snapshots.delete(workflowId);
  }

  /**
   * Gets execution statistics for monitoring
   */
  getExecutionStatistics(workflowId: string): any {
    const state = this.activeWorkflows.get(workflowId);
    const snapshots = this.snapshots.get(workflowId) || [];
    
    if (!state) {
      return null;
    }

    return {
      workflowId,
      status: state.status,
      totalSubtasks: state.totalSubtasks,
      completedSubtasks: state.completedSubtasks.size,
      failedSubtasks: state.failedSubtasks.size,
      runningTime: Date.now() - state.startTime.getTime(),
      snapshotCount: snapshots.length,
      lastSnapshotAge: snapshots.length > 0 ? 
        Date.now() - snapshots[snapshots.length - 1].timestamp.getTime() : null,
      memoryUsage: this.estimateMemoryUsage(state)
    };
  }

  // Private helper methods
  private startPeriodicSnapshotting(workflowId: string): void {
    const timer = setInterval(async () => {
      try {
        await this.createSnapshot(workflowId);
      } catch (error) {
        console.error(`Failed to create periodic snapshot for ${workflowId}:`, error);
      }
    }, this.config.snapshotInterval);

    this.snapshotTimers.set(workflowId, timer);
  }

  private async buildSubtaskProgress(workflowId: string): Promise<Map<string, SubtaskProgressInfo>> {
    const progress = new Map<string, SubtaskProgressInfo>();
    const workflowResults = await this.resultStore.getWorkflowResults(workflowId);
    
    for (const result of workflowResults.subtaskResults) {
      progress.set(result.subtaskId, {
        subtaskId: result.subtaskId,
        status: result.status,
        attempts: result.retryCount,
        lastAttemptTime: result.storageTimestamp,
        lastError: result.validationResult.errors[0],
        estimatedCompletion: result.status === ExecutionStatus.COMPLETED ? 1.0 : 0.5
      });
    }

    return progress;
  }

  private async buildBatchProgress(workflowId: string): Promise<Map<string, BatchProgressInfo>> {
    const progress = new Map<string, BatchProgressInfo>();
    const workflowResults = await this.resultStore.getWorkflowResults(workflowId);
    
    for (const batch of workflowResults.batchMetadata) {
      const batchResults = workflowResults.subtaskResults.filter(r => r.batchId === batch.batchId);
      const completed = batchResults.filter(r => r.status === ExecutionStatus.COMPLETED).length;
      const failed = batchResults.filter(r => r.status === ExecutionStatus.FAILED).length;
      
      progress.set(batch.batchId, {
        batchId: batch.batchId,
        totalSubtasks: batch.subtaskIds.length,
        completedSubtasks: completed,
        failedSubtasks: failed,
        startTime: batch.startTime,
        estimatedEndTime: batch.endTime,
        agentId: batch.assignedAgentId
      });
    }

    return progress;
  }

  private buildAgentAssignments(state: ExecutionState): Map<string, string> {
    const assignments = new Map<string, string>();
    
    // This would be populated from actual dispatch assignments
    // For now, return empty map
    return assignments;
  }

  private async buildCheckpointData(workflowId: string): Promise<CheckpointData> {
    const workflowResults = await this.resultStore.getWorkflowResults(workflowId);
    const failedResults = workflowResults.subtaskResults.filter(
      r => r.status === ExecutionStatus.FAILED
    );
    
    return {
      recoveryStrategy: 'resume',
      failureCount: failedResults.length,
      lastFailureReason: failedResults[failedResults.length - 1]?.validationResult.errors[0],
      criticalErrors: failedResults
        .filter(r => !r.validationResult.shouldRetry)
        .map(r => r.validationResult.errors[0])
        .filter(Boolean),
      memoryState: {}
    };
  }

  private assessDataLossRisk(snapshot: ExecutionSnapshot, crashAge: number): 'low' | 'medium' | 'high' {
    if (crashAge < 60000) return 'low'; // Less than 1 minute
    if (crashAge < 300000) return 'medium'; // Less than 5 minutes
    return 'high';
  }

  private assessIntegrityRisk(snapshot: ExecutionSnapshot): 'low' | 'medium' | 'high' {
    const criticalErrors = snapshot.checkpointData.criticalErrors.length;
    const failureCount = snapshot.checkpointData.failureCount;
    
    if (criticalErrors === 0 && failureCount < 3) return 'low';
    if (criticalErrors < 2 && failureCount < 10) return 'medium';
    return 'high';
  }

  private estimateTimeImpact(restartCount: number, resumeCount: number): number {
    // Estimate in minutes
    return (restartCount * 5) + (resumeCount * 1);
  }

  private generateRecoveryRecommendations(
    strategy: string,
    dataLossRisk: string,
    integrityRisk: string,
    crashAge: number
  ): string[] {
    const recommendations: string[] = [];
    
    recommendations.push(`Recovery strategy: ${strategy}`);
    
    if (dataLossRisk === 'high') {
      recommendations.push('High data loss risk - consider manual verification');
    }
    
    if (integrityRisk === 'high') {
      recommendations.push('High integrity risk - full validation recommended');
    }
    
    if (crashAge > 600000) { // 10 minutes
      recommendations.push('Long crash duration - consider fresh restart');
    }

    return recommendations;
  }

  private getLatestSnapshot(workflowId: string): ExecutionSnapshot | null {
    const snapshots = this.snapshots.get(workflowId);
    return snapshots && snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
  }

  private async executeResumeRecovery(state: ExecutionState, plan: RecoveryPlan): Promise<void> {
    // Mark tasks for resumption
    for (const taskId of plan.tasksToResume) {
      if (state.subtasks.has(taskId)) {
        const task = state.subtasks.get(taskId)!;
        task.status = SubtaskStatus.PENDING;
        task.updatedAt = new Date();
      }
    }
  }

  private async executePartialRecovery(state: ExecutionState, plan: RecoveryPlan): Promise<void> {
    // Reset failed tasks, skip completed ones
    for (const taskId of plan.tasksToRestart) {
      if (state.subtasks.has(taskId)) {
        const task = state.subtasks.get(taskId)!;
        task.status = SubtaskStatus.PENDING;
        task.updatedAt = new Date();
      }
    }
    
    for (const taskId of plan.tasksToSkip) {
      state.completedSubtasks.add(taskId);
    }
  }

  private async executeRestartRecovery(state: ExecutionState, plan: RecoveryPlan): Promise<void> {
    // Reset all tasks to pending
    for (const [taskId, task] of state.subtasks) {
      task.status = SubtaskStatus.PENDING;
      task.updatedAt = new Date();
    }
    
    state.completedSubtasks.clear();
    state.failedSubtasks.clear();
  }

  private async compressSnapshot(snapshot: ExecutionSnapshot): Promise<void> {
    // Placeholder for compression implementation
    // In a real implementation, you would use a library like zlib
  }

  private deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }

  private estimateMemoryUsage(state: ExecutionState): number {
    // Rough estimation in bytes
    return JSON.stringify(state).length * 2;
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 15);
  }
}