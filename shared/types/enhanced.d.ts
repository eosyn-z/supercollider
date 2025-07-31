import { Subtask, SubtaskType, Priority } from '../../core/types/subtaskSchema';
import { Workflow } from '../../core/types/workflowSchema';
import { Agent } from '../../core/types/agentRegistry';
export interface BatchableSubtask extends Subtask {
    batchGroupId: string;
    isBatchable: boolean;
    injectedContext: string;
    dependencies: SubtaskDependency[];
}
export interface BatchGroup {
    groupId: string;
    subtasks: BatchableSubtask[];
    estimatedExecutionTime: number;
}
export interface WorkflowContext {
    originalPrompt: string;
    scaffoldData: Workflow;
    globalMetadata: Record<string, any>;
}
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
export type SubtaskExecutionStatus = 'queued' | 'running' | 'completed' | 'failed' | 'retrying';
export interface SubtaskExecution {
    subtaskId: string;
    status: SubtaskExecutionStatus;
    startTime: number;
    completionTime?: number;
    retryCount: number;
    result?: any;
    error?: string;
}
export type AgentTag = 'CREATION' | 'RESEARCH' | 'TTS' | 'CODEGEN' | 'IMAGE_GEN' | 'ANALYSIS' | 'TRANSLATION';
export interface UserAgent extends Agent {
    tags: AgentTag[];
    enabled: boolean;
    lastUsed?: Date;
    usageCount: number;
}
export interface AgentRequirements {
    taskType: string;
    priority: 'low' | 'medium' | 'high';
    estimatedComplexity: number;
    requiredCapabilities?: string[];
    preferredProviders?: string[];
    maxCost?: number;
    maxLatency?: number;
}
export interface ApiKeyValidation {
    isValid: boolean;
    provider?: string;
    model?: string;
    rateLimits?: {
        requestsPerMinute: number;
        tokensPerMinute: number;
    };
    error?: string;
}
export interface ProviderConfig {
    name: string;
    patterns: RegExp[];
    endpoint: string;
    headers: Record<string, string>;
    authFormat: string;
    testPayload: any;
}
export interface InjectionConfig {
    includeTone: boolean;
    includeFormat: boolean;
    includeOriginalPrompt: boolean;
    includeStyleGuide: boolean;
    customPrefix?: string;
    customSuffix?: string;
    maxContextLength: number;
}
export interface InjectedPrompt {
    agentId: string;
    subtaskId: string;
    injectedPrompt: string;
    contextMetadata: {
        originalLength: number;
        injectedLength: number;
        compressionRatio: number;
    };
}
export interface ContextualData {
    tone?: string;
    format?: string;
    styleGuide?: string;
    domain?: string;
    audience?: string;
    constraints?: string[];
    examples?: string[];
}
export interface BatchVisualization {
    batchId: string;
    subtasks: BatchableSubtask[];
    status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
    progress: {
        completed: number;
        failed: number;
        running: number;
        total: number;
    };
    estimatedTimeSavings: number;
    actualExecutionTime?: number;
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
export interface EnhancedExecutionState {
    workflowId: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'paused' | 'halted';
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
export interface ExecutionError {
    type: 'API_ERROR' | 'VALIDATION_ERROR' | 'SYSTEM_ERROR' | 'TIMEOUT_ERROR' | 'RECOVERY';
    message: string;
    subtaskId?: string;
    agentId: string;
    timestamp: Date;
    retryable: boolean;
}
export interface BatchExecution {
    batchId: string;
    subtaskIds: string[];
    status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
    startTime?: Date;
    endTime?: Date;
    assignedAgents: string[];
    retryCount: number;
}
export interface SubtaskDependency {
    subtaskId: string;
    type: 'BLOCKING' | 'SOFT' | 'REFERENCE';
    description: string;
    priority?: Priority;
}
export interface AgentSelectionCriteria {
    taskType?: SubtaskType;
    requiredTags?: AgentTag[];
    preferredProviders?: string[];
    maxCost?: number;
    minSuccessRate?: number;
    minQualityScore?: number;
    excludeAgents?: string[];
}
export interface AgentPerformanceStats {
    totalAgents: number;
    activeAgents: number;
    averageSuccessRate: number;
    totalUsage: number;
    providerDistribution: Record<string, number>;
    tagDistribution: Record<AgentTag, number>;
}
export interface FallbackConfiguration {
    agentIds: string[];
    maxRetries: number;
    fallbackDelay: number;
    escalationRules?: {
        failureThreshold: number;
        escalateToHuman: boolean;
        notificationChannels: string[];
    };
}
export interface EnhancedWorkflow extends Workflow {
    batchGroups?: BatchGroup[];
    contextInjection?: {
        enabled: boolean;
        config: InjectionConfig;
    };
    parallelExecution?: {
        enabled: boolean;
        maxConcurrency: number;
        preferBatching: boolean;
    };
    agentSelection?: {
        strategy: 'auto' | 'manual' | 'round-robin';
        fallbackConfig?: FallbackConfiguration;
    };
}
export interface WorkflowExecutionConfig {
    parallelBatching: {
        enabled: boolean;
        maxConcurrentBatches: number;
        batchSizeLimit: number;
        timeoutMs: number;
    };
    contextInjection: {
        enabled: boolean;
        config: InjectionConfig;
    };
    agentSelection: {
        autoSelect: boolean;
        criteria: AgentSelectionCriteria;
        fallbacks: string[];
    };
    errorHandling: {
        maxRetries: number;
        fallbackToSequential: boolean;
        haltOnCriticalFailure: boolean;
    };
}
export interface MigrationUtility {
    convertLegacyWorkflow: (workflow: Workflow) => EnhancedWorkflow;
    backfillAgentTags: (agents: Agent[]) => UserAgent[];
    migrateExecutionState: (oldState: any) => EnhancedExecutionState;
}
export interface ConfigurationSchema {
    version: string;
    features: {
        parallelBatching: boolean;
        contextInjection: boolean;
        enhancedAgentSelection: boolean;
    };
    defaults: {
        dispatchConfig: DispatchConfig;
        injectionConfig: InjectionConfig;
        agentSelectionCriteria: AgentSelectionCriteria;
    };
}
export interface SupercolliderEvent {
    type: string;
    timestamp: Date;
    data: any;
    source: 'batch-executor' | 'agent-registry' | 'context-injector' | 'ui';
}
export interface EventSubscription {
    eventTypes: string[];
    callback: (event: SupercolliderEvent) => void;
    filters?: Record<string, any>;
}
export interface CreateWorkflowRequest {
    prompt: string;
    config?: WorkflowExecutionConfig;
    agents?: string[];
    tags?: AgentTag[];
}
export interface ExecuteWorkflowRequest {
    workflowId: string;
    config: WorkflowExecutionConfig;
    agentAssignments?: Record<string, string>;
}
export interface BatchRetryRequest {
    batchId: string;
    subtaskIds?: string[];
    newAgentId?: string;
}
export interface AgentImportRequest {
    agents: UserAgent[];
    overwriteExisting: boolean;
    validateKeys: boolean;
}
export type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;
export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export declare class SupercolliderError extends Error {
    code: string;
    context?: Record<string, any> | undefined;
    constructor(message: string, code: string, context?: Record<string, any> | undefined);
}
export declare class BatchExecutionError extends SupercolliderError {
    batchId: string;
    failedSubtasks: string[];
    constructor(message: string, batchId: string, failedSubtasks: string[], context?: Record<string, any>);
}
export declare class AgentValidationError extends SupercolliderError {
    agentId: string;
    validationDetails: any;
    constructor(message: string, agentId: string, validationDetails: any, context?: Record<string, any>);
}
export declare class ContextInjectionError extends SupercolliderError {
    subtaskId: string;
    injectionConfig: InjectionConfig;
    constructor(message: string, subtaskId: string, injectionConfig: InjectionConfig, context?: Record<string, any>);
}
//# sourceMappingURL=enhanced.d.ts.map