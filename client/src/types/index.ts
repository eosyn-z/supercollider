/**
 * Client-side type definitions for Supercollider
 */

// Re-export and adapt core types for client use
export enum SubtaskType {
  RESEARCH = 'RESEARCH',
  ANALYSIS = 'ANALYSIS',
  CREATION = 'CREATION',
  VALIDATION = 'VALIDATION'
}

export enum SubtaskStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  HALTED = 'HALTED'
}

export enum ExecutionStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  HALTED = 'HALTED'
}

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH';

export interface SubtaskDependency {
  subtaskId: string;
  type: 'BLOCKING' | 'SOFT' | 'REFERENCE';
  description: string;
  priority?: Priority;
}

export interface Subtask {
  id: string;
  title: string;
  description: string;
  type: SubtaskType;
  priority: Priority;
  status: SubtaskStatus;
  dependencies: SubtaskDependency[];
  createdAt: Date;
  updatedAt: Date;
  parentWorkflowId: string;
  estimatedDuration?: number;
  assignedAgentId?: string;
  result?: SubtaskResult;
  metadata?: Record<string, any>;
}

export interface SubtaskResult {
  content: string;
  metadata?: Record<string, any>;
  generatedAt: Date;
  agentId: string;
  confidence: number;
  errors?: string[];
}

export interface AgentCapability {
  name: string;
  category: SubtaskType;
  proficiency: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';
}

export interface AgentPerformanceMetrics {
  averageCompletionTime: number;
  successRate: number;
  qualityScore: number;
  totalTasksCompleted: number;
  lastUpdated: Date;
}

export interface ApiKeyInfo {
  keyId: string;
  provider: 'openai' | 'anthropic' | 'google' | 'groq' | 'custom';
  apiKey: string;
  keyPattern?: string;
  isValid: boolean;
  lastValidated?: Date;
  rateLimits?: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
}

export interface Agent {
  id: string;
  name: string;
  provider: 'openai' | 'anthropic' | 'google' | 'groq' | 'custom';
  apiKeyInfo?: ApiKeyInfo;
  capabilities: AgentCapability[];
  performanceMetrics: AgentPerformanceMetrics;
  availability: boolean;
  costPerMinute: number;
  priority: Record<SubtaskType, number>;
  fallbackOrder: number;
}

export interface AgentAssignment {
  agentId: string;
  subtaskId: string;
}

export interface Workflow {
  id: string;
  prompt: string;
  subtasks: Subtask[];
  status: 'DRAFT' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'HALTED';
  agentAssignments: AgentAssignment[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface BatchExecution {
  batchId: string;
  subtaskIds: string[];
  status: ExecutionStatus;
  startTime?: Date;
  endTime?: Date;
  assignedAgents: string[];
  retryCount: number;
}

export interface SubtaskExecution {
  subtaskId: string;
  status: ExecutionStatus;
  assignedAgentId?: string;
  startTime?: Date;
  endTime?: Date;
  estimatedDuration?: number;
  actualDuration?: number;
  retryCount: number;
  lastError?: ExecutionError;
  output?: string;
  confidence?: number;
}

export interface ExecutionState {
  workflowId: string;
  status: ExecutionStatus;
  startTime: Date;
  endTime?: Date;
  runningSubtasks: string[];
  completedSubtasks: string[];
  failedSubtasks: string[];
  haltedSubtasks: string[];
  queuedSubtasks: string[];
  retryCount: Record<string, number>;
  errors: ExecutionError[];
  progress: {
    total: number;
    completed: number;
    failed: number;
    inProgress: number;
    queued: number;
    halted: number;
  };
  haltReason?: string;
  batches: BatchExecution[];
  subtaskExecutions: Record<string, SubtaskExecution>;
  timeline: ExecutionTimelineEvent[];
}

export interface ExecutionTimelineEvent {
  id: string;
  timestamp: Date;
  type: 'batch-started' | 'batch-completed' | 'subtask-started' | 'subtask-completed' | 'subtask-failed' | 'agent-switched' | 'retry-attempted' | 'execution-halted' | 'execution-resumed';
  batchId?: string;
  subtaskId?: string;
  agentId?: string;
  message: string;
  metadata?: Record<string, any>;
}

export interface ExecutionError {
  type: 'API_ERROR' | 'VALIDATION_ERROR' | 'SYSTEM_ERROR' | 'TIMEOUT_ERROR' | 'RECOVERY';
  message: string;
  subtaskId?: string;
  agentId: string;
  timestamp: Date;
  retryable: boolean;
}

export interface ValidationRule {
  id: string;
  type: 'SCHEMA' | 'REGEX' | 'SEMANTIC' | 'CUSTOM';
  config: Record<string, any>;
  enabled: boolean;
  weight: number;
}

export interface ValidationConfig {
  rules: ValidationRule[];
  passingThreshold: number;
  haltsOnFailure: boolean;
  retryOnFailure: boolean;
  maxRetries: number;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
}

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

export interface BatchingParameters {
  subtasksPerBatch: number;
  dispatchMode: 'sequential' | 'parallel' | 'adaptive';
  forcedSubdivision: boolean;
  maxConcurrentBatches: number;
  batchTimeout: number;
  retryFailedBatches: boolean;
}

export interface TaskSlicingConfig {
  granularity: 'fine' | 'coarse' | 'adaptive';
  batchSize: number;
  maxSubtasks: number;
  maxPromptLength: number;
  maxTokensPerSubtask: number;
  batchingParameters: BatchingParameters;
  preserveContext: boolean;
  enableSmartSlicing: boolean;
  slicingStrategy: 'balanced' | 'capability-based' | 'complexity-weighted';
}

export interface WorkflowCreationRequest {
  prompt: string;
  config?: TaskSlicingConfig;
}

// Agent Management Types
export interface AgentPreferences {
  agentId: string;
  capabilities: Record<SubtaskType, boolean>;
  priorityOrder: Record<SubtaskType, number>;
  costWeighting: number;
  qualityWeighting: number;
  speedWeighting: number;
}

export interface ApiKeyValidationResult {
  isValid: boolean;
  provider?: string;
  model?: string;
  rateLimits?: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
  error?: string;
}

// UI-specific types
export interface NodeData {
  subtask: Subtask;
  agent?: Agent;
  status: ExecutionStatus;
  batchId?: string;
  estimatedDuration?: number;
  actualDuration?: number;
}

export interface EdgeData {
  dependency: SubtaskDependency;
}

export interface GraphPosition {
  x: number;
  y: number;
}

export interface WorkflowNode {
  id: string;
  type: string;
  position: GraphPosition;
  data: NodeData;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  data: EdgeData;
  type?: string;
  animated?: boolean;
}

// File Management Types
export interface FileMetadata {
  id: string;
  name: string;
  type: 'workflow' | 'prompt' | 'agent' | 'template';
  createdAt: Date;
  updatedAt: Date;
  size: number;
  tags: string[];
  description?: string;
}

export interface AtomicUnit {
  id: string;
  title: string;
  description: string;
  type: SubtaskType;
  priority: Priority;
  estimatedDuration: number;
  dependencies: string[];
  requirements: string[];
  deliverables: string[];
  validationCriteria: string[];
  agentRequirements: string[];
  atomicLevel: 'micro' | 'mini' | 'standard';
  complexity: number; // 1-10 scale
  canParallelize: boolean;
  retryPolicy: {
    maxRetries: number;
    backoffStrategy: 'linear' | 'exponential';
    failureThreshold: number;
  };
}

export interface AtomicWorkflowDecomposition {
  workflowId: string;
  atomicUnits: AtomicUnit[];
  decompositionStrategy: 'hierarchical' | 'sequential' | 'parallel' | 'hybrid';
  metadata: {
    totalUnits: number;
    estimatedDuration: number;
    complexity: 'low' | 'medium' | 'high';
    dependencies: string[];
  };
}