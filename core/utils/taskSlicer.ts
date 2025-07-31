/**
 * Enhanced task slicing utilities for breaking down large prompts with advanced analysis
 */

import { Subtask, SubtaskType, Priority, SubtaskStatus, SubtaskDependency } from '../types/subtaskSchema';
import { Workflow, WorkflowResult } from '../types/workflowSchema';

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

export interface BatchableSubtask extends Subtask {
  batchGroupId: string;
  isBatchable: boolean;
  injectedContext: string;
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

export class TaskSlicer {
  /**
   * Identifies which subtasks can be batched for parallel execution
   */
  identifyBatchableSubtasks(workflow: Workflow): BatchGroup[] {
    const batchGroups: BatchGroup[] = [];
    const unbatchedSubtasks = [...workflow.subtasks];
    const processedSubtasks = new Set<string>();

    // Group subtasks that can run in parallel (no blocking dependencies)
    while (unbatchedSubtasks.length > 0) {
      const batchableGroup: Subtask[] = [];
      const currentBatch = unbatchedSubtasks.filter(subtask => {
        // Check if all dependencies are already processed
        const hasUnmetDependencies = subtask.dependencies.some(dep => 
          dep.type === 'BLOCKING' && !processedSubtasks.has(dep.subtaskId)
        );
        return !hasUnmetDependencies;
      });

      if (currentBatch.length === 0) break; // Prevent infinite loop

      // Take up to maxBatchSize subtasks for this batch
      const maxBatchSize = 5;
      const batchSubtasks = currentBatch.slice(0, maxBatchSize);
      
      batchSubtasks.forEach(subtask => {
        const index = unbatchedSubtasks.indexOf(subtask);
        if (index > -1) {
          unbatchedSubtasks.splice(index, 1);
          processedSubtasks.add(subtask.id);
        }
      });

      if (batchSubtasks.length > 0) {
        const groupId = this.generateId();
        const batchableSubtasks: BatchableSubtask[] = batchSubtasks.map(subtask => ({
          ...subtask,
          batchGroupId: groupId,
          isBatchable: batchSubtasks.length > 1,
          injectedContext: this.generateIsolatedPrompt(subtask, {
            originalPrompt: workflow.prompt,
            scaffoldData: workflow,
            globalMetadata: {}
          })
        }));

        batchGroups.push({
          groupId,
          subtasks: batchableSubtasks,
          estimatedExecutionTime: this.estimateBatchExecutionTime(batchableSubtasks)
        });
      }
    }

    return batchGroups;
  }

  /**
   * Generates an isolated prompt for a subtask with full context
   */
  generateIsolatedPrompt(subtask: Subtask, parentContext: WorkflowContext): string {
    const contextPreamble = `# Task Context
Original Request: ${parentContext.originalPrompt}

# Current Subtask
Title: ${subtask.title}
Type: ${subtask.type}
Priority: ${subtask.priority}

# Task Description
${subtask.description}

# Dependencies Context`;

    // Add dependency context
    let dependencyContext = '';
    if (subtask.dependencies.length > 0) {
      dependencyContext = subtask.dependencies.map(dep => {
        const depSubtask = parentContext.scaffoldData.subtasks.find(s => s.id === dep.subtaskId);
        return depSubtask ? `- ${dep.type}: ${depSubtask.title}` : `- ${dep.type}: ${dep.subtaskId}`;
      }).join('\n');
    } else {
      dependencyContext = 'No dependencies';
    }

    const isolatedPrompt = `${contextPreamble}
${dependencyContext}

# Instructions
Please complete this subtask independently while keeping in mind the overall context and dependencies listed above. Provide a comprehensive response that addresses the specific requirements of this ${subtask.type.toLowerCase()} task.`;

    return isolatedPrompt;
  }

  /**
   * Enhanced slicing with large prompt handling
   */
  sliceAdvanced(prompt: string, config: TaskSliceConfig): LargePromptSlicingResult {
    const analysis = this.analyze(prompt);
    
    if (analysis.requiresLargePromptSlicing) {
      return this.sliceLargePrompt(prompt, config, analysis);
    } else {
      const subtasks = this.slice(prompt, config);
      return {
        subtasks,
        oversizedSegments: [],
        contextualLinks: new Map(),
        slicingStatistics: {
          originalTokenCount: analysis.tokenCount,
          averageTokensPerSubtask: analysis.tokenCount / subtasks.length,
          maxTokensInSubtask: Math.max(...subtasks.map(s => this.estimateTokenCount(s.description))),
          compressionRatio: 1.0,
          contextPreservationScore: 0.9
        }
      };
    }
  }

  /**
   * Handles large prompt slicing with semantic analysis
   */
  private sliceLargePrompt(
    prompt: string, 
    config: TaskSliceConfig, 
    analysis: PromptAnalysis
  ): LargePromptSlicingResult {
    const chunks = this.performSemanticChunking(prompt, config);
    const subtasks: Subtask[] = [];
    const oversizedSegments: string[] = [];
    const contextualLinks = new Map<string, string[]>();
    const workflowId = this.generateId();

    let totalTokensInSubtasks = 0;
    let maxTokensInSubtask = 0;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      if (chunk.tokenCount > config.maxTokensPerSubtask) {
        // Handle oversized chunks
        const subChunks = this.splitOversizedChunk(chunk, config.maxTokensPerSubtask);
        
        for (const subChunk of subChunks) {
          if (subChunk.tokenCount <= config.maxTokensPerSubtask) {
            const subtask = this.createSubtaskFromChunk(subChunk, i, workflowId, config);
            subtasks.push(subtask);
            totalTokensInSubtasks += subChunk.tokenCount;
            maxTokensInSubtask = Math.max(maxTokensInSubtask, subChunk.tokenCount);
          } else {
            oversizedSegments.push(subChunk.content);
          }
        }
      } else {
        const subtask = this.createSubtaskFromChunk(chunk, i, workflowId, config);
        subtasks.push(subtask);
        totalTokensInSubtasks += chunk.tokenCount;
        maxTokensInSubtask = Math.max(maxTokensInSubtask, chunk.tokenCount);
      }

      // Build contextual links if context preservation is enabled
      if (config.preserveContext) {
        const links = this.identifyContextualLinks(chunk, chunks);
        if (links.length > 0) {
          contextualLinks.set(chunk.content, links);
        }
      }
    }

    // Add dependencies based on contextual relationships
    this.addContextualDependencies(subtasks, contextualLinks);

    const slicingStatistics = {
      originalTokenCount: analysis.tokenCount,
      averageTokensPerSubtask: subtasks.length > 0 ? totalTokensInSubtasks / subtasks.length : 0,
      maxTokensInSubtask,
      compressionRatio: totalTokensInSubtasks / analysis.tokenCount,
      contextPreservationScore: this.calculateContextPreservationScore(contextualLinks, subtasks.length)
    };

    return {
      subtasks,
      oversizedSegments,
      contextualLinks,
      slicingStatistics
    };
  }

  /**
   * Slices a high-level prompt into subtasks based on configuration (legacy)
   */
  slice(prompt: string, config: TaskSliceConfig): Subtask[] {
    const analysis = this.analyze(prompt);
    const subtasks: Subtask[] = [];
    
    // Determine number of subtasks based on granularity and analysis
    const targetCount = config.granularity === 'fine' 
      ? Math.min(analysis.suggestedSliceCount * 2, config.maxSubtasks)
      : Math.min(analysis.suggestedSliceCount, config.maxSubtasks);
    
    // Create subtasks based on common workflow patterns
    const workflowId = this.generateId();
    
    for (let i = 0; i < targetCount; i++) {
      const subtaskType = this.determineSubtaskType(i, targetCount, analysis);
      const dependencies = this.determineDependencies(i, subtasks);
      
      const subtask: Subtask = {
        id: this.generateId(),
        title: this.generateSubtaskTitle(subtaskType, i + 1),
        description: this.generateSubtaskDescription(prompt, subtaskType, i + 1, targetCount),
        type: subtaskType,
        priority: this.determinePriority(i, targetCount),
        status: SubtaskStatus.PENDING,
        dependencies,
        createdAt: new Date(),
        updatedAt: new Date(),
        parentWorkflowId: workflowId,
        estimatedDuration: this.estimateSubtaskDuration(subtaskType, config.granularity)
      };
      
      subtasks.push(subtask);
    }
    
    return subtasks;
  }

  /**
   * Enhanced analysis with large prompt detection
   */
  analyze(prompt: string): PromptAnalysis {
    const sentences = this.splitIntoSentences(prompt);
    const paragraphs = prompt.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    const wordCount = prompt.split(/\s+/).length;
    const tokenCount = this.estimateTokenCount(prompt);
    const complexity = this.calculateComplexity(prompt, wordCount);
    
    // Enhanced type breakdown with better detection
    const estimatedTypeBreakdown: Record<SubtaskType, number> = {
      [SubtaskType.RESEARCH]: this.countKeywords(prompt, [
        'research', 'find', 'investigate', 'explore', 'discover', 'study', 'examine'
      ]) > 0 ? 1 : 0,
      [SubtaskType.ANALYSIS]: this.countKeywords(prompt, [
        'analyze', 'evaluate', 'compare', 'assess', 'review', 'critique', 'interpret'
      ]) > 0 ? 1 : 0,
      [SubtaskType.CREATION]: this.countKeywords(prompt, [
        'create', 'build', 'write', 'generate', 'develop', 'design', 'implement', 'construct'
      ]) > 0 ? 1 : 0,
      [SubtaskType.VALIDATION]: this.countKeywords(prompt, [
        'test', 'validate', 'verify', 'check', 'confirm', 'ensure', 'review'
      ]) > 0 ? 1 : 0
    };
    
    // Detect structured content
    const hasStructuredContent = this.detectStructuredContent(prompt);
    
    // Extract key topics
    const keyTopics = this.extractKeyTopics(prompt);
    
    // Determine if large prompt slicing is required
    const requiresLargePromptSlicing = tokenCount > 4000 || 
      sentences.length > 50 || 
      paragraphs.length > 10 ||
      complexity > 0.8;
    
    const suggestedSliceCount = this.calculateOptimalSliceCount(
      tokenCount, sentences.length, complexity
    );
    
    return {
      complexity,
      estimatedTypeBreakdown,
      suggestedSliceCount,
      tokenCount,
      sentenceCount: sentences.length,
      paragraphCount: paragraphs.length,
      hasStructuredContent,
      keyTopics,
      requiresLargePromptSlicing
    };
  }

  /**
   * Merges subtask results back into a coherent response
   */
  merge(subtasks: Subtask[]): string {
    const completedSubtasks = subtasks
      .filter(subtask => subtask.status === SubtaskStatus.COMPLETED && subtask.result)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    
    if (completedSubtasks.length === 0) {
      return 'No completed subtasks to merge.';
    }
    
    let mergedResult = '# Compiled Results\n\n';
    
    completedSubtasks.forEach((subtask, index) => {
      mergedResult += `## ${subtask.title}\n`;
      mergedResult += `${subtask.result!.content}\n\n`;
      
      if (subtask.result!.errors && subtask.result!.errors.length > 0) {
        mergedResult += `**Errors encountered:**\n`;
        subtask.result!.errors.forEach(error => {
          mergedResult += `- ${error}\n`;
        });
        mergedResult += '\n';
      }
    });
    
    return mergedResult.trim();
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  /**
   * Performs semantic chunking of large prompts
   */
  private performSemanticChunking(prompt: string, config: TaskSliceConfig): SemanticChunk[] {
    const sentences = this.splitIntoSentences(prompt);
    const chunks: SemanticChunk[] = [];
    
    if (config.slicingStrategy === 'semantic') {
      return this.semanticChunking(sentences, config.maxTokensPerSubtask);
    } else if (config.slicingStrategy === 'structural') {
      return this.structuralChunking(prompt, config.maxTokensPerSubtask);
    } else {
      return this.balancedChunking(sentences, config.maxTokensPerSubtask);
    }
  }

  /**
   * Semantic chunking based on topic similarity
   */
  private semanticChunking(sentences: string[], maxTokens: number): SemanticChunk[] {
    const chunks: SemanticChunk[] = [];
    let currentChunk: string[] = [];
    let currentTokens = 0;
    let currentTopics: Set<string> = new Set();
    
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      const sentenceTokens = this.estimateTokenCount(sentence);
      const sentenceTopics = this.extractTopicsFromSentence(sentence);
      
      // Check if adding this sentence would exceed token limit
      if (currentTokens + sentenceTokens > maxTokens && currentChunk.length > 0) {
        // Finalize current chunk
        chunks.push({
          content: currentChunk.join(' '),
          tokenCount: currentTokens,
          topics: Array.from(currentTopics),
          sentenceStart: i - currentChunk.length,
          sentenceEnd: i - 1,
          importance: this.calculateChunkImportance(currentChunk)
        });
        
        // Reset for new chunk
        currentChunk = [];
        currentTokens = 0;
        currentTopics.clear();
      }
      
      currentChunk.push(sentence);
      currentTokens += sentenceTokens;
      sentenceTopics.forEach(topic => currentTopics.add(topic));
    }
    
    // Add final chunk
    if (currentChunk.length > 0) {
      chunks.push({
        content: currentChunk.join(' '),
        tokenCount: currentTokens,
        topics: Array.from(currentTopics),
        sentenceStart: sentences.length - currentChunk.length,
        sentenceEnd: sentences.length - 1,
        importance: this.calculateChunkImportance(currentChunk)
      });
    }
    
    return chunks;
  }

  /**
   * Structural chunking based on document structure
   */
  private structuralChunking(prompt: string, maxTokens: number): SemanticChunk[] {
    const sections = this.identifyStructuralSections(prompt);
    const chunks: SemanticChunk[] = [];
    
    for (const section of sections) {
      const sectionTokens = this.estimateTokenCount(section);
      
      if (sectionTokens <= maxTokens) {
        chunks.push({
          content: section,
          tokenCount: sectionTokens,
          topics: this.extractTopicsFromSentence(section),
          sentenceStart: 0,
          sentenceEnd: this.splitIntoSentences(section).length - 1,
          importance: this.calculateChunkImportance([section])
        });
      } else {
        // Split oversized sections
        const sentences = this.splitIntoSentences(section);
        const subChunks = this.semanticChunking(sentences, maxTokens);
        chunks.push(...subChunks);
      }
    }
    
    return chunks;
  }

  /**
   * Balanced chunking that considers both semantics and size
   */
  private balancedChunking(sentences: string[], maxTokens: number): SemanticChunk[] {
    // Use semantic chunking but with stricter size constraints
    const targetTokens = Math.floor(maxTokens * 0.8); // 80% of max for safety
    return this.semanticChunking(sentences, targetTokens);
  }

  /**
   * Enhanced complexity calculation
   */
  private calculateComplexity(prompt: string, wordCount: number): number {
    let complexity = 0.2; // Base complexity
    
    // Word count scaling
    if (wordCount > 100) complexity += 0.1;
    if (wordCount > 300) complexity += 0.15;
    if (wordCount > 800) complexity += 0.2;
    if (wordCount > 1500) complexity += 0.25;
    
    // Technical complexity indicators
    const technicalKeywords = [
      'implement', 'algorithm', 'system', 'architecture', 'integration',
      'framework', 'protocol', 'optimization', 'scalability', 'performance'
    ];
    complexity += Math.min(0.3, this.countKeywords(prompt, technicalKeywords) * 0.05);
    
    // Multi-step process indicators
    const processKeywords = [
      'first', 'then', 'finally', 'after', 'next', 'step', 'phase',
      'subsequently', 'following', 'preceding'
    ];
    complexity += Math.min(0.2, this.countKeywords(prompt, processKeywords) * 0.03);
    
    // Structural complexity
    const lists = (prompt.match(/\n\s*[-*]\s/g) || []).length;
    const numberedLists = (prompt.match(/\n\s*\d+\./g) || []).length;
    complexity += Math.min(0.15, (lists + numberedLists) * 0.02);
    
    return Math.min(1.0, complexity);
  }

  private countKeywords(text: string, keywords: string[]): number {
    const lowerText = text.toLowerCase();
    return keywords.reduce((count, keyword) => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'g');
      const matches = lowerText.match(regex);
      return count + (matches ? matches.length : 0);
    }, 0);
  }

  private determineSubtaskType(index: number, totalCount: number, analysis: PromptAnalysis): SubtaskType {
    // Simple pattern: research first, then creation, then validation
    if (index === 0 && analysis.estimatedTypeBreakdown[SubtaskType.RESEARCH] > 0) {
      return SubtaskType.RESEARCH;
    }
    
    if (index === totalCount - 1 && analysis.estimatedTypeBreakdown[SubtaskType.VALIDATION] > 0) {
      return SubtaskType.VALIDATION;
    }
    
    if (analysis.estimatedTypeBreakdown[SubtaskType.CREATION] > 0) {
      return SubtaskType.CREATION;
    }
    
    return SubtaskType.ANALYSIS;
  }

  private determineDependencies(index: number, existingSubtasks: Subtask[]): SubtaskDependency[] {
    const dependencies: SubtaskDependency[] = [];
    
    // Sequential dependencies: each task depends on the previous one
    if (index > 0 && existingSubtasks.length > 0) {
      const previousSubtask = existingSubtasks[existingSubtasks.length - 1];
      dependencies.push({
        subtaskId: previousSubtask.id,
        type: 'BLOCKING',
        description: 'Sequential dependency on previous subtask'
      });
    }
    
    return dependencies;
  }

  private generateSubtaskTitle(type: SubtaskType, index: number): string {
    const titles = {
      [SubtaskType.RESEARCH]: `Research Phase ${index}`,
      [SubtaskType.ANALYSIS]: `Analysis Phase ${index}`,
      [SubtaskType.CREATION]: `Creation Phase ${index}`,
      [SubtaskType.VALIDATION]: `Validation Phase ${index}`
    };
    
    return titles[type];
  }

  private generateSubtaskDescription(prompt: string, type: SubtaskType, index: number, totalCount: number): string {
    const promptSnippet = prompt.length > 100 ? prompt.substring(0, 97) + '...' : prompt;
    
    const descriptions = {
      [SubtaskType.RESEARCH]: `Conduct research and gather information relevant to: "${promptSnippet}"`,
      [SubtaskType.ANALYSIS]: `Analyze the requirements and plan the approach for: "${promptSnippet}"`,
      [SubtaskType.CREATION]: `Execute and create the deliverable for: "${promptSnippet}"`,
      [SubtaskType.VALIDATION]: `Validate and review the results for: "${promptSnippet}"`
    };
    
    return descriptions[type];
  }

  private determinePriority(index: number, totalCount: number): Priority {
    // First and last tasks are typically high priority
    if (index === 0 || index === totalCount - 1) {
      return Priority.HIGH;
    }
    
    return Priority.MEDIUM;
  }

  /**
   * Utility methods for large prompt processing
   */
  private estimateTokenCount(text: string): number {
    // Rough estimation: 1 token ≈ 4 characters for English text
    return Math.ceil(text.length / 4);
  }

  private splitIntoSentences(text: string): string[] {
    return text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  }

  private detectStructuredContent(prompt: string): boolean {
    const structureIndicators = [
      /\n\s*[-*]\s/, // Bullet points
      /\n\s*\d+\./, // Numbered lists
      /\n\s*#{1,6}\s/, // Markdown headers
      /\n\s*\w+:\s*$/, // Key-value pairs
      /\|.*\|/ // Tables
    ];
    
    return structureIndicators.some(pattern => pattern.test(prompt));
  }

  private extractKeyTopics(prompt: string): string[] {
    // Simple topic extraction based on frequently occurring nouns
    const words = prompt.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
    const wordFreq = new Map<string, number>();
    
    words.forEach(word => {
      if (!this.isStopWord(word)) {
        wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
      }
    });
    
    return Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
  }

  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'any', 'can', 'had',
      'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how',
      'its', 'may', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did',
      'she', 'use', 'her', 'now', 'oil', 'sit', 'word', 'says', 'each', 'which',
      'their', 'time', 'will', 'about', 'after', 'would', 'there', 'could', 'other'
    ]);
    return stopWords.has(word);
  }

  private calculateOptimalSliceCount(
    tokenCount: number, 
    sentenceCount: number, 
    complexity: number
  ): number {
    let baseCount = Math.ceil(tokenCount / 1000); // Base: 1 subtask per 1000 tokens
    
    // Adjust based on sentence density
    if (sentenceCount > 20) baseCount += Math.ceil(sentenceCount / 20);
    
    // Adjust based on complexity
    baseCount = Math.ceil(baseCount * (1 + complexity));
    
    return Math.max(2, Math.min(20, baseCount));
  }

  private extractTopicsFromSentence(sentence: string): string[] {
    return this.extractKeyTopics(sentence).slice(0, 3);
  }

  private calculateChunkImportance(sentences: string[]): number {
    const text = sentences.join(' ');
    let importance = 0.5; // Base importance
    
    // Increase importance based on action words
    const actionWords = ['create', 'implement', 'build', 'design', 'develop'];
    importance += this.countKeywords(text, actionWords) * 0.1;
    
    // Increase importance based on technical terms
    const techWords = ['system', 'algorithm', 'framework', 'architecture'];
    importance += this.countKeywords(text, techWords) * 0.05;
    
    return Math.min(1.0, importance);
  }

  private identifyStructuralSections(prompt: string): string[] {
    // Split by headers, paragraphs, or major structural elements
    const sections = prompt.split(/\n\s*#{1,6}\s.*\n|\n\s*\n/)
      .filter(section => section.trim().length > 0);
    
    return sections.length > 1 ? sections : [prompt];
  }

  private splitOversizedChunk(
    chunk: SemanticChunk, 
    maxTokens: number
  ): SemanticChunk[] {
    const sentences = this.splitIntoSentences(chunk.content);
    return this.semanticChunking(sentences, maxTokens);
  }

  private createSubtaskFromChunk(
    chunk: SemanticChunk, 
    index: number, 
    workflowId: string, 
    config: TaskSliceConfig
  ): Subtask {
    const subtaskType = this.determineSubtaskTypeFromChunk(chunk);
    
    return {
      id: this.generateId(),
      title: `${subtaskType} - Segment ${index + 1}`,
      description: chunk.content,
      type: subtaskType,
      priority: chunk.importance > 0.7 ? Priority.HIGH : Priority.MEDIUM,
      status: SubtaskStatus.PENDING,
      dependencies: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      parentWorkflowId: workflowId,
      estimatedDuration: this.estimateSubtaskDuration(subtaskType, config.granularity),
      metadata: {
        tokenCount: chunk.tokenCount,
        topics: chunk.topics,
        importance: chunk.importance
      }
    };
  }

  private determineSubtaskTypeFromChunk(chunk: SemanticChunk): SubtaskType {
    const content = chunk.content.toLowerCase();
    
    if (this.countKeywords(content, ['research', 'find', 'investigate']) > 0) {
      return SubtaskType.RESEARCH;
    }
    if (this.countKeywords(content, ['create', 'build', 'implement']) > 0) {
      return SubtaskType.CREATION;
    }
    if (this.countKeywords(content, ['test', 'validate', 'verify']) > 0) {
      return SubtaskType.VALIDATION;
    }
    
    return SubtaskType.ANALYSIS;
  }

  private identifyContextualLinks(
    chunk: SemanticChunk, 
    allChunks: SemanticChunk[]
  ): string[] {
    const links: string[] = [];
    const chunkTopics = new Set(chunk.topics);
    
    for (const otherChunk of allChunks) {
      if (otherChunk === chunk) continue;
      
      const commonTopics = otherChunk.topics.filter(topic => chunkTopics.has(topic));
      if (commonTopics.length > 0) {
        links.push(otherChunk.content);
      }
    }
    
    return links;
  }

  private addContextualDependencies(
    subtasks: Subtask[], 
    contextualLinks: Map<string, string[]>
  ): void {
    const contentToSubtask = new Map<string, Subtask>();
    subtasks.forEach(subtask => {
      contentToSubtask.set(subtask.description, subtask);
    });
    
    for (const [content, links] of contextualLinks.entries()) {
      const subtask = contentToSubtask.get(content);
      if (subtask) {
        for (const link of links) {
          const linkedSubtask = contentToSubtask.get(link);
          if (linkedSubtask && linkedSubtask.id !== subtask.id) {
            subtask.dependencies.push({
              subtaskId: linkedSubtask.id,
              type: 'SOFT',
              description: 'Contextual relationship detected',
              priority: Priority.LOW
            });
          }
        }
      }
    }
  }

  private calculateContextPreservationScore(
    contextualLinks: Map<string, string[]>, 
    subtaskCount: number
  ): number {
    const totalLinks = Array.from(contextualLinks.values())
      .reduce((sum, links) => sum + links.length, 0);
    
    // Higher score for more contextual links relative to subtask count
    return Math.min(1.0, totalLinks / (subtaskCount * 2));
  }

  private estimateSubtaskDuration(type: SubtaskType, granularity: 'fine' | 'coarse'): number {
    const baseDurations = {
      [SubtaskType.RESEARCH]: 15,
      [SubtaskType.ANALYSIS]: 10,
      [SubtaskType.CREATION]: 20,
      [SubtaskType.VALIDATION]: 10
    };
    
    const multiplier = granularity === 'fine' ? 0.7 : 1.3;
    return Math.round(baseDurations[type] * multiplier);
  }

  private estimateBatchExecutionTime(subtasks: BatchableSubtask[]): number {
    if (subtasks.length === 0) return 0;
    
    // For parallel execution, time is roughly the longest subtask plus some overhead
    const maxDuration = Math.max(...subtasks.map(s => s.estimatedDuration || 15));
    const overhead = Math.min(5, subtasks.length * 0.5); // Coordination overhead
    
    return maxDuration + overhead;
  }
}