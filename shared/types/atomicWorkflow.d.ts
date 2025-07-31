export interface AtomicTask {
    id: string;
    type: AtomicTaskType;
    name: string;
    description: string;
    inputs: TaskInput[];
    outputs: TaskOutput[];
    dependencies: string[];
    estimatedDuration: number;
    complexity: 'trivial' | 'simple' | 'moderate' | 'complex';
    canRunInParallel: boolean;
    requiredCapabilities: string[];
    priority: number;
    retryPolicy: RetryPolicy;
    validation: TaskValidation;
    metadata: Record<string, any>;
}
export type AtomicTaskType = 'generate_text' | 'generate_script' | 'generate_audio' | 'generate_image' | 'generate_video' | 'generate_code' | 'generate_data' | 'generate_document' | 'generate_presentation' | 'edit_audio' | 'edit_video' | 'edit_image' | 'edit_text' | 'edit_code' | 'process_data' | 'process_document' | 'process_media' | 'analyze_content' | 'analyze_data' | 'analyze_sentiment' | 'analyze_structure' | 'extract_data' | 'extract_features' | 'extract_metadata' | 'convert_format' | 'merge_media' | 'split_content' | 'resize_media' | 'compress_file' | 'optimize_file' | 'enhance_quality' | 'validate_output' | 'display_result' | 'save_result' | 'export_data' | 'send_notification' | 'create_archive' | 'publish_content' | 'coordinate_tasks' | 'aggregate_results' | 'check_status' | 'handle_error';
export interface TaskInput {
    id: string;
    name: string;
    description: string;
    type: 'file' | 'text' | 'parameter' | 'reference' | 'data' | 'media';
    dataType: string;
    required: boolean;
    source?: 'user_upload' | 'previous_task' | 'generated' | 'reference' | 'external_api';
    validation?: ValidationRule[];
    defaultValue?: any;
    constraints?: InputConstraint[];
}
export interface TaskOutput {
    id: string;
    name: string;
    description: string;
    type: 'file' | 'text' | 'data' | 'reference' | 'media' | 'metadata';
    dataType: string;
    format: string;
    destinationType: 'storage' | 'display' | 'next_task' | 'download' | 'export' | 'cache';
    quality?: 'draft' | 'standard' | 'high' | 'premium';
    size?: {
        width?: number;
        height?: number;
        duration?: number;
        fileSize?: number;
    };
}
export interface ValidationRule {
    type: 'required' | 'format' | 'size' | 'range' | 'pattern' | 'custom';
    value: any;
    message: string;
    severity: 'error' | 'warning' | 'info';
}
export interface InputConstraint {
    type: 'min' | 'max' | 'length' | 'format' | 'allowed_values' | 'forbidden_values';
    value: any;
    message?: string;
}
export interface RetryPolicy {
    maxRetries: number;
    backoffStrategy: 'linear' | 'exponential' | 'fixed';
    baseDelay: number;
    maxDelay: number;
    retryableErrors: string[];
}
export interface TaskValidation {
    inputValidation: ValidationRule[];
    outputValidation: ValidationRule[];
    businessRules: BusinessRule[];
    qualityChecks: QualityCheck[];
}
export interface BusinessRule {
    id: string;
    name: string;
    condition: string;
    action: 'fail' | 'warn' | 'modify' | 'skip';
    message: string;
}
export interface QualityCheck {
    id: string;
    name: string;
    metric: string;
    threshold: number;
    comparison: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq';
    action: 'fail' | 'warn' | 'retry' | 'fallback';
}
export interface DecompositionRule {
    id: string;
    name: string;
    description: string;
    trigger: string;
    pattern: RegExp;
    decomposition: AtomicTask[];
    dependencies: TaskDependency[];
    parallelizationStrategy: 'sequential' | 'parallel' | 'pipeline' | 'hybrid';
    conditions: DecompositionCondition[];
    priority: number;
    tags: string[];
}
export interface DecompositionCondition {
    type: 'file_type' | 'user_preference' | 'resource_availability' | 'custom';
    condition: string;
    value: any;
}
export interface TaskDependency {
    sourceTaskId: string;
    targetTaskId: string;
    outputToInputMapping: Record<string, string>;
    dependencyType: 'hard' | 'soft' | 'optional' | 'conditional';
    condition?: string;
    delay?: number;
}
export interface WorkflowIntent {
    primaryGoal: string;
    outputType: 'video' | 'audio' | 'image' | 'text' | 'document' | 'data' | 'mixed' | 'application';
    complexity: number;
    requirements: string[];
    constraints: WorkflowConstraint[];
    userFiles: FileMetadata[];
    context: IntentContext;
    confidence: number;
}
export interface IntentContext {
    domain: 'creative' | 'business' | 'educational' | 'technical' | 'personal' | 'research';
    audience: 'general' | 'children' | 'professionals' | 'experts' | 'specific';
    purpose: 'entertainment' | 'education' | 'marketing' | 'documentation' | 'analysis';
    urgency: 'low' | 'medium' | 'high' | 'critical';
    budget: 'unlimited' | 'high' | 'medium' | 'low' | 'minimal';
}
export interface AtomicWorkflow {
    id: string;
    name: string;
    description: string;
    version: string;
    atomicTasks: AtomicTask[];
    executionGraph: ExecutionGraph;
    estimatedDuration: number;
    requiredResources: string[];
    outputFiles: ExpectedOutput[];
    metadata: WorkflowMetadata;
    status: 'draft' | 'validated' | 'ready' | 'executing' | 'completed' | 'failed';
}
export interface ExecutionGraph {
    nodes: ExecutionNode[];
    edges: ExecutionEdge[];
    parallelBatches: string[][];
    criticalPath: string[];
    executionOrder: string[];
    branchingPoints: BranchingPoint[];
}
export interface ExecutionNode {
    taskId: string;
    position: {
        x: number;
        y: number;
    };
    status: 'pending' | 'ready' | 'running' | 'completed' | 'failed' | 'skipped' | 'cancelled';
    inputs: TaskInputMapping[];
    outputs: TaskOutputMapping[];
    executionTime?: number;
    memoryUsage?: number;
    errorInfo?: TaskError;
    retryCount: number;
}
export interface ExecutionEdge {
    id: string;
    sourceTaskId: string;
    targetTaskId: string;
    sourceOutputId: string;
    targetInputId: string;
    condition?: string;
    weight: number;
}
export interface BranchingPoint {
    nodeId: string;
    condition: string;
    truePath: string[];
    falsePath: string[];
    defaultPath: string[];
}
export interface TaskInputMapping {
    inputId: string;
    sourceType: 'user_input' | 'file_upload' | 'previous_task' | 'constant' | 'generated';
    sourceId?: string;
    sourceOutputId?: string;
    transformations?: DataTransformation[];
}
export interface TaskOutputMapping {
    outputId: string;
    destinationType: 'file' | 'display' | 'next_task' | 'storage' | 'external';
    destinationId?: string;
    transformations?: DataTransformation[];
}
export interface DataTransformation {
    type: 'format' | 'filter' | 'aggregate' | 'map' | 'reduce' | 'validate';
    parameters: Record<string, any>;
    order: number;
}
export interface ExpectedOutput {
    id: string;
    name: string;
    description: string;
    type: string;
    format: string;
    estimatedSize: number;
    quality: 'draft' | 'standard' | 'high' | 'premium';
    deliveryMethod: 'download' | 'display' | 'email' | 'api' | 'storage';
}
export interface WorkflowMetadata {
    createdAt: number;
    createdBy: string;
    tags: string[];
    category: string;
    difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert';
    estimatedCost: number;
    resourceRequirements: ResourceRequirement[];
    compatibleFiles: string[];
    successRate: number;
    averageRating: number;
    usageCount: number;
}
export interface ResourceRequirement {
    type: 'cpu' | 'memory' | 'storage' | 'network' | 'gpu' | 'specialized_service';
    amount: number;
    unit: string;
    duration: number;
    priority: 'required' | 'preferred' | 'optional';
}
export interface TaskError {
    code: string;
    message: string;
    details: any;
    timestamp: number;
    recoverable: boolean;
    suggestedActions: string[];
}
export interface DecompositionContext {
    availableResources: Resource[];
    userPreferences: UserPreferences;
    previousWorkflows: string[];
    domainKnowledge: DomainKnowledge;
    constraints: WorkflowConstraint[];
}
export interface Resource {
    id: string;
    type: 'agent' | 'service' | 'tool' | 'api' | 'compute' | 'storage';
    name: string;
    capabilities: string[];
    availability: 'available' | 'busy' | 'offline';
    cost: number;
    performance: ResourcePerformance;
    constraints: ResourceConstraint[];
}
export interface ResourcePerformance {
    throughput: number;
    latency: number;
    accuracy: number;
    reliability: number;
    scalability: number;
}
export interface ResourceConstraint {
    type: 'rate_limit' | 'quota' | 'size_limit' | 'format_support' | 'geographic';
    value: any;
    description: string;
}
export interface DomainKnowledge {
    domain: string;
    expertise: string[];
    bestPractices: BestPractice[];
    commonPatterns: WorkflowPattern[];
    knownIssues: KnownIssue[];
}
export interface BestPractice {
    id: string;
    description: string;
    applicableTaskTypes: AtomicTaskType[];
    impact: 'quality' | 'performance' | 'cost' | 'reliability';
    confidence: number;
}
export interface WorkflowPattern {
    id: string;
    name: string;
    description: string;
    pattern: AtomicTaskType[];
    frequency: number;
    successRate: number;
    variations: WorkflowVariation[];
}
export interface WorkflowVariation {
    id: string;
    name: string;
    modifications: TaskModification[];
    applicableConditions: string[];
    improvement: number;
}
export interface TaskModification {
    taskId: string;
    modificationType: 'replace' | 'add_before' | 'add_after' | 'modify_parameters' | 'remove';
    newTask?: AtomicTask;
    parameterChanges?: Record<string, any>;
}
export interface KnownIssue {
    id: string;
    description: string;
    taskTypes: AtomicTaskType[];
    conditions: string[];
    severity: 'low' | 'medium' | 'high' | 'critical';
    workarounds: string[];
    fixed: boolean;
}
export interface ValidationResult {
    isValid: boolean;
    errors: ValidationError[];
    warnings: ValidationWarning[];
    suggestions: ValidationSuggestion[];
    score: number;
}
export interface ValidationError {
    code: string;
    message: string;
    taskId?: string;
    field?: string;
    severity: 'error' | 'critical';
}
export interface ValidationWarning {
    code: string;
    message: string;
    taskId?: string;
    field?: string;
    impact: 'minor' | 'moderate' | 'significant';
}
export interface ValidationSuggestion {
    code: string;
    message: string;
    taskId?: string;
    improvement: string;
    estimatedBenefit: number;
}
export interface TaskSearchCriteria {
    type?: AtomicTaskType;
    capabilities?: string[];
    complexity?: AtomicTask['complexity'];
    tags?: string[];
    inputTypes?: string[];
    outputTypes?: string[];
    maxDuration?: number;
    textSearch?: string;
}
export interface TaskTemplate {
    id: string;
    name: string;
    description: string;
    category: string;
    template: Partial<AtomicTask>;
    customizationOptions: CustomizationOption[];
    examples: TaskExample[];
}
export interface CustomizationOption {
    field: string;
    type: 'string' | 'number' | 'boolean' | 'select' | 'multiselect';
    options?: any[];
    default?: any;
    description: string;
}
export interface TaskExample {
    name: string;
    description: string;
    inputs: Record<string, any>;
    expectedOutputs: Record<string, any>;
    notes?: string;
}
export interface WorkflowExecution {
    id: string;
    workflowId: string;
    status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
    startTime: number;
    endTime?: number;
    currentTask?: string;
    completedTasks: string[];
    failedTasks: string[];
    taskResults: Record<string, any>;
    executionMetrics: ExecutionMetrics;
    errors: TaskError[];
}
export interface ExecutionMetrics {
    totalDuration: number;
    cpuTime: number;
    memoryPeak: number;
    networkUsage: number;
    storageUsed: number;
    cost: number;
    qualityScore: number;
    efficiency: number;
}
import { FileMetadata, WorkflowConstraint, UserPreferences } from './fileManagement';
//# sourceMappingURL=atomicWorkflow.d.ts.map