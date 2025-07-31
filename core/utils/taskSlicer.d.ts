import { Subtask, SubtaskType } from '../types/subtaskSchema';
export interface TaskSliceConfig {
    granularity: 'fine' | 'coarse';
    batchSize: number;
    maxSubtasks: number;
    maxPromptLength: number;
    maxTokensPerSubtask: number;
    preserveContext: boolean;
    enableSmartSlicing: boolean;
    slicingStrategy: 'semantic' | 'structural' | 'balanced';
}
export interface PromptAnalysis {
    complexity: number;
    estimatedTypeBreakdown: Record<SubtaskType, number>;
    suggestedSliceCount: number;
    tokenCount: number;
    sentenceCount: number;
    paragraphCount: number;
    hasStructuredContent: boolean;
    keyTopics: string[];
    requiresLargePromptSlicing: boolean;
}
export interface LargePromptSlicingResult {
    subtasks: Subtask[];
    oversizedSegments: string[];
    contextualLinks: Map<string, string[]>;
    slicingStatistics: {
        originalTokenCount: number;
        averageTokensPerSubtask: number;
        maxTokensInSubtask: number;
        compressionRatio: number;
        contextPreservationScore: number;
    };
}
export interface SemanticChunk {
    content: string;
    tokenCount: number;
    topics: string[];
    sentenceStart: number;
    sentenceEnd: number;
    importance: number;
}
export declare class TaskSlicer {
    sliceAdvanced(prompt: string, config: TaskSliceConfig): LargePromptSlicingResult;
    private sliceLargePrompt;
    slice(prompt: string, config: TaskSliceConfig): Subtask[];
    analyze(prompt: string): PromptAnalysis;
    merge(subtasks: Subtask[]): string;
    private generateId;
    private performSemanticChunking;
    private semanticChunking;
    private structuralChunking;
    private balancedChunking;
    private calculateComplexity;
    private countKeywords;
    private determineSubtaskType;
    private determineDependencies;
    private generateSubtaskTitle;
    private generateSubtaskDescription;
    private determinePriority;
    private estimateTokenCount;
    private splitIntoSentences;
    private detectStructuredContent;
    private extractKeyTopics;
    private isStopWord;
    private calculateOptimalSliceCount;
    private extractTopicsFromSentence;
    private calculateChunkImportance;
    private identifyStructuralSections;
    private splitOversizedChunk;
    private createSubtaskFromChunk;
    private determineSubtaskTypeFromChunk;
    private identifyContextualLinks;
    private addContextualDependencies;
    private calculateContextPreservationScore;
    private estimateSubtaskDuration;
}
//# sourceMappingURL=taskSlicer.d.ts.map