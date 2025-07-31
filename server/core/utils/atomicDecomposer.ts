/**
 * Atomic Workflow Decomposition Engine
 * Shreds complex prompts into microprompts using atomic tasks
 */

import { v4 as uuidv4 } from 'uuid';

export interface AtomicTask {
  id: string;
  type: AtomicTaskType;
  name: string;
  description: string;
  microprompt: string; // The specific microprompt for this task
  inputs: TaskInput[];
  outputs: TaskOutput[];
  dependencies: string[];
  estimatedDuration: number;
  complexity: 'trivial' | 'simple' | 'moderate' | 'complex';
  canRunInParallel: boolean;
  requiredCapabilities: string[];
  tokenLimit: number; // Maximum tokens for this microprompt
  batchSize?: number; // For batching similar tasks
}

export type AtomicTaskType = 
  | 'generate_text' | 'generate_script' | 'generate_audio' | 'generate_image' | 'generate_video'
  | 'edit_audio' | 'edit_video' | 'edit_image' | 'edit_text'
  | 'merge_media' | 'convert_format' | 'extract_data' | 'analyze_content'
  | 'validate_output' | 'optimize_file' | 'display_result' | 'save_result'
  | 'research_topic' | 'analyze_data' | 'create_outline' | 'write_content'
  | 'review_content' | 'format_output' | 'compile_result';

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
  position: { x: number; y: number };
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

export class AtomicDecomposer {
  private decompositionRules: DecompositionRule[] = [];
  private taskLibrary: Map<string, AtomicTask> = new Map();

  constructor() {
    this.initializeDecompositionRules();
    this.initializeTaskLibrary();
  }

  async decomposeWorkflow(
    userPrompt: string,
    uploadedFiles: FileMetadata[],
    context: WorkflowContext = {}
  ): Promise<AtomicWorkflow> {
    console.log('🔍 Analyzing user intent:', userPrompt);
    
      // Step 1: Analyze user intent
    const intent = this.analyzeUserIntent(userPrompt, uploadedFiles);
    console.log('📋 Intent analysis:', intent);

    // Step 2: Match decomposition pattern
    const rule = this.matchDecompositionPattern(intent);
      
      // Step 3: Generate atomic tasks
      let atomicTasks: AtomicTask[];
    if (rule) {
      atomicTasks = this.applyDecompositionRule(rule, intent);
      } else {
      atomicTasks = this.createCustomDecomposition(intent);
      }

    // Step 4: Optimize and batch tasks
    atomicTasks = this.optimizeDependencyGraph(atomicTasks);
    const batchedTasks = this.batchTasksForEfficiency(atomicTasks);
      
      // Step 5: Build execution graph
    const executionGraph = this.buildExecutionGraph(atomicTasks);

    // Step 6: Create workflow
      const workflow: AtomicWorkflow = {
      id: `workflow-${uuidv4()}`,
        name: this.generateWorkflowName(intent),
      description: intent.primaryGoal,
      atomicTasks,
        executionGraph,
      estimatedDuration: this.calculateTotalDuration(atomicTasks),
      requiredResources: this.extractRequiredResources(atomicTasks),
      outputFiles: this.defineExpectedOutputs(atomicTasks),
      totalTokens: this.calculateTotalTokens(atomicTasks),
      batchedTasks
    };

    console.log('✅ Workflow decomposed:', {
      taskCount: atomicTasks.length,
      totalTokens: workflow.totalTokens,
      estimatedDuration: workflow.estimatedDuration
      });

      return workflow;
  }

  private analyzeUserIntent(prompt: string, files: FileMetadata[]): WorkflowIntent {
    const promptLower = prompt.toLowerCase();
    
    // Analyze complexity based on prompt length and keywords
    const complexity = this.calculateComplexity(prompt);
    
    // Determine output type
    const outputType = this.determineOutputType(promptLower, files);
    
    // Extract requirements
    const requirements = this.extractRequirements(promptLower);
    
    // Estimate token usage
    const estimatedTokens = this.estimateTokenUsage(prompt, files);

    return {
      primaryGoal: prompt,
      outputType,
      complexity,
      requirements,
      constraints: [],
      userFiles: files,
      estimatedTokens
    };
  }

  private calculateComplexity(prompt: string): number {
    const wordCount = prompt.split(' ').length;
    const hasComplexKeywords = /create|generate|build|develop|analyze|research|comprehensive|detailed/i.test(prompt);
    const hasMultipleSteps = /first|then|next|finally|step|stage/i.test(prompt);
    
    let complexity = 1;
    if (wordCount > 50) complexity += 1;
    if (hasComplexKeywords) complexity += 1;
    if (hasMultipleSteps) complexity += 1;
    
    return Math.min(complexity, 5);
  }

  private determineOutputType(prompt: string, files: FileMetadata[]): WorkflowIntent['outputType'] {
    if (prompt.includes('video') || files.some(f => f.mimeType.startsWith('video/'))) return 'video';
    if (prompt.includes('audio') || files.some(f => f.mimeType.startsWith('audio/'))) return 'audio';
    if (prompt.includes('image') || files.some(f => f.mimeType.startsWith('image/'))) return 'image';
    if (prompt.includes('document') || files.some(f => f.mimeType.includes('document'))) return 'document';
    if (prompt.includes('data') || prompt.includes('analysis')) return 'data';
    if (prompt.includes('mixed') || prompt.includes('multimedia')) return 'mixed';
    return 'text';
  }

  private extractRequirements(prompt: string): string[] {
    const requirements: string[] = [];
    
    if (prompt.includes('research') || prompt.includes('analyze')) requirements.push('research');
    if (prompt.includes('create') || prompt.includes('generate')) requirements.push('creation');
    if (prompt.includes('edit') || prompt.includes('modify')) requirements.push('editing');
    if (prompt.includes('review') || prompt.includes('validate')) requirements.push('validation');
    if (prompt.includes('format') || prompt.includes('style')) requirements.push('formatting');
    
    return requirements;
  }

  private estimateTokenUsage(prompt: string, files: FileMetadata[]): number {
    // Base token estimation
    let tokens = prompt.length * 0.75; // Rough estimation
    
    // Add tokens for file processing
    files.forEach(file => {
      if (file.mimeType.startsWith('text/')) tokens += file.size * 0.1;
      else if (file.mimeType.startsWith('image/')) tokens += 1000; // Image analysis
      else if (file.mimeType.startsWith('audio/')) tokens += 2000; // Audio processing
      else if (file.mimeType.startsWith('video/')) tokens += 5000; // Video processing
    });
    
    return Math.ceil(tokens);
  }

  private matchDecompositionPattern(intent: WorkflowIntent): DecompositionRule | null {
    // Match against predefined patterns
    for (const rule of this.decompositionRules) {
      if (rule.pattern.test(intent.primaryGoal)) {
        return rule;
      }
    }
    return null;
  }

  private applyDecompositionRule(rule: DecompositionRule, intent: WorkflowIntent): AtomicTask[] {
    const tasks: AtomicTask[] = [];
    
    rule.decomposition.forEach((taskTemplate, index) => {
      const task: AtomicTask = {
        ...taskTemplate,
        id: `${taskTemplate.id}-${uuidv4()}`,
        microprompt: this.generateMicroprompt(taskTemplate, intent, index),
        dependencies: taskTemplate.dependencies.map(dep => 
          tasks.find(t => t.type === dep)?.id || dep
        )
      };
      tasks.push(task);
    });
    
    return tasks;
  }

  private createCustomDecomposition(intent: WorkflowIntent): AtomicTask[] {
    const tasks: AtomicTask[] = [];
    
    // Research phase
    if (intent.requirements.includes('research')) {
      tasks.push(this.createResearchTask(intent));
    }
    
    // Analysis phase
    if (intent.requirements.includes('analysis')) {
      tasks.push(this.createAnalysisTask(intent, tasks));
    }
    
    // Creation phase
    if (intent.requirements.includes('creation')) {
      tasks.push(this.createCreationTask(intent, tasks));
    }
    
    // Validation phase
    if (intent.requirements.includes('validation')) {
      tasks.push(this.createValidationTask(intent, tasks));
    }
    
    // If no specific requirements, create a general processing task
    if (tasks.length === 0) {
      tasks.push(this.createGeneralProcessingTask(intent));
    }
    
    return tasks;
  }

  private createResearchTask(intent: WorkflowIntent): AtomicTask {
    return {
      id: `research-${uuidv4()}`,
      type: 'research_topic',
      name: 'Research Topic',
      description: 'Conduct research on the specified topic',
      microprompt: `Research the following topic thoroughly: ${intent.primaryGoal}. Provide comprehensive information, key points, and relevant details.`,
      inputs: [
        { id: 'topic', name: 'Topic', type: 'text', required: true }
      ],
      outputs: [
        { id: 'research_data', name: 'Research Data', type: 'data', format: 'json', destinationType: 'next_task' }
      ],
      dependencies: [],
      estimatedDuration: 120000,
      complexity: 'moderate',
      canRunInParallel: false,
      requiredCapabilities: ['research'],
      tokenLimit: 2000
    };
  }

  private createAnalysisTask(intent: WorkflowIntent, previousTasks: AtomicTask[]): AtomicTask {
    return {
      id: `analyze-${uuidv4()}`,
      type: 'analyze_content',
      name: 'Analyze Content',
      description: 'Analyze the research data and content',
      microprompt: `Analyze the following content and research data: ${intent.primaryGoal}. Identify key insights, patterns, and actionable information.`,
      inputs: [
        { id: 'research_data', name: 'Research Data', type: 'data', required: true, source: 'previous_task' },
        { id: 'requirements', name: 'Requirements', type: 'text', required: true }
      ],
      outputs: [
        { id: 'analysis_result', name: 'Analysis Result', type: 'data', format: 'json', destinationType: 'next_task' }
      ],
      dependencies: previousTasks.map(t => t.id),
      estimatedDuration: 90000,
      complexity: 'moderate',
      canRunInParallel: false,
      requiredCapabilities: ['analysis'],
      tokenLimit: 2500
    };
  }

  private createCreationTask(intent: WorkflowIntent, previousTasks: AtomicTask[]): AtomicTask {
    return {
      id: `create-${uuidv4()}`,
      type: 'generate_text',
      name: 'Create Content',
      description: 'Create the main content based on analysis',
      microprompt: `Create ${intent.outputType} content based on the analysis: ${intent.primaryGoal}. Ensure high quality and relevance.`,
      inputs: [
        { id: 'analysis_result', name: 'Analysis Result', type: 'data', required: true, source: 'previous_task' },
        { id: 'requirements', name: 'Requirements', type: 'text', required: true }
      ],
      outputs: [
        { id: 'content', name: 'Generated Content', type: 'text', format: 'markdown', destinationType: 'next_task' }
      ],
      dependencies: previousTasks.map(t => t.id),
      estimatedDuration: 180000,
      complexity: 'complex',
      canRunInParallel: false,
      requiredCapabilities: ['text_generation'],
      tokenLimit: 3000
    };
  }

  private createValidationTask(intent: WorkflowIntent, previousTasks: AtomicTask[]): AtomicTask {
    return {
      id: `validate-${uuidv4()}`,
      type: 'validate_output',
      name: 'Validate Output',
      description: 'Review and validate the created content',
      microprompt: `Review and validate the following content for quality, accuracy, and completeness: ${intent.primaryGoal}. Provide feedback and suggestions for improvement.`,
      inputs: [
        { id: 'content', name: 'Content to Validate', type: 'text', required: true, source: 'previous_task' },
        { id: 'requirements', name: 'Requirements', type: 'text', required: true }
      ],
      outputs: [
        { id: 'validation_result', name: 'Validation Result', type: 'data', format: 'json', destinationType: 'next_task' },
        { id: 'final_content', name: 'Final Content', type: 'text', format: 'markdown', destinationType: 'display' }
      ],
      dependencies: previousTasks.map(t => t.id),
      estimatedDuration: 60000,
      complexity: 'simple',
      canRunInParallel: false,
      requiredCapabilities: ['validation'],
      tokenLimit: 1500
    };
  }

  private createGeneralProcessingTask(intent: WorkflowIntent): AtomicTask {
    return {
      id: `process-${uuidv4()}`,
      type: 'generate_text',
      name: 'Process Request',
      description: 'Process the general request',
      microprompt: `Process the following request: ${intent.primaryGoal}. Provide a comprehensive response that addresses all aspects of the request.`,
      inputs: [
        { id: 'request', name: 'Request', type: 'text', required: true }
      ],
      outputs: [
        { id: 'result', name: 'Result', type: 'text', format: 'markdown', destinationType: 'display' }
      ],
      dependencies: [],
      estimatedDuration: 120000,
      complexity: 'moderate',
      canRunInParallel: false,
      requiredCapabilities: ['text_generation'],
      tokenLimit: 2500
    };
  }

  private generateMicroprompt(taskTemplate: any, intent: WorkflowIntent, index: number): string {
    // Generate specific microprompt based on task type and context
    const context = `Context: ${intent.primaryGoal}`;
    const requirements = intent.requirements.join(', ');
    
    switch (taskTemplate.type) {
      case 'research_topic':
        return `${context}\n\nResearch Task: Conduct thorough research on this topic. Requirements: ${requirements}. Provide comprehensive findings.`;
      
      case 'analyze_content':
        return `${context}\n\nAnalysis Task: Analyze the provided research data. Requirements: ${requirements}. Identify key insights and patterns.`;
      
      case 'generate_text':
        return `${context}\n\nCreation Task: Generate high-quality ${intent.outputType} content. Requirements: ${requirements}. Ensure relevance and completeness.`;
      
      case 'validate_output':
        return `${context}\n\nValidation Task: Review the generated content for quality and accuracy. Requirements: ${requirements}. Provide feedback and final version.`;
      
      default:
        return `${context}\n\nTask ${index + 1}: ${taskTemplate.description}. Requirements: ${requirements}.`;
    }
  }

  private batchTasksForEfficiency(tasks: AtomicTask[]): BatchedTaskGroup[] {
    const batches: BatchedTaskGroup[] = [];
    const maxTokensPerBatch = 4000; // Token limit for efficient batching
    const maxTasksPerBatch = 3; // Maximum tasks per batch
    
    let currentBatch: AtomicTask[] = [];
    let currentTokens = 0;
    
    tasks.forEach(task => {
      // Check if task can be added to current batch
      if (currentTokens + task.tokenLimit <= maxTokensPerBatch && 
          currentBatch.length < maxTasksPerBatch &&
          task.canRunInParallel) {
        currentBatch.push(task);
        currentTokens += task.tokenLimit;
      } else {
        // Start new batch
        if (currentBatch.length > 0) {
          batches.push({
            batchId: `batch-${uuidv4()}`,
            tasks: currentBatch,
            totalTokens: currentTokens,
            canExecuteInParallel: true,
            contextInjector: this.createContextInjector(currentBatch)
          });
        }
        currentBatch = [task];
        currentTokens = task.tokenLimit;
      }
    });
    
    // Add remaining batch
    if (currentBatch.length > 0) {
      batches.push({
        batchId: `batch-${uuidv4()}`,
        tasks: currentBatch,
        totalTokens: currentTokens,
        canExecuteInParallel: true,
        contextInjector: this.createContextInjector(currentBatch)
      });
    }
    
    return batches;
  }

  private createContextInjector(tasks: AtomicTask[]): ContextInjector {
    // Create a context injector that provides shared context for batched tasks
    const taskSummaries = tasks.map(t => `${t.name}: ${t.description}`).join('; ');
    
    return {
      type: 'summary',
      content: `Context for batch execution: ${taskSummaries}`,
      tokenLimit: 500
    };
  }

  private optimizeDependencyGraph(tasks: AtomicTask[]): AtomicTask[] {
    // Optimize task dependencies for better parallelization
    const optimizedTasks = [...tasks];
    
    // Remove unnecessary dependencies
    optimizedTasks.forEach(task => {
      task.dependencies = task.dependencies.filter(dep => 
        optimizedTasks.some(t => t.id === dep)
      );
    });
    
    return optimizedTasks;
  }

  private buildExecutionGraph(tasks: AtomicTask[]): ExecutionGraph {
    const nodes: ExecutionNode[] = tasks.map(task => ({
      taskId: task.id,
      position: { x: 0, y: 0 }, // Will be calculated by UI
      status: 'pending',
      inputs: [],
      outputs: []
    }));
    
    const edges: ExecutionEdge[] = [];
    tasks.forEach(task => {
      task.dependencies.forEach(depId => {
          edges.push({
          source: depId,
          target: task.id,
          dependencyType: 'hard'
        });
      });
    });
    
    // Calculate parallel batches
    const parallelBatches = this.calculateParallelBatches(tasks);
    
    // Calculate critical path
    const criticalPath = this.calculateCriticalPath(tasks);
    
    return {
      nodes,
      edges,
      parallelBatches,
      criticalPath
    };
  }

  private calculateParallelBatches(tasks: AtomicTask[]): string[][] {
    const batches: string[][] = [];
    const visited = new Set<string>();
    
    tasks.forEach(task => {
      if (visited.has(task.id)) return;
      
      const batch = [task.id];
      visited.add(task.id);
      
      // Find tasks that can run in parallel
      tasks.forEach(otherTask => {
        if (!visited.has(otherTask.id) && 
            otherTask.canRunInParallel && 
            !this.hasDependencyConflict(task, otherTask, tasks)) {
          batch.push(otherTask.id);
          visited.add(otherTask.id);
        }
      });
      
        batches.push(batch);
    });
    
    return batches;
  }

  private hasDependencyConflict(task1: AtomicTask, task2: AtomicTask, allTasks: AtomicTask[]): boolean {
    // Check if tasks have conflicting dependencies
    const task1Deps = this.getAllDependencies(task1, allTasks);
    const task2Deps = this.getAllDependencies(task2, allTasks);
    
    return task1Deps.includes(task2.id) || task2Deps.includes(task1.id);
  }

  private getAllDependencies(task: AtomicTask, allTasks: AtomicTask[]): string[] {
    const deps = new Set<string>();
    const queue = [...task.dependencies];
    
    while (queue.length > 0) {
      const depId = queue.shift()!;
      if (deps.has(depId)) continue;
      
      deps.add(depId);
      const depTask = allTasks.find(t => t.id === depId);
      if (depTask) {
        queue.push(...depTask.dependencies);
      }
    }
    
    return Array.from(deps);
  }

  private calculateCriticalPath(tasks: AtomicTask[]): string[] {
    // Simple critical path calculation based on dependencies
    const criticalPath: string[] = [];
    const taskMap = new Map(tasks.map(t => [t.id, t]));
    
    // Find tasks with no dependencies (start points)
    const startTasks = tasks.filter(t => t.dependencies.length === 0);
    
    if (startTasks.length > 0) {
      let currentTask = startTasks[0];
      criticalPath.push(currentTask.id);
      
      // Follow the longest dependency chain
      while (currentTask) {
        const nextTasks = tasks.filter(t => 
          t.dependencies.includes(currentTask.id)
        );
        
        if (nextTasks.length > 0) {
          // Choose the task with the longest estimated duration
          currentTask = nextTasks.reduce((longest, current) => 
            current.estimatedDuration > longest.estimatedDuration ? current : longest
          );
          criticalPath.push(currentTask.id);
        } else {
          currentTask = null;
        }
      }
    }
    
    return criticalPath;
  }

  private calculateTotalDuration(tasks: AtomicTask[]): number {
    // Calculate total duration considering parallelization
    const criticalPath = this.calculateCriticalPath(tasks);
    return criticalPath.reduce((total, taskId) => {
      const task = tasks.find(t => t.id === taskId);
      return total + (task?.estimatedDuration || 0);
    }, 0);
  }

  private extractRequiredResources(tasks: AtomicTask[]): string[] {
    const resources = new Set<string>();
    tasks.forEach(task => {
      task.requiredCapabilities.forEach(cap => resources.add(cap));
    });
    return Array.from(resources);
  }

  private defineExpectedOutputs(tasks: AtomicTask[]): ExpectedOutput[] {
    return tasks
      .filter(task => task.outputs.some(output => output.destinationType === 'display'))
      .map(task => ({
        name: task.name,
        type: task.type,
        format: task.outputs[0]?.format || 'text',
        sourceTaskId: task.id
      }));
  }

  private calculateTotalTokens(tasks: AtomicTask[]): number {
    return tasks.reduce((total, task) => total + task.tokenLimit, 0);
  }

  private generateWorkflowName(intent: WorkflowIntent): string {
    const goal = intent.primaryGoal.substring(0, 50);
    return `${intent.outputType.charAt(0).toUpperCase() + intent.outputType.slice(1)} Generation: ${goal}`;
  }

  private initializeDecompositionRules(): void {
    // Initialize predefined decomposition rules
    this.decompositionRules = [
      {
        trigger: 'video generation',
        pattern: /create.*video|generate.*video|make.*video/i,
        decomposition: [
          {
            id: 'script-generation',
            type: 'generate_script',
            name: 'Generate Video Script',
            description: 'Create a detailed script for the video',
            microprompt: '',
            inputs: [],
            outputs: [],
            dependencies: [],
            estimatedDuration: 120000,
            complexity: 'moderate',
            canRunInParallel: false,
            requiredCapabilities: ['script_generation'],
            tokenLimit: 2000
          },
          {
            id: 'audio-generation',
            type: 'generate_audio',
            name: 'Generate Audio Narration',
            description: 'Convert script to audio narration',
            microprompt: '',
            inputs: [],
            outputs: [],
            dependencies: ['script-generation'],
            estimatedDuration: 180000,
            complexity: 'simple',
            canRunInParallel: false,
            requiredCapabilities: ['text_to_speech'],
            tokenLimit: 1500
          },
          {
            id: 'video-composition',
            type: 'edit_video',
            name: 'Compose Final Video',
            description: 'Combine all elements into final video',
            microprompt: '',
            inputs: [],
            outputs: [],
            dependencies: ['audio-generation'],
            estimatedDuration: 300000,
            complexity: 'complex',
            canRunInParallel: false,
            requiredCapabilities: ['video_editing'],
            tokenLimit: 2500
          }
        ],
        dependencies: [],
        parallelizationStrategy: 'sequential'
      }
    ];
  }

  private initializeTaskLibrary(): void {
    // Initialize task library with common atomic tasks
    const commonTasks: AtomicTask[] = [
      {
        id: 'research-topic',
        type: 'research_topic',
        name: 'Research Topic',
        description: 'Conduct thorough research on a topic',
        microprompt: '',
        inputs: [{ id: 'topic', name: 'Topic', type: 'text', required: true }],
        outputs: [{ id: 'research_data', name: 'Research Data', type: 'data', format: 'json', destinationType: 'next_task' }],
        dependencies: [],
        estimatedDuration: 120000,
        complexity: 'moderate',
        canRunInParallel: false,
        requiredCapabilities: ['research'],
        tokenLimit: 2000
      },
      {
        id: 'analyze-content',
        type: 'analyze_content',
        name: 'Analyze Content',
        description: 'Analyze content and extract insights',
        microprompt: '',
        inputs: [{ id: 'content', name: 'Content', type: 'text', required: true }],
        outputs: [{ id: 'analysis_result', name: 'Analysis Result', type: 'data', format: 'json', destinationType: 'next_task' }],
        dependencies: [],
        estimatedDuration: 90000,
        complexity: 'moderate',
        canRunInParallel: false,
        requiredCapabilities: ['analysis'],
        tokenLimit: 2000
      }
    ];
    
    commonTasks.forEach(task => {
      this.taskLibrary.set(task.id, task);
    });
  }
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

export const atomicDecomposer = new AtomicDecomposer();