/**
 * Enhanced Context Rehydration System with Todo Generation and Progress Tracking
 * For enriching subtask prompts with relevant context and granular progress tracking
 */

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

// New interfaces for todo generation and progress tracking
export interface TodoItem {
  id: string;
  title: string;
  description: string;
  estimatedDurationMs: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  dependencies: string[]; // Array of todo item IDs
  startTime?: number;
  completionTime?: number;
  errorMessage?: string;
  progressPercentage: number; // 0-100
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

// Task pattern definitions for different subtask types
const TASK_PATTERNS = {
  'CREATION': {
    operations: ['understand_brief', 'brainstorm_concepts', 'select_approach', 'create_draft', 'refine_content', 'final_review'],
    avgDurationPerOp: 150000, // 2.5 minutes
    dependencies: { 
      'create_draft': ['understand_brief', 'select_approach'],
      'refine_content': ['create_draft'],
      'final_review': ['refine_content']
    }
  },
  'RESEARCH': {
    operations: ['define_scope', 'identify_sources', 'gather_data', 'analyze_findings', 'synthesize_results', 'format_output'],
    avgDurationPerOp: 180000, // 3 minutes
    dependencies: { 
      'gather_data': ['define_scope', 'identify_sources'],
      'analyze_findings': ['gather_data'], 
      'synthesize_results': ['analyze_findings'],
      'format_output': ['synthesize_results']
    }
  },
  'ANALYSIS': {
    operations: ['examine_input', 'identify_patterns', 'compare_elements', 'draw_conclusions', 'validate_findings', 'present_results'],
    avgDurationPerOp: 120000, // 2 minutes
    dependencies: {
      'identify_patterns': ['examine_input'],
      'compare_elements': ['identify_patterns'],
      'draw_conclusions': ['compare_elements'],
      'validate_findings': ['draw_conclusions'],
      'present_results': ['validate_findings']
    }
  },
  'VALIDATION': {
    operations: ['review_requirements', 'check_accuracy', 'test_functionality', 'verify_compliance', 'document_results', 'recommend_improvements'],
    avgDurationPerOp: 100000, // 1.67 minutes
    dependencies: {
      'check_accuracy': ['review_requirements'],
      'test_functionality': ['check_accuracy'],
      'verify_compliance': ['test_functionality'],
      'document_results': ['verify_compliance'],
      'recommend_improvements': ['document_results']
    }
  }
} as const;

const PROGRESS_TEMPLATE = `
PROGRESS TRACKING REQUIRED:
Mark completion of each step with: [CHECKPOINT:{todoId}:COMPLETED]
Report progress updates with: [PROGRESS:{todoId}:{percentage}]
Flag issues with: [ISSUE:{todoId}:{errorDescription}]
Request assistance with: [HELP:{todoId}:{question}]

TODO CHECKLIST:
{generatedTodoItems}

Complete each item sequentially. Report progress after each step.
`;

export class DataInjector {
  private defaultConfig: InjectionConfig = {
    includeTone: true,
    includeFormat: true,
    includeOriginalPrompt: true,
    includeStyleGuide: true,
    maxContextLength: 4000
  };

  /**
   * Enhanced injection method that enriches subtask prompts with contextual data and todo lists
   */
  injectContextToSubtaskPrompt(
    subtask: Subtask,
    scaffold: Workflow,
    originalUserPrompt: string,
    config?: InjectionConfig
  ): EnhancedInjectedPrompt {
    const finalConfig = { ...this.defaultConfig, ...config };
    
    // Extract contextual data from original prompt and workflow
    const contextualData = this.extractContextualData(originalUserPrompt, scaffold);
    
    // Get relevant context for this specific subtask
    const relevantContext = this.extractRelevantContext(originalUserPrompt, subtask.type);
    
    // Build the enriched prompt
    const injectedPrompt = this.buildContextualPrompt(
      subtask,
      relevantContext,
      contextualData,
      finalConfig
    );
    
    // Compress if needed
    const finalPrompt = injectedPrompt.length > finalConfig.maxContextLength
      ? this.compressContext(injectedPrompt, finalConfig.maxContextLength)
      : injectedPrompt;

    // Generate todo list and progress tracking
    const taskComplexity = this.analyzeTaskComplexity(finalPrompt, subtask.type);
    const todoList = this.generateTodoList(subtask, finalPrompt, taskComplexity);
    const progressInstructions = this.generateProgressInstructions(todoList.todos);
    const checkpointMarkers = this.createCheckpointMarkers(todoList.todos);

    // Create enhanced prompt with progress tracking
    const enhancedPrompt = this.embedProgressTracking(finalPrompt, progressInstructions, todoList.todos);

    return {
      agentId: subtask.assignedAgentId || 'unassigned',
      subtaskId: subtask.id,
      injectedPrompt: enhancedPrompt,
      contextMetadata: {
        originalLength: subtask.description.length,
        injectedLength: enhancedPrompt.length,
        compressionRatio: enhancedPrompt.length / subtask.description.length
      },
      todoList,
      progressTrackingInstructions: progressInstructions,
      checkpointMarkers
    };
  }

  /**
   * Extract contextual data from the original prompt and workflow
   */
  private extractContextualData(originalPrompt: string, scaffold: Workflow): ContextualData {
    const contextualData: ContextualData = {};

    // Extract tone indicators
    contextualData.tone = this.extractTone(originalPrompt);
    
    // Extract format requirements
    contextualData.format = this.extractFormat(originalPrompt);
    
    // Extract style guide references
    contextualData.styleGuide = this.extractStyleGuide(originalPrompt);
    
    // Extract domain/subject matter
    contextualData.domain = this.extractDomain(originalPrompt);
    
    // Extract target audience
    contextualData.audience = this.extractAudience(originalPrompt);
    
    // Extract constraints
    contextualData.constraints = this.extractConstraints(originalPrompt);
    
    // Extract examples
    contextualData.examples = this.extractExamples(originalPrompt);

    return contextualData;
  }

  /**
   * Extract relevant context based on task type
   */
  extractRelevantContext(original: string, taskType: SubtaskType): string {
    const sentences = this.splitIntoSentences(original);
    const relevantSentences: string[] = [];
    
    // Define keywords for each task type
    const taskKeywords: Record<SubtaskType, string[]> = {
      [SubtaskType.RESEARCH]: [
        'research', 'find', 'investigate', 'explore', 'discover', 'study', 'examine',
        'source', 'data', 'information', 'evidence', 'facts', 'statistics'
      ],
      [SubtaskType.ANALYSIS]: [
        'analyze', 'evaluate', 'compare', 'assess', 'review', 'critique', 'interpret',
        'examine', 'breakdown', 'dissect', 'understand', 'explain', 'reasoning'
      ],
      [SubtaskType.CREATION]: [
        'create', 'build', 'write', 'generate', 'develop', 'design', 'implement',
        'construct', 'produce', 'compose', 'craft', 'make', 'draft'
      ],
      [SubtaskType.VALIDATION]: [
        'test', 'validate', 'verify', 'check', 'confirm', 'ensure', 'review',
        'quality', 'accuracy', 'correctness', 'compliance', 'standards'
      ]
    };

    const keywords = taskKeywords[taskType] || [];
    
    // Score sentences based on keyword relevance
    const scoredSentences = sentences.map(sentence => ({
      sentence,
      score: this.calculateRelevanceScore(sentence, keywords)
    }));
    
    // Sort by relevance and take top sentences
    scoredSentences
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.ceil(sentences.length * 0.6)) // Take top 60%
      .forEach(item => {
        if (item.score > 0) {
          relevantSentences.push(item.sentence);
        }
      });

    return relevantSentences.join(' ');
  }

  /**
   * Build the contextual prompt with all relevant information
   */
  private buildContextualPrompt(
    subtask: Subtask,
    relevantContext: string,
    contextualData: ContextualData,
    config: InjectionConfig
  ): string {
    let prompt = '';

    // Add custom prefix
    if (config.customPrefix) {
      prompt += `${config.customPrefix}\n\n`;
    }

    // Add original prompt context
    if (config.includeOriginalPrompt && relevantContext) {
      prompt += `# Original Context\n${relevantContext}\n\n`;
    }

    // Add tone guidance
    if (config.includeTone && contextualData.tone) {
      prompt += `# Tone & Style\n${contextualData.tone}\n\n`;
    }

    // Add format requirements
    if (config.includeFormat && contextualData.format) {
      prompt += `# Format Requirements\n${contextualData.format}\n\n`;
    }

    // Add style guide
    if (config.includeStyleGuide && contextualData.styleGuide) {
      prompt += `# Style Guidelines\n${contextualData.styleGuide}\n\n`;
    }

    // Add domain context
    if (contextualData.domain) {
      prompt += `# Domain Context\n${contextualData.domain}\n\n`;
    }

    // Add audience information
    if (contextualData.audience) {
      prompt += `# Target Audience\n${contextualData.audience}\n\n`;
    }

    // Add constraints
    if (contextualData.constraints && contextualData.constraints.length > 0) {
      prompt += `# Constraints\n${contextualData.constraints.map(c => `- ${c}`).join('\n')}\n\n`;
    }

    // Add examples if available
    if (contextualData.examples && contextualData.examples.length > 0) {
      prompt += `# Examples\n${contextualData.examples.join('\n\n')}\n\n`;
    }

    // Add the specific subtask
    prompt += `# Your Specific Task (${subtask.type})\n`;
    prompt += `**Title:** ${subtask.title}\n\n`;
    prompt += `**Description:** ${subtask.description}\n\n`;

    // Add priority and dependencies context
    if (subtask.priority) {
      prompt += `**Priority:** ${subtask.priority}\n\n`;
    }

    if (subtask.dependencies.length > 0) {
      prompt += `**Dependencies:** This task depends on: ${subtask.dependencies.map(d => d.subtaskId).join(', ')}\n\n`;
    }

    // Add task-specific instructions
    prompt += this.getTaskSpecificInstructions(subtask.type);

    // Add custom suffix
    if (config.customSuffix) {
      prompt += `\n\n${config.customSuffix}`;
    }

    return prompt.trim();
  }

  /**
   * Get task-specific instructions based on subtask type
   */
  private getTaskSpecificInstructions(taskType: SubtaskType): string {
    const instructions: Record<SubtaskType, string> = {
      [SubtaskType.RESEARCH]: `
# Research Instructions
- Provide comprehensive information with credible sources
- Include relevant data, statistics, and evidence
- Organize findings logically
- Cite sources when possible
- Flag any uncertainties or conflicting information`,

      [SubtaskType.ANALYSIS]: `
# Analysis Instructions
- Break down complex information into digestible parts
- Identify patterns, trends, and relationships
- Provide clear reasoning for conclusions
- Consider multiple perspectives
- Support findings with evidence from the context`,

      [SubtaskType.CREATION]: `
# Creation Instructions
- Follow the specified format and style requirements
- Ensure content aligns with the tone and audience
- Be creative while staying within constraints
- Provide well-structured, coherent output
- Include relevant details from the context`,

      [SubtaskType.VALIDATION]: `
# Validation Instructions  
- Check for accuracy and completeness
- Verify alignment with requirements and constraints
- Identify any inconsistencies or errors
- Provide specific feedback and recommendations
- Ensure quality standards are met`
    };

    return instructions[taskType] || '';
  }

  /**
   * Compress context to fit within length limits
   */
  compressContext(context: string, maxLength: number): string {
    if (context.length <= maxLength) {
      return context;
    }

    // Strategy 1: Remove examples first (they're often lengthy)
    let compressed = context.replace(/# Examples\n[\s\S]*?\n\n/g, '');
    
    if (compressed.length <= maxLength) {
      return compressed;
    }

    // Strategy 2: Compress verbose sections
    compressed = this.compressVerboseSections(compressed);
    
    if (compressed.length <= maxLength) {
      return compressed;
    }

    // Strategy 3: Truncate while preserving structure
    return this.intelligentTruncate(compressed, maxLength);
  }

  /**
   * Compress verbose sections while preserving meaning
   */
  private compressVerboseSections(text: string): string {
    // Remove excessive whitespace
    text = text.replace(/\n{3,}/g, '\n\n');
    
    // Compress bullet points (keep first few, summarize rest)
    text = text.replace(/^(- .+\n){4,}/gm, (match) => {
      const items = match.trim().split('\n');
      const firstThree = items.slice(0, 3).join('\n');
      const remaining = items.length - 3;
      return `${firstThree}\n- (and ${remaining} more items)\n`;
    });

    return text;
  }

  /**
   * Intelligently truncate while preserving important sections
   */
  private intelligentTruncate(text: string, maxLength: number): string {
    const sections = text.split(/\n# /);
    const importantSections = ['Your Specific Task', 'Original Context'];
    
    let result = sections[0]; // Keep the first part
    
    // Add important sections first
    for (const section of sections.slice(1)) {
      const sectionTitle = section.split('\n')[0];
      if (importantSections.some(important => sectionTitle.includes(important))) {
        const candidate = result + '\n# ' + section;
        if (candidate.length <= maxLength * 0.8) { // Leave room for other content
          result = candidate;
        }
      }
    }
    
    // Add other sections if space allows
    for (const section of sections.slice(1)) {
      const sectionTitle = section.split('\n')[0];
      if (!importantSections.some(important => sectionTitle.includes(important))) {
        const candidate = result + '\n# ' + section;
        if (candidate.length <= maxLength) {
          result = candidate;
        } else {
          break; // Stop adding sections
        }
      }
    }
    
    // Final truncation if still too long
    if (result.length > maxLength) {
      result = result.substring(0, maxLength - 3) + '...';
    }
    
    return result;
  }

  // Extraction helper methods
  private extractTone(text: string): string | undefined {
    const tonePatterns = [
      /tone[:\s]+([\w\s,]+)/i,
      /(formal|informal|professional|casual|friendly|authoritative|conversational)/i,
      /style[:\s]+([\w\s,]+)/i
    ];

    for (const pattern of tonePatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1] || match[0];
      }
    }

    return undefined;
  }

  private extractFormat(text: string): string | undefined {
    const formatPatterns = [
      /format[:\s]+([\w\s,.-]+)/i,
      /(markdown|html|json|csv|pdf|docx|plain text|bullet points|numbered list)/i,
      /structure[:\s]+([\w\s,.-]+)/i
    ];

    for (const pattern of formatPatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1] || match[0];
      }
    }

    return undefined;
  }

  private extractStyleGuide(text: string): string | undefined {
    const stylePatterns = [
      /style guide[:\s]+([\w\s,.-]+)/i,
      /guidelines?[:\s]+([\w\s,.-]+)/i,
      /standards?[:\s]+([\w\s,.-]+)/i
    ];

    for (const pattern of stylePatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1] || match[0];
      }
    }

    return undefined;
  }

  private extractDomain(text: string): string | undefined {
    const domainPatterns = [
      /domain[:\s]+([\w\s,.-]+)/i,
      /subject[:\s]+([\w\s,.-]+)/i,
      /field[:\s]+([\w\s,.-]+)/i,
      /(technology|healthcare|finance|education|marketing|legal|scientific)/i
    ];

    for (const pattern of domainPatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1] || match[0];
      }
    }

    return undefined;
  }

  private extractAudience(text: string): string | undefined {
    const audiencePatterns = [
      /audience[:\s]+([\w\s,.-]+)/i,
      /target[:\s]+([\w\s,.-]+)/i,
      /for\s+([\w\s,.-]*(?:users?|customers?|clients?|students?|professionals?)[\w\s,.-]*)/i
    ];

    for (const pattern of audiencePatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1] || match[0];
      }
    }

    return undefined;
  }

  private extractConstraints(text: string): string[] {
    const constraints: string[] = [];
    
    // Look for explicit constraints
    const constraintPatterns = [
      /constraint[s]?[:\s]+(.*?)(?:\n|$)/gi,
      /limitation[s]?[:\s]+(.*?)(?:\n|$)/gi,
      /requirement[s]?[:\s]+(.*?)(?:\n|$)/gi,
      /must not[:\s]+(.*?)(?:\n|$)/gi,
      /avoid[:\s]+(.*?)(?:\n|$)/gi
    ];

    constraintPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        constraints.push(match[1].trim());
      }
    });

    return constraints;
  }

  private extractExamples(text: string): string[] {
    const examples: string[] = [];
    
    // Look for example sections
    const examplePatterns = [
      /example[s]?[:\s]+([\s\S]*?)(?=\n\n|\n[A-Z]|$)/gi,
      /for instance[:\s]+(.*?)(?:\n|$)/gi,
      /such as[:\s]+(.*?)(?:\n|$)/gi
    ];

    examplePatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const example = match[1].trim();
        if (example.length > 10) { // Filter out very short examples
          examples.push(example);
        }
      }
    });

    return examples;
  }

  // Utility methods
  private splitIntoSentences(text: string): string[] {
    return text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  }

  private calculateRelevanceScore(sentence: string, keywords: string[]): number {
    const lowerSentence = sentence.toLowerCase();
    let score = 0;
    
    keywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'g');
      const matches = lowerSentence.match(regex);
      if (matches) {
        score += matches.length;
      }
    });
    
    return score;
  }

  /**
   * Generate comprehensive todo list for a subtask
   */
  private generateTodoList(
    subtask: Subtask,
    injectedPrompt: string,
    taskComplexity: TaskComplexity
  ): SubtaskTodoList {
    const atomicOperations = this.extractAtomicOperations(injectedPrompt, subtask.type);
    const todosWithDependencies = this.identifyDependencies(atomicOperations);
    
    const now = Date.now();
    const todoList: SubtaskTodoList = {
      subtaskId: subtask.id,
      agentId: subtask.assignedAgentId || 'unassigned',
      totalItems: todosWithDependencies.length,
      completedItems: 0,
      estimatedTotalDuration: todosWithDependencies.reduce((sum, todo) => sum + todo.estimatedDurationMs, 0),
      todos: todosWithDependencies,
      createdAt: now,
      lastUpdated: now
    };

    return todoList;
  }

  /**
   * Analyze task complexity based on prompt content and task type
   */
  private analyzeTaskComplexity(prompt: string, taskType: SubtaskType): TaskComplexity {
    const wordCount = prompt.split(/\s+/).length;
    const technicalKeywords = ['implement', 'analyze', 'integrate', 'optimize', 'validate', 'test'];
    const complexityIndicators = technicalKeywords.filter(keyword => 
      prompt.toLowerCase().includes(keyword)
    ).length;
    
    let level: TaskComplexity['level'] = 'simple';
    let estimatedDuration = 300000; // 5 minutes base
    
    if (wordCount > 500 || complexityIndicators > 3) {
      level = 'expert';
      estimatedDuration = 1200000; // 20 minutes
    } else if (wordCount > 300 || complexityIndicators > 2) {
      level = 'complex';
      estimatedDuration = 900000; // 15 minutes
    } else if (wordCount > 150 || complexityIndicators > 1) {
      level = 'moderate';
      estimatedDuration = 600000; // 10 minutes
    }

    const riskFactors = [];
    if (prompt.toLowerCase().includes('external')) riskFactors.push('external_dependencies');
    if (prompt.toLowerCase().includes('integrate')) riskFactors.push('integration_complexity');
    if (prompt.toLowerCase().includes('performance')) riskFactors.push('performance_requirements');

    return {
      level,
      operationCount: Math.ceil(wordCount / 50), // Rough estimate
      estimatedDuration,
      requiresExternalData: prompt.toLowerCase().includes('external') || prompt.toLowerCase().includes('api'),
      hasIterativeSteps: prompt.toLowerCase().includes('refine') || prompt.toLowerCase().includes('iterate'),
      riskFactors
    };
  }

  /**
   * Extract atomic operations from the prompt based on task type
   */
  private extractAtomicOperations(prompt: string, taskType: SubtaskType): TodoItem[] {
    const pattern = TASK_PATTERNS[taskType] || TASK_PATTERNS['CREATION'];
    const baseOperations = pattern.operations;
    const todos: TodoItem[] = [];

    // Extract custom operations from prompt if available
    const customOperations = this.parseCustomOperations(prompt);
    const operations = customOperations.length > 0 ? customOperations : baseOperations;

    operations.forEach((operation, index) => {
      const todo: TodoItem = {
        id: `todo-${Date.now()}-${index}`,
        title: this.humanizeOperationName(operation),
        description: this.generateOperationDescription(operation, prompt),
        estimatedDurationMs: this.estimateOperationDuration(operation, taskType),
        status: 'pending',
        dependencies: [],
        progressPercentage: 0
      };
      todos.push(todo);
    });

    return todos;
  }

  /**
   * Parse custom operations from prompt text
   */
  private parseCustomOperations(prompt: string): string[] {
    const operations: string[] = [];
    
    // Look for numbered lists or bullet points
    const listPatterns = [
      /\d+\.\s*([^\n]+)/g,
      /[-*]\s*([^\n]+)/g,
      /step\s*\d*[:\s]*([^\n]+)/gi
    ];

    listPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(prompt)) !== null) {
        const operation = match[1].trim();
        if (operation.length > 5 && operation.length < 100) {
          operations.push(operation.toLowerCase().replace(/\s+/g, '_'));
        }
      }
    });

    return operations;
  }

  /**
   * Estimate duration for a specific operation
   */
  private estimateOperationDuration(operation: string, taskType: SubtaskType): number {
    const pattern = TASK_PATTERNS[taskType] || TASK_PATTERNS['CREATION'];
    let baseDuration = pattern.avgDurationPerOp;

    // Adjust based on operation complexity
    if (operation.includes('implement') || operation.includes('create')) {
      baseDuration *= 1.5;
    } else if (operation.includes('review') || operation.includes('check')) {
      baseDuration *= 0.7;
    } else if (operation.includes('research') || operation.includes('analyze')) {
      baseDuration *= 1.2;
    }

    return Math.round(baseDuration);
  }

  /**
   * Identify dependencies between todo items
   */
  private identifyDependencies(todos: TodoItem[]): TodoItem[] {
    const todoMap = new Map(todos.map(todo => [todo.title.toLowerCase().replace(/\s+/g, '_'), todo]));
    
    todos.forEach(todo => {
      const operationName = todo.title.toLowerCase().replace(/\s+/g, '_');
      
      // Check predefined dependencies
      Object.values(TASK_PATTERNS).forEach(pattern => {
        if (pattern.dependencies[operationName]) {
          pattern.dependencies[operationName].forEach(depName => {
            const depTodo = todoMap.get(depName);
            if (depTodo && depTodo.id !== todo.id) {
              todo.dependencies.push(depTodo.id);
            }
          });
        }
      });

      // Add sequential dependencies if no specific ones found
      if (todo.dependencies.length === 0) {
        const currentIndex = todos.indexOf(todo);
        if (currentIndex > 0) {
          todo.dependencies.push(todos[currentIndex - 1].id);
        }
      }
    });

    return todos;
  }

  /**
   * Generate progress tracking instructions
   */
  private generateProgressInstructions(todos: TodoItem[]): string {
    const todoItems = todos.map(todo => 
      `- [${todo.id}] ${todo.title}: ${todo.description} (Est: ${Math.round(todo.estimatedDurationMs / 60000)}min)`
    ).join('\n');

    return PROGRESS_TEMPLATE.replace('{generatedTodoItems}', todoItems);
  }

  /**
   * Create checkpoint markers for progress detection
   */
  private createCheckpointMarkers(todos: TodoItem[]): string[] {
    const markers: string[] = [];
    
    todos.forEach(todo => {
      markers.push(`[CHECKPOINT:${todo.id}:COMPLETED]`);
      markers.push(`[PROGRESS:${todo.id}:`);
      markers.push(`[ISSUE:${todo.id}:`);
      markers.push(`[HELP:${todo.id}:`);
    });

    return markers;
  }

  /**
   * Embed progress tracking into the prompt
   */
  private embedProgressTracking(prompt: string, instructions: string, todos: TodoItem[]): string {
    const todoSummary = `\n\n=== PROGRESS TRACKING ENABLED ===\n${instructions}\n=== END TRACKING SECTION ===\n\n`;
    return prompt + todoSummary;
  }

  /**
   * Humanize operation names for better readability
   */
  private humanizeOperationName(operation: string): string {
    return operation
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  /**
   * Generate detailed description for an operation
   */
  private generateOperationDescription(operation: string, context: string): string {
    const descriptions: Record<string, string> = {
      'understand_brief': 'Carefully read and comprehend the task requirements',
      'brainstorm_concepts': 'Generate multiple creative approaches and ideas',
      'select_approach': 'Choose the most suitable approach based on requirements',
      'create_draft': 'Develop the initial version of the deliverable',
      'refine_content': 'Improve and polish the content for quality',
      'final_review': 'Conduct final quality check and validation',
      'define_scope': 'Establish clear boundaries and objectives for research',
      'identify_sources': 'Find reliable and relevant information sources',
      'gather_data': 'Collect comprehensive information from identified sources',
      'analyze_findings': 'Process and interpret the collected data',
      'synthesize_results': 'Combine findings into coherent insights',
      'format_output': 'Present results in the required format'
    };

    return descriptions[operation] || `Complete the ${operation.replace(/_/g, ' ')} step`;
  }

  /**
   * Create injection configuration preset
   */
  static createPreset(presetName: string): InjectionConfig {
    const presets: Record<string, InjectionConfig> = {
      minimal: {
        includeTone: false,
        includeFormat: false,
        includeOriginalPrompt: true,
        includeStyleGuide: false,
        maxContextLength: 2000
      },
      standard: {
        includeTone: true,
        includeFormat: true,
        includeOriginalPrompt: true,
        includeStyleGuide: true,
        maxContextLength: 4000
      },
      comprehensive: {
        includeTone: true,
        includeFormat: true,
        includeOriginalPrompt: true,
        includeStyleGuide: true,
        maxContextLength: 8000
      }
    };

    return presets[presetName] || presets.standard;
  }
}