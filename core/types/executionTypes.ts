/**
 * Core types for workflow execution and state management
 */

export interface ExecutionState {
  workflowId: string;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'HALTED' | 'PAUSED';
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
  message: string;
  timestamp: Date;
  subtaskId?: string;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export enum ExecutionStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  HALTED = 'HALTED',
  VALIDATING = 'VALIDATING',
  RETRYING = 'RETRYING'
}

export interface ValidationConfig {
  enabled: boolean;
  confidenceThreshold: number;
  maxRetries: number;
  autoRetry: boolean;
  requireHumanReview: boolean;
  validationRules: string[];
}