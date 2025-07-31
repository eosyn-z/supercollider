export { TodoItem, SubtaskTodoList, TaskComplexity, EnhancedInjectedPrompt, CheckpointMarker } from '../../core/utils/dataInjector';
export { ProgressUpdate, ParsedCheckpoint, ProgressParserConfig } from '../../server/core/utils/progressParser';
export { WebSocketMessage, ClientSubscription, BroadcastConfig } from '../../server/websocket/progressBroadcaster';
export interface TodoGenerationRequest {
    subtaskId: string;
    subtaskType: string;
    description: string;
    originalPrompt: string;
    estimatedComplexity?: 'simple' | 'moderate' | 'complex' | 'expert';
    customInstructions?: string;
    maxTodoItems?: number;
    includeTimeEstimates?: boolean;
    includeDependencies?: boolean;
}
export interface TodoGenerationResponse {
    subtaskId: string;
    todoList: SubtaskTodoList;
    generationMetadata: {
        processingTime: number;
        algorithmVersion: string;
        confidenceScore: number;
        warnings: string[];
    };
    progressInstructions: string;
    checkpointMarkers: string[];
}
export interface TodoValidationResult {
    isValid: boolean;
    issues: Array<{
        type: 'error' | 'warning' | 'suggestion';
        todoId?: string;
        message: string;
        severity: 'low' | 'medium' | 'high';
    }>;
    suggestions: string[];
    estimatedAccuracy: number;
}
export interface ProgressTrackingConfig {
    enableRealTimeUpdates: boolean;
    updateInterval: number;
    enableCheckpointValidation: boolean;
    enableProgressPrediction: boolean;
    enablePerformanceMetrics: boolean;
    maxHistorySize: number;
}
export interface ProgressMetrics {
    subtaskId: string;
    startTime: number;
    lastUpdateTime: number;
    totalUpdates: number;
    averageUpdateInterval: number;
    completionRate: number;
    estimatedTimeRemaining: number;
    actualVsEstimatedRatio: number;
    checkpointAccuracy: number;
    errorRate: number;
}
export interface ProgressPrediction {
    subtaskId: string;
    predictedCompletionTime: number;
    confidenceInterval: {
        min: number;
        max: number;
        confidence: number;
    };
    riskFactors: Array<{
        factor: string;
        impact: 'low' | 'medium' | 'high';
        probability: number;
    }>;
    recommendations: string[];
}
export interface TodoItemViewState {
    todoId: string;
    isExpanded: boolean;
    isHighlighted: boolean;
    showDetails: boolean;
    showDependencies: boolean;
    lastViewed: number;
}
export interface SubtaskViewPreferences {
    subtaskId: string;
    viewMode: 'compact' | 'detailed' | 'timeline';
    sortBy: 'order' | 'status' | 'progress' | 'priority';
    filterStatus: 'all' | 'pending' | 'in_progress' | 'completed' | 'failed';
    showTimeEstimates: boolean;
    showDependencies: boolean;
    autoRefresh: boolean;
    refreshInterval: number;
}
export interface WorkflowViewState {
    workflowId: string;
    selectedSubtasks: Set<string>;
    expandedSubtasks: Set<string>;
    viewMode: 'overview' | 'detailed' | 'timeline' | 'metrics';
    filterCriteria: {
        status?: string[];
        priority?: string[];
        agent?: string[];
        timeRange?: {
            start: number;
            end: number;
        };
    };
    sortPreferences: {
        primary: string;
        secondary?: string;
        direction: 'asc' | 'desc';
    };
}
export interface CreateTodoListRequest {
    subtaskId: string;
    subtaskType: string;
    description: string;
    originalPrompt: string;
    options?: {
        maxTodoItems?: number;
        includeTimeEstimates?: boolean;
        includeDependencies?: boolean;
        customInstructions?: string;
    };
}
export interface UpdateTodoProgressRequest {
    subtaskId: string;
    todoId: string;
    progressUpdate: {
        status?: TodoItem['status'];
        progressPercentage?: number;
        errorMessage?: string;
        completionTime?: number;
    };
}
export interface GetProgressSummaryRequest {
    workflowId?: string;
    subtaskIds?: string[];
    includeMetrics?: boolean;
    includePredictions?: boolean;
}
export interface GetProgressSummaryResponse {
    summaries: Array<{
        subtaskId: string;
        todoList: SubtaskTodoList;
        metrics?: ProgressMetrics;
        prediction?: ProgressPrediction;
    }>;
    workflowSummary?: {
        totalTodos: number;
        completedTodos: number;
        overallProgress: number;
        estimatedTimeRemaining: number;
        averageCompletionRate: number;
    };
}
export interface TodoUpdateEvent {
    type: 'todo-created' | 'todo-updated' | 'todo-completed' | 'todo-failed';
    subtaskId: string;
    todoId: string;
    todo: TodoItem;
    timestamp: number;
    metadata?: Record<string, any>;
}
export interface ProgressUpdateEvent {
    type: 'progress-update';
    subtaskId: string;
    updates: ProgressUpdate[];
    metrics?: ProgressMetrics;
    timestamp: number;
}
export interface SubtaskEvent {
    type: 'subtask-started' | 'subtask-completed' | 'subtask-failed' | 'subtask-paused';
    subtaskId: string;
    workflowId: string;
    timestamp: number;
    data?: any;
}
export interface WorkflowEvent {
    type: 'workflow-started' | 'workflow-completed' | 'workflow-failed' | 'workflow-paused';
    workflowId: string;
    timestamp: number;
    executionState: any;
}
export interface TodoGenerationSettings {
    defaultMaxTodoItems: number;
    defaultComplexity: TaskComplexity['level'];
    enableAutoValidation: boolean;
    enableSmartDependencies: boolean;
    enableTimeEstimation: boolean;
    patternRecognition: {
        enabled: boolean;
        confidence: number;
        customPatterns: Array<{
            name: string;
            pattern: RegExp;
            operations: string[];
        }>;
    };
}
export interface ProgressTrackingSettings {
    enableRealTimeUpdates: boolean;
    updateBatchInterval: number;
    enableProgressPrediction: boolean;
    enablePerformanceAnalytics: boolean;
    checkpointValidation: {
        enabled: boolean;
        strictMode: boolean;
        customValidators: string[];
    };
    notifications: {
        enableCompletionNotifications: boolean;
        enableErrorNotifications: boolean;
        enableMilestoneNotifications: boolean;
        channels: string[];
    };
}
export interface UISettings {
    defaultViewMode: 'compact' | 'detailed' | 'timeline';
    enableAnimations: boolean;
    enableSounds: boolean;
    refreshInterval: number;
    maxHistoryItems: number;
    theme: {
        primaryColor: string;
        secondaryColor: string;
        accentColor: string;
        darkMode: boolean;
    };
    accessibility: {
        enableScreenReader: boolean;
        enableHighContrast: boolean;
        enableLargeText: boolean;
        enableKeyboardNavigation: boolean;
    };
}
export interface TodoAnalytics {
    subtaskId: string;
    timeframe: {
        start: number;
        end: number;
    };
    metrics: {
        totalTodos: number;
        completedTodos: number;
        averageCompletionTime: number;
        errorRate: number;
        accuracyScore: number;
    };
    trends: {
        completionRateTrend: number[];
        errorRateTrend: number[];
        timeEstimationAccuracy: number[];
    };
    insights: string[];
}
export interface WorkflowAnalytics {
    workflowId: string;
    executionPeriod: {
        start: number;
        end: number;
    };
    performance: {
        totalExecutionTime: number;
        averageSubtaskTime: number;
        parallelEfficiency: number;
        resourceUtilization: number;
    };
    quality: {
        overallSuccessRate: number;
        averageQualityScore: number;
        errorDistribution: Record<string, number>;
        retryRate: number;
    };
    recommendations: Array<{
        category: 'performance' | 'quality' | 'cost' | 'reliability';
        priority: 'low' | 'medium' | 'high';
        message: string;
        impact: string;
    }>;
}
export interface TodoValidationError {
    code: string;
    message: string;
    todoId?: string;
    subtaskId: string;
    severity: 'warning' | 'error' | 'critical';
    suggestions?: string[];
    context?: Record<string, any>;
}
export interface ProgressValidationError {
    code: string;
    message: string;
    checkpointId?: string;
    expectedValue?: any;
    actualValue?: any;
    timestamp: number;
    context?: Record<string, any>;
}
export type TodoStatus = TodoItem['status'];
export type TaskComplexityLevel = TaskComplexity['level'];
export type ProgressUpdateType = ProgressUpdate['type'];
export type WebSocketMessageType = WebSocketMessage['type'];
export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
        details?: any;
    };
    metadata?: {
        requestId: string;
        timestamp: number;
        processingTime?: number;
        version: string;
    };
}
export interface PaginatedResponse<T> {
    items: T[];
    pagination: {
        page: number;
        pageSize: number;
        totalItems: number;
        totalPages: number;
        hasNext: boolean;
        hasPrevious: boolean;
    };
}
export interface TodoFilter {
    subtaskIds?: string[];
    statuses?: TodoStatus[];
    dateRange?: {
        start: number;
        end: number;
    };
    complexityLevels?: TaskComplexityLevel[];
    hasErrors?: boolean;
    hasHelp?: boolean;
}
export interface ProgressFilter {
    subtaskIds?: string[];
    updateTypes?: ProgressUpdateType[];
    dateRange?: {
        start: number;
        end: number;
    };
    successOnly?: boolean;
}
export interface TodoGeneratorUtils {
    validateTodoList: (todoList: SubtaskTodoList) => TodoValidationResult;
    estimateTotalDuration: (todos: TodoItem[]) => number;
    calculateComplexity: (prompt: string, type: string) => TaskComplexity;
    generateCheckpoints: (todos: TodoItem[]) => CheckpointMarker[];
    optimizeDependencies: (todos: TodoItem[]) => TodoItem[];
}
export interface ProgressParserUtils {
    parseCheckpoints: (text: string) => ParsedCheckpoint[];
    validateProgress: (todo: TodoItem, newProgress: number) => boolean;
    calculateMetrics: (todoList: SubtaskTodoList) => ProgressMetrics;
    predictCompletion: (todoList: SubtaskTodoList) => ProgressPrediction;
    generateReport: (subtaskId: string) => TodoAnalytics;
}
export type AllConfigs = ProgressTrackingConfig | BroadcastConfig | TodoGenerationSettings | ProgressTrackingSettings | UISettings;
export type AllEvents = TodoUpdateEvent | ProgressUpdateEvent | SubtaskEvent | WorkflowEvent;
export type AllMetrics = ProgressMetrics | TodoAnalytics | WorkflowAnalytics;
export declare const TODO_GENERATION_VERSION = "1.0.0";
export declare const SUPPORTED_API_VERSIONS: string[];
export declare const MINIMUM_CLIENT_VERSION = "1.0.0";
//# sourceMappingURL=todoGeneration.d.ts.map