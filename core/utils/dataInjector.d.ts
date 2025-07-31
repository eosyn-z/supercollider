import { Subtask, SubtaskType } from '../types/subtaskSchema';
import { Workflow } from '../types/workflowSchema';
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
export interface TodoItem {
    id: string;
    title: string;
    description: string;
    estimatedDurationMs: number;
    status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
    dependencies: string[];
    startTime?: number;
    completionTime?: number;
    errorMessage?: string;
    progressPercentage: number;
}
export interface SubtaskTodoList {
    subtaskId: string;
    agentId: string;
    totalItems: number;
    completedItems: number;
    estimatedTotalDuration: number;
    actualDuration?: number;
    todos: TodoItem[];
    createdAt: number;
    lastUpdated: number;
}
export interface TaskComplexity {
    level: 'simple' | 'moderate' | 'complex' | 'expert';
    operationCount: number;
    estimatedDuration: number;
    requiresExternalData: boolean;
    hasIterativeSteps: boolean;
    riskFactors: string[];
}
export interface EnhancedInjectedPrompt extends InjectedPrompt {
    todoList: SubtaskTodoList;
    progressTrackingInstructions: string;
    checkpointMarkers: string[];
}
export interface CheckpointMarker {
    id: string;
    pattern: RegExp;
    todoId: string;
    actionType: 'completion' | 'progress' | 'error' | 'help';
}
export declare class DataInjector {
    private defaultConfig;
    injectContextToSubtaskPrompt(subtask: Subtask, scaffold: Workflow, originalUserPrompt: string, config?: InjectionConfig): EnhancedInjectedPrompt;
    private extractContextualData;
    extractRelevantContext(original: string, taskType: SubtaskType): string;
    private buildContextualPrompt;
    private getTaskSpecificInstructions;
    compressContext(context: string, maxLength: number): string;
    private compressVerboseSections;
    private intelligentTruncate;
    private extractTone;
    private extractFormat;
    private extractStyleGuide;
    private extractDomain;
    private extractAudience;
    private extractConstraints;
    private extractExamples;
    private splitIntoSentences;
    private calculateRelevanceScore;
    private generateTodoList;
    private analyzeTaskComplexity;
    private extractAtomicOperations;
    private parseCustomOperations;
    private estimateOperationDuration;
    private identifyDependencies;
    private generateProgressInstructions;
    private createCheckpointMarkers;
    private embedProgressTracking;
    private humanizeOperationName;
    private generateOperationDescription;
    static createPreset(presetName: string): InjectionConfig;
}
//# sourceMappingURL=dataInjector.d.ts.map