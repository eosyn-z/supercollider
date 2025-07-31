export interface AtomicTask {
    id: string;
    type: AtomicTaskType;
    name: string;
    description: string;
    microprompt: string;
    inputs: TaskInput[];
    outputs: TaskOutput[];
    dependencies: string[];
    estimatedDuration: number;
    complexity: 'trivial' | 'simple' | 'moderate' | 'complex';
    canRunInParallel: boolean;
    requiredCapabilities: string[];
    tokenLimit: number;
    batchSize?: number;
}
export type AtomicTaskType = 'generate_text' | 'generate_script' | 'generate_audio' | 'generate_image' | 'generate_video' | 'edit_audio' | 'edit_video' | 'edit_image' | 'edit_text' | 'merge_media' | 'convert_format' | 'extract_data' | 'analyze_content' | 'validate_output' | 'optimize_file' | 'display_result' | 'save_result' | 'research_topic' | 'analyze_data' | 'create_outline' | 'write_content' | 'review_content' | 'format_output' | 'compile_result';
export interface TaskInput {
    id: string;
    name: string;
    type: 'file' | 'text' | 'parameter' | 'reference';
    required: boolean;
    source?: 'user_upload' | 'previous_task' | 'generated' | 'reference';
    validation?: ValidationRule[];
}
export interface TaskOutput {
    id: string;
    name: string;
    type: 'file' | 'text' | 'data' | 'reference';
    format: string;
    destinationType: 'storage' | 'display' | 'next_task' | 'download';
}
export interface ValidationRule {
    type: 'length' | 'format' | 'content' | 'custom';
    parameters: Record<string, any>;
}
export interface WorkflowIntent {
    primaryGoal: string;
    outputType: 'video' | 'audio' | 'image' | 'text' | 'document' | 'data' | 'mixed';
    complexity: number;
    requirements: string[];
    constraints: WorkflowConstraint[];
    userFiles: FileMetadata[];
    estimatedTokens: number;
}
export interface WorkflowConstraint {
    type: 'time' | 'quality' | 'resource' | 'format' | 'style';
    value: any;
    priority: 'low' | 'medium' | 'high' | 'critical';
}
export interface FileMetadata {
    id: string;
    originalName: string;
    mimeType: string;
    size: number;
    tags: string[];
}
export interface AtomicWorkflow {
    id: string;
    name: string;
    description: string;
    atomicTasks: AtomicTask[];
    executionGraph: ExecutionGraph;
    estimatedDuration: number;
    requiredResources: string[];
    outputFiles: ExpectedOutput[];
    totalTokens: number;
    batchedTasks: BatchedTaskGroup[];
}
export interface ExecutionGraph {
    nodes: ExecutionNode[];
    edges: ExecutionEdge[];
    parallelBatches: string[][];
    criticalPath: string[];
}
export interface ExecutionNode {
    taskId: string;
    position: {
        x: number;
        y: number;
    };
    status: 'pending' | 'ready' | 'running' | 'completed' | 'failed';
    inputs: TaskInputMapping[];
    outputs: TaskOutputMapping[];
}
export interface ExecutionEdge {
    source: string;
    target: string;
    dependencyType: 'hard' | 'soft' | 'optional';
}
export interface TaskInputMapping {
    inputId: string;
    sourceTaskId?: string;
    sourceOutputId?: string;
    value?: any;
}
export interface TaskOutputMapping {
    outputId: string;
    destinationType: 'storage' | 'next_task' | 'display';
    targetTaskId?: string;
    targetInputId?: string;
}
export interface ExpectedOutput {
    name: string;
    type: string;
    format: string;
    sourceTaskId: string;
}
export interface BatchedTaskGroup {
    batchId: string;
    tasks: AtomicTask[];
    totalTokens: number;
    canExecuteInParallel: boolean;
    contextInjector: ContextInjector;
}
export interface ContextInjector {
    type: 'summary' | 'outline' | 'reference' | 'template';
    content: string;
    tokenLimit: number;
}
export declare class AtomicDecomposer {
    private decompositionRules;
    private taskLibrary;
    constructor();
    decomposeWorkflow(userPrompt: string, uploadedFiles: FileMetadata[], context?: WorkflowContext): Promise<AtomicWorkflow>;
    private analyzeUserIntent;
    private calculateComplexity;
    private determineOutputType;
    private extractRequirements;
    private estimateTokenUsage;
    private matchDecompositionPattern;
    private applyDecompositionRule;
    private createCustomDecomposition;
    private createResearchTask;
    private createAnalysisTask;
    private createCreationTask;
    private createValidationTask;
    private createGeneralProcessingTask;
    private generateMicroprompt;
    private batchTasksForEfficiency;
    private createContextInjector;
    private optimizeDependencyGraph;
    private buildExecutionGraph;
    private calculateParallelBatches;
    private hasDependencyConflict;
    private getAllDependencies;
    private calculateCriticalPath;
    private calculateTotalDuration;
    private extractRequiredResources;
    private defineExpectedOutputs;
    private calculateTotalTokens;
    private generateWorkflowName;
    private initializeDecompositionRules;
    private initializeTaskLibrary;
}
export interface DecompositionRule {
    trigger: string;
    pattern: RegExp;
    decomposition: AtomicTask[];
    dependencies: TaskDependency[];
    parallelizationStrategy: 'sequential' | 'parallel' | 'pipeline' | 'hybrid';
}
export interface TaskDependency {
    sourceTaskId: string;
    targetTaskId: string;
    outputToInputMapping: Record<string, string>;
    dependencyType: 'hard' | 'soft' | 'optional';
}
export interface WorkflowContext {
    userId?: string;
    sessionId?: string;
    preferences?: Record<string, any>;
    constraints?: WorkflowConstraint[];
}
export declare const atomicDecomposer: AtomicDecomposer;
//# sourceMappingURL=atomicDecomposer.d.ts.map