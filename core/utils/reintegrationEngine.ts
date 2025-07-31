/**
 * Structured reintegration interface with proper ordering and context preservation
 */

import { SubtaskExecutionResult, ExecutionStatus } from '../types/executionTypes';
import { Subtask, SubtaskType } from '../types/subtaskSchema';
import { ResultStore, StoredSubtaskResult, ReintegrationData, DependencyNode } from './resultStore';

export interface ReintegrationConfig {
  preserveOriginalStructure: boolean;
  includeMetadata: boolean;
  formatStyle: 'markdown' | 'html' | 'json' | 'plain';
  sectioning: 'by-type' | 'by-dependency' | 'by-execution-order' | 'custom';
  includeDiagnostics: boolean;
  maxContentLength?: number;
  templateOverrides?: Record<string, string>;
}

export interface ReintegrationResult {
  content: string;
  metadata: {
    totalSubtasks: number;
    successfulSubtasks: number;
    failedSubtasks: number;
    executionTime: number;
    reintegrationTime: number;
    contentLength: number;
    qualityScore: number;
    completenessScore: number;
  };
  diagnostics: {
    missingDependencies: string[];
    orphanedResults: string[];
    inconsistencies: string[];
    warnings: string[];
  };
  structure: ReintegrationStructure;
}

export interface ReintegrationStructure {
  sections: ReintegrationSection[];
  dependencyMap: Map<string, string[]>;
  executionFlowMap: Map<number, string[]>;
  topicClusters: Map<string, string[]>;
}

export interface ReintegrationSection {
  id: string;
  title: string;
  content: string;
  type: SubtaskType;
  subtaskIds: string[];
  dependencies: string[];
  level: number;
  qualityIndicators: {
    completeness: number;
    coherence: number;
    relevance: number;
  };
}

export interface ContentTemplate {
  header: string;
  sectionHeader: string;
  subsectionHeader: string;
  contentBlock: string;
  footer: string;
  errorBlock: string;
  metadataBlock: string;
}

export class ReintegrationEngine {
  private resultStore: ResultStore;
  private templates: Map<string, ContentTemplate>;

  constructor(resultStore: ResultStore) {
    this.resultStore = resultStore;
    this.templates = new Map();
    this.initializeTemplates();
  }

  /**
   * Main reintegration method with comprehensive result assembly
   */
  async reintegrateResults(
    workflowId: string,
    config: ReintegrationConfig = this.getDefaultConfig()
  ): Promise<ReintegrationResult> {
    const startTime = Date.now();
    
    // Get comprehensive reintegration data
    const reintegrationData = await this.resultStore.getReintegrationData(workflowId);
    
    // Validate data integrity
    const diagnostics = await this.validateReintegrationData(reintegrationData);
    
    // Build structured representation
    const structure = await this.buildReintegrationStructure(reintegrationData, config);
    
    // Generate final content
    const content = await this.generateContent(structure, config);
    
    // Calculate quality metrics
    const metadata = this.calculateMetadata(reintegrationData, content, startTime);
    
    return {
      content,
      metadata,
      diagnostics,
      structure
    };
  }

  /**
   * Validates reintegration data for completeness and consistency
   */
  private async validateReintegrationData(data: ReintegrationData): Promise<any> {
    const diagnostics = {
      missingDependencies: [] as string[],
      orphanedResults: [] as string[],
      inconsistencies: [] as string[],
      warnings: [] as string[]
    };

    const resultIds = new Set(data.subtaskResults.map(r => r.subtaskId));
    
    // Check for missing dependencies
    for (const result of data.subtaskResults) {
      for (const depId of result.dependencyChain) {
        if (!resultIds.has(depId)) {
          diagnostics.missingDependencies.push(
            `Subtask ${result.subtaskId} depends on missing subtask ${depId}`
          );
        }
      }
    }

    // Check for orphaned results (no dependents)
    const dependentIds = new Set<string>();
    data.dependencyGraph.forEach(node => {
      node.dependents.forEach(dep => dependentIds.add(dep));
    });

    for (const result of data.subtaskResults) {
      if (!dependentIds.has(result.subtaskId) && 
          result.dependencyChain.length === 0 && 
          data.subtaskResults.length > 1) {
        diagnostics.orphanedResults.push(result.subtaskId);
      }
    }

    // Check execution order consistency
    const sortedByOrder = [...data.subtaskResults].sort((a, b) => a.executionOrder - b.executionOrder);
    const sortedByLevel = [...data.subtaskResults].sort((a, b) => a.executionLevel - b.executionLevel);
    
    for (let i = 0; i < sortedByOrder.length; i++) {
      if (sortedByOrder[i].subtaskId !== sortedByLevel[i].subtaskId) {
        // Check if this is a valid inconsistency
        const orderTask = sortedByOrder[i];
        const levelTask = sortedByLevel[i];
        if (orderTask.executionLevel < levelTask.executionLevel) {
          diagnostics.inconsistencies.push(
            `Execution order inconsistency: ${orderTask.subtaskId} executed before ${levelTask.subtaskId} despite dependency relationship`
          );
        }
      }
    }

    // Check for failed critical tasks
    const failedTasks = data.subtaskResults.filter(r => r.status === ExecutionStatus.FAILED);
    if (failedTasks.length > 0) {
      diagnostics.warnings.push(`${failedTasks.length} subtasks failed execution`);
    }

    return diagnostics;
  }

  /**
   * Builds comprehensive reintegration structure
   */
  private async buildReintegrationStructure(
    data: ReintegrationData,
    config: ReintegrationConfig
  ): Promise<ReintegrationStructure> {
    const sections: ReintegrationSection[] = [];
    const dependencyMap = new Map<string, string[]>();
    const executionFlowMap = new Map<number, string[]>();
    const topicClusters = new Map<string, string[]>();

    // Build dependency map
    data.dependencyGraph.forEach(node => {
      dependencyMap.set(node.subtaskId, node.dependencies);
    });

    // Build execution flow map
    data.subtaskResults.forEach(result => {
      const level = result.executionLevel;
      const levelTasks = executionFlowMap.get(level) || [];
      levelTasks.push(result.subtaskId);
      executionFlowMap.set(level, levelTasks);
    });

    // Build topic clusters
    this.buildTopicClusters(data.subtaskResults, topicClusters);

    // Create sections based on configuration
    switch (config.sectioning) {
      case 'by-type':
        await this.createSectionsByType(data, sections, config);
        break;
      case 'by-dependency':
        await this.createSectionsByDependency(data, sections, config);
        break;
      case 'by-execution-order':
        await this.createSectionsByExecutionOrder(data, sections, config);
        break;
      default:
        await this.createSectionsByType(data, sections, config);
    }

    return {
      sections,
      dependencyMap,
      executionFlowMap,
      topicClusters
    };
  }

  /**
   * Creates sections organized by subtask type
   */
  private async createSectionsByType(
    data: ReintegrationData,
    sections: ReintegrationSection[],
    config: ReintegrationConfig
  ): Promise<void> {
    const typeGroups = new Map<SubtaskType, StoredSubtaskResult[]>();
    
    // Group results by type
    data.subtaskResults.forEach(result => {
      const subtask = this.findSubtaskFromResult(result, data);
      if (subtask && subtask.type) {
        const group = typeGroups.get(subtask.type) || [];
        group.push(result);
        typeGroups.set(subtask.type, group);
      }
    });

    // Create sections for each type
    for (const [type, results] of typeGroups.entries()) {
      const section = await this.createSection(
        `${type}_section`,
        this.getTypeTitle(type),
        results,
        type,
        config
      );
      sections.push(section);
    }
  }

  /**
   * Creates sections organized by dependency levels
   */
  private async createSectionsByDependency(
    data: ReintegrationData,
    sections: ReintegrationSection[],
    config: ReintegrationConfig
  ): Promise<void> {
    const levelGroups = new Map<number, StoredSubtaskResult[]>();
    
    // Group by execution level (dependency depth)
    data.subtaskResults.forEach(result => {
      const level = result.executionLevel;
      const group = levelGroups.get(level) || [];
      group.push(result);
      levelGroups.set(level, group);
    });

    // Create sections for each level
    const sortedLevels = Array.from(levelGroups.keys()).sort();
    for (const level of sortedLevels) {
      const results = levelGroups.get(level)!;
      const section = await this.createSection(
        `level_${level}_section`,
        `Execution Level ${level + 1}`,
        results,
        this.inferSectionType(results),
        config
      );
      section.level = level;
      sections.push(section);
    }
  }

  /**
   * Creates sections organized by execution order
   */
  private async createSectionsByExecutionOrder(
    data: ReintegrationData,
    sections: ReintegrationSection[],
    config: ReintegrationConfig
  ): Promise<void> {
    // Sort by execution order
    const sortedResults = [...data.subtaskResults].sort(
      (a, b) => a.executionOrder - b.executionOrder
    );

    // Create batch groups (group consecutive results)
    const batchGroups = this.createExecutionBatches(sortedResults);
    
    for (let i = 0; i < batchGroups.length; i++) {
      const batch = batchGroups[i];
      const section = await this.createSection(
        `batch_${i}_section`,
        `Execution Batch ${i + 1}`,
        batch,
        this.inferSectionType(batch),
        config
      );
      sections.push(section);
    }
  }

  /**
   * Creates a reintegration section from results
   */
  private async createSection(
    id: string,
    title: string,
    results: StoredSubtaskResult[],
    type: SubtaskType,
    config: ReintegrationConfig
  ): Promise<ReintegrationSection> {
    // Sort results within section by execution order
    const sortedResults = results.sort((a, b) => a.executionOrder - b.executionOrder);
    
    // Build content
    let content = '';
    const subtaskIds: string[] = [];
    const dependencies = new Set<string>();

    for (const result of sortedResults) {
      subtaskIds.push(result.subtaskId);
      
      // Add dependencies
      result.dependencyChain.forEach(dep => dependencies.add(dep));
      
      // Build content block
      if (result.status === ExecutionStatus.COMPLETED && result.result) {
        content += this.formatResultContent(result, config);
      } else if (result.status === ExecutionStatus.FAILED) {
        content += this.formatErrorContent(result, config);
      }
    }

    // Calculate quality indicators
    const qualityIndicators = this.calculateSectionQuality(sortedResults);

    return {
      id,
      title,
      content: content.trim(),
      type,
      subtaskIds,
      dependencies: Array.from(dependencies),
      level: Math.max(...sortedResults.map(r => r.executionLevel)),
      qualityIndicators
    };
  }

  /**
   * Generates final content from structure
   */
  private async generateContent(
    structure: ReintegrationStructure,
    config: ReintegrationConfig
  ): Promise<string> {
    const template = this.templates.get(config.formatStyle) || this.templates.get('markdown')!;
    let content = template.header;

    // Add sections
    for (const section of structure.sections) {
      content += template.sectionHeader.replace('{title}', section.title);
      content += section.content;
      
      if (config.includeMetadata) {
        content += this.formatSectionMetadata(section, template);
      }
    }

    // Add diagnostics if requested
    if (config.includeDiagnostics) {
      content += template.sectionHeader.replace('{title}', 'Diagnostics');
      content += this.formatDiagnostics(structure, template);
    }

    content += template.footer;

    // Apply content length limits if specified
    if (config.maxContentLength && content.length > config.maxContentLength) {
      content = this.truncateContent(content, config.maxContentLength);
    }

    return content;
  }

  /**
   * Helper methods
   */
  private buildTopicClusters(
    results: StoredSubtaskResult[],
    topicClusters: Map<string, string[]>
  ): void {
    results.forEach(result => {
      if (result.result?.metadata?.topics) {
        const topics = result.result.metadata.topics as string[];
        topics.forEach(topic => {
          const cluster = topicClusters.get(topic) || [];
          cluster.push(result.subtaskId);
          topicClusters.set(topic, cluster);
        });
      }
    });
  }

  private findSubtaskFromResult(
    result: StoredSubtaskResult,
    data: ReintegrationData
  ): Subtask | null {
    // In a real implementation, this would look up the original subtask
    // For now, we'll infer the type from the result
    return null;
  }

  private getTypeTitle(type: SubtaskType): string {
    const titles = {
      [SubtaskType.RESEARCH]: 'Research & Discovery',
      [SubtaskType.ANALYSIS]: 'Analysis & Evaluation',
      [SubtaskType.CREATION]: 'Creation & Implementation',
      [SubtaskType.VALIDATION]: 'Validation & Testing'
    };
    return titles[type] || 'Unknown Type';
  }

  private inferSectionType(results: StoredSubtaskResult[]): SubtaskType {
    // Simple heuristic: most common type in the results
    const typeCounts = new Map<SubtaskType, number>();
    
    // For now, default to ANALYSIS since we don't have direct type info
    return SubtaskType.ANALYSIS;
  }

  private createExecutionBatches(results: StoredSubtaskResult[]): StoredSubtaskResult[][] {
    const batches: StoredSubtaskResult[][] = [];
    let currentBatch: StoredSubtaskResult[] = [];
    let lastBatchId = '';

    for (const result of results) {
      if (result.batchId !== lastBatchId && currentBatch.length > 0) {
        batches.push(currentBatch);
        currentBatch = [];
      }
      currentBatch.push(result);
      lastBatchId = result.batchId;
    }

    if (currentBatch.length > 0) {
      batches.push(currentBatch);
    }

    return batches;
  }

  private formatResultContent(result: StoredSubtaskResult, config: ReintegrationConfig): string {
    const template = this.templates.get(config.formatStyle)!;
    let content = template.contentBlock;
    
    content = content.replace('{subtaskId}', result.subtaskId);
    content = content.replace('{content}', result.result?.content || '');
    content = content.replace('{timestamp}', result.storageTimestamp.toISOString());
    
    return content;
  }

  private formatErrorContent(result: StoredSubtaskResult, config: ReintegrationConfig): string {
    const template = this.templates.get(config.formatStyle)!;
    let content = template.errorBlock;
    
    content = content.replace('{subtaskId}', result.subtaskId);
    content = content.replace('{error}', result.validationResult.errors.join(', '));
    content = content.replace('{timestamp}', result.storageTimestamp.toISOString());
    
    return content;
  }

  private calculateSectionQuality(results: StoredSubtaskResult[]): any {
    const completedCount = results.filter(r => r.status === ExecutionStatus.COMPLETED).length;
    const totalCount = results.length;
    
    return {
      completeness: totalCount > 0 ? completedCount / totalCount : 0,
      coherence: 0.8, // Placeholder - would calculate based on content analysis
      relevance: 0.9   // Placeholder - would calculate based on topic matching
    };
  }

  private formatSectionMetadata(section: ReintegrationSection, template: ContentTemplate): string {
    let metadata = template.metadataBlock;
    metadata = metadata.replace('{subtaskCount}', section.subtaskIds.length.toString());
    metadata = metadata.replace('{completeness}', (section.qualityIndicators.completeness * 100).toFixed(1));
    return metadata;
  }

  private formatDiagnostics(structure: ReintegrationStructure, template: ContentTemplate): string {
    return `
**Sections Created:** ${structure.sections.length}
**Dependency Relationships:** ${structure.dependencyMap.size}
**Execution Levels:** ${structure.executionFlowMap.size}
**Topic Clusters:** ${structure.topicClusters.size}
`;
  }

  private calculateMetadata(data: ReintegrationData, content: string, startTime: number): any {
    const successful = data.subtaskResults.filter(r => r.status === ExecutionStatus.COMPLETED).length;
    const failed = data.subtaskResults.filter(r => r.status === ExecutionStatus.FAILED).length;
    
    return {
      totalSubtasks: data.subtaskResults.length,
      successfulSubtasks: successful,
      failedSubtasks: failed,
      executionTime: data.executionSummary.totalDuration,
      reintegrationTime: Date.now() - startTime,
      contentLength: content.length,
      qualityScore: successful / data.subtaskResults.length,
      completenessScore: (data.subtaskResults.length - failed) / data.subtaskResults.length
    };
  }

  private truncateContent(content: string, maxLength: number): string {
    if (content.length <= maxLength) return content;
    
    const truncated = content.substring(0, maxLength - 3);
    const lastNewline = truncated.lastIndexOf('\n');
    
    return truncated.substring(0, lastNewline) + '\n\n[Content truncated...]';
  }

  private getDefaultConfig(): ReintegrationConfig {
    return {
      preserveOriginalStructure: true,
      includeMetadata: true,
      formatStyle: 'markdown',
      sectioning: 'by-type',
      includeDiagnostics: false
    };
  }

  private initializeTemplates(): void {
    // Markdown template
    this.templates.set('markdown', {
      header: '# Workflow Results\n\n',
      sectionHeader: '## {title}\n\n',
      subsectionHeader: '### {title}\n\n',
      contentBlock: '**Subtask {subtaskId}**\n\n{content}\n\n',
      footer: '\n---\n*Generated by Supercollider*\n',
      errorBlock: '**Error in {subtaskId}**: {error}\n\n',
      metadataBlock: '*{subtaskCount} subtasks, {completeness}% complete*\n\n'
    });

    // HTML template
    this.templates.set('html', {
      header: '<html><body><h1>Workflow Results</h1>',
      sectionHeader: '<h2>{title}</h2>',
      subsectionHeader: '<h3>{title}</h3>',
      contentBlock: '<div class="subtask"><strong>{subtaskId}</strong><p>{content}</p></div>',
      footer: '<footer><em>Generated by Supercollider</em></footer></body></html>',
      errorBlock: '<div class="error"><strong>Error in {subtaskId}</strong>: {error}</div>',
      metadataBlock: '<div class="metadata"><em>{subtaskCount} subtasks, {completeness}% complete</em></div>'
    });

    // Plain text template
    this.templates.set('plain', {
      header: 'WORKFLOW RESULTS\n================\n\n',
      sectionHeader: '{title}\n' + '-'.repeat(20) + '\n\n',
      subsectionHeader: '{title}\n\n',
      contentBlock: 'Subtask {subtaskId}:\n{content}\n\n',
      footer: '\n--\nGenerated by Supercollider\n',
      errorBlock: 'ERROR in {subtaskId}: {error}\n\n',
      metadataBlock: '({subtaskCount} subtasks, {completeness}% complete)\n\n'
    });
  }
}