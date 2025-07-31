/**
 * Runtime Workflow Generator
 * Generates atomic workflows dynamically based on user intent and available resources
 */

import { EventEmitter } from 'events';
import {
  WorkflowIntent,
  AtomicWorkflow,
  AtomicTask,
  ExecutionGraph,
  WorkflowConstraint,
  DecompositionContext,
  ExpectedOutput,
  UserPreferences,
  ValidationResult
} from '../../../shared/types/atomicWorkflow';
import { FileMetadata } from '../../../shared/types/fileManagement';
import { AtomicDecomposer } from './atomicDecomposer';
import { TaskLibrary } from './taskLibrary';

interface RuntimeResource {
  id: string;
  type: 'agent' | 'service' | 'capability' | 'tool';
  name: string;
  availability: 'available' | 'busy' | 'unavailable';
  capabilities: string[];
  performance: {
    speed: number;
    quality: number;
    reliability: number;
  };
  cost: number;
  metadata: Record<string, any>;
}

interface WorkflowOptimization {
  parallelization: number;
  resourceUtilization: number;
  estimatedTime: number;
  estimatedCost: number;
  qualityScore: number;
  feasibilityScore: number;
}

export class RuntimeWorkflowGenerator extends EventEmitter {
  private decomposer: AtomicDecomposer;
  private availableResources: Map<string, RuntimeResource> = new Map();
  private workflowCache: Map<string, AtomicWorkflow> = new Map();
  private optimizationCache: Map<string, WorkflowOptimization> = new Map();

  constructor() {
    super();
    this.decomposer = new AtomicDecomposer();
    this.initializeDefaultResources();
  }

  /**
   * Generate workflow from user intent and context
   */
  async generateWorkflowFromIntent(
    intent: WorkflowIntent,
    availableFiles: FileMetadata[]
  ): Promise<AtomicWorkflow> {
    const startTime = Date.now();
    
    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(intent, availableFiles);
      if (this.workflowCache.has(cacheKey)) {
        const cachedWorkflow = this.workflowCache.get(cacheKey)!;
        this.emit('workflow-cache-hit', { cacheKey, workflowId: cachedWorkflow.id });
        return this.cloneWorkflow(cachedWorkflow);
      }

      // Analyze available resources
      const compatibleResources = this.findCompatibleResources(intent);
      
      // Generate base workflow using decomposer
      const baseWorkflow = await this.decomposer.decomposeWorkflow(
        intent.primaryGoal,
        availableFiles,
        this.createWorkflowContext(intent)
      );

      // Optimize workflow for runtime execution
      const optimizedWorkflow = await this.optimizeWorkflowExecution(
        baseWorkflow,
        compatibleResources,
        intent
      );

      // Validate workflow feasibility
      const validation = await this.validateWorkflowFeasibility(optimizedWorkflow, compatibleResources);
      if (!validation.isValid) {
        throw new Error(`Workflow generation failed: ${validation.errors.map(e => e.message).join(', ')}`);
      }

      // Cache the result
      this.workflowCache.set(cacheKey, optimizedWorkflow);

      this.emit('workflow-generated', {
        workflowId: optimizedWorkflow.id,
        taskCount: optimizedWorkflow.atomicTasks.length,
        estimatedDuration: optimizedWorkflow.estimatedDuration,
        processingTime: Date.now() - startTime
      });

      return optimizedWorkflow;

    } catch (error) {
      this.emit('workflow-generation-error', { error, intent, processingTime: Date.now() - startTime });
      throw error;
    }
  }

  /**
   * Decompose complex task into atomic components
   */
  async decomposeComplexTask(
    taskDescription: string,
    context: DecompositionContext
  ): Promise<AtomicTask[]> {
    const intent = await this.createIntentFromDescription(taskDescription, context);
    const atomicTasks = await this.decomposer.generateRuntimeDecomposition(
      intent,
      Array.from(this.availableResources.values())
    );

    // Apply context-specific customizations
    const customizedTasks = this.applyContextCustomizations(atomicTasks, context);
    
    // Optimize task dependencies
    const optimizedTasks = this.optimizeTaskDependencies(customizedTasks);

    return optimizedTasks;
  }

  /**
   * Optimize workflow for execution based on available resources
   */
  async optimizeWorkflowExecution(
    workflow: AtomicWorkflow,
    availableResources?: RuntimeResource[],
    intent?: WorkflowIntent
  ): Promise<AtomicWorkflow> {
    const resources = availableResources || Array.from(this.availableResources.values());
    
    // Create optimized copy
    const optimizedWorkflow: AtomicWorkflow = {
      ...workflow,
      id: `opt_${workflow.id}`,
      atomicTasks: [...workflow.atomicTasks],
      executionGraph: { ...workflow.executionGraph }
    };

    // Apply various optimization strategies
    optimizedWorkflow.atomicTasks = await this.optimizeTaskAssignment(
      optimizedWorkflow.atomicTasks,
      resources
    );

    optimizedWorkflow.executionGraph = this.optimizeParallelization(
      optimizedWorkflow.executionGraph,
      optimizedWorkflow.atomicTasks
    );

    // Apply constraint-based optimizations
    if (intent?.constraints) {
      optimizedWorkflow.atomicTasks = this.applyConstraintOptimizations(
        optimizedWorkflow.atomicTasks,
        intent.constraints
      );
    }

    // Recalculate metrics
    optimizedWorkflow.estimatedDuration = this.calculateOptimizedDuration(
      optimizedWorkflow.atomicTasks,
      optimizedWorkflow.executionGraph
    );

    optimizedWorkflow.metadata = {
      ...optimizedWorkflow.metadata,
      optimizations: this.generateOptimizationReport(workflow, optimizedWorkflow),
      resourceAssignments: this.generateResourceAssignments(optimizedWorkflow.atomicTasks, resources)
    };

    return optimizedWorkflow;
  }

  /**
   * Register runtime resource
   */
  registerResource(resource: RuntimeResource): void {
    this.availableResources.set(resource.id, resource);
    this.emit('resource-registered', { resourceId: resource.id, type: resource.type });
    
    // Clear optimization cache as resource availability changed
    this.optimizationCache.clear();
  }

  /**
   * Update resource availability
   */
  updateResourceAvailability(resourceId: string, availability: RuntimeResource['availability']): void {
    const resource = this.availableResources.get(resourceId);
    if (resource) {
      resource.availability = availability;
      this.emit('resource-availability-changed', { resourceId, availability });
      
      // Clear affected workflow caches
      this.clearAffectedCaches(resourceId);
    }
  }

  /**
   * Get runtime metrics for workflow
   */
  async getRuntimeMetrics(workflowId: string): Promise<WorkflowOptimization> {
    const cacheKey = `metrics_${workflowId}`;
    
    if (this.optimizationCache.has(cacheKey)) {
      return this.optimizationCache.get(cacheKey)!;
    }

    const workflow = this.workflowCache.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    const metrics = this.calculateWorkflowMetrics(workflow);
    this.optimizationCache.set(cacheKey, metrics);
    
    return metrics;
  }

  // Private methods

  private initializeDefaultResources(): void {
    // Text generation service
    this.registerResource({
      id: 'text_generator_01',
      type: 'service',
      name: 'Advanced Text Generator',
      availability: 'available',
      capabilities: ['text_generation', 'creative_writing', 'script_formatting'],
      performance: { speed: 8, quality: 9, reliability: 9 },
      cost: 0.05,
      metadata: { model: 'gpt-4', provider: 'openai' }
    });

    // Image generation service
    this.registerResource({
      id: 'image_generator_01',
      type: 'service',
      name: 'AI Image Generator',
      availability: 'available',
      capabilities: ['image_generation', 'style_transfer', 'ai_models'],
      performance: { speed: 6, quality: 9, reliability: 8 },
      cost: 0.10,
      metadata: { model: 'dall-e-3', provider: 'openai' }
    });

    // Video processing service
    this.registerResource({
      id: 'video_processor_01',
      type: 'service',
      name: 'Video Processing Service',
      availability: 'available',
      capabilities: ['video_editing', 'ffmpeg', 'compositing', 'rendering'],
      performance: { speed: 7, quality: 8, reliability: 9 },
      cost: 0.15,
      metadata: { gpu_enabled: true, max_resolution: '4k' }
    });

    // Audio processing service
    this.registerResource({
      id: 'audio_processor_01',
      type: 'service',
      name: 'Audio Processing Service',
      availability: 'available',
      capabilities: ['text_to_speech', 'audio_generation', 'audio_enhancement'],
      performance: { speed: 8, quality: 8, reliability: 9 },
      cost: 0.08,
      metadata: { voices_available: 50, languages: 25 }
    });

    // Analysis service
    this.registerResource({
      id: 'analysis_service_01',
      type: 'service',
      name: 'Content Analysis Service',
      availability: 'available',
      capabilities: ['nlp', 'content_analysis', 'computer_vision', 'object_detection'],
      performance: { speed: 9, quality: 8, reliability: 9 },
      cost: 0.06,
      metadata: { supports_multimodal: true }
    });
  }

  private findCompatibleResources(intent: WorkflowIntent): RuntimeResource[] {
    const requiredCapabilities = this.extractRequiredCapabilities(intent);
    
    return Array.from(this.availableResources.values()).filter(resource => {
      // Check availability
      if (resource.availability !== 'available') return false;
      
      // Check capability match
      return requiredCapabilities.some(cap => 
        resource.capabilities.includes(cap)
      );
    });
  }

  private createWorkflowContext(intent: WorkflowIntent): any {
    return {
      userId: intent.context?.userId || 'anonymous',
      sessionId: `session_${Date.now()}`,
      preferences: intent.context?.preferences || this.getDefaultPreferences(),
      constraints: intent.constraints || []
    };
  }

  private async createIntentFromDescription(
    description: string,
    context: DecompositionContext
  ): Promise<WorkflowIntent> {
    // Simple intent extraction - in production would use NLP
    const outputType = this.detectOutputTypeFromDescription(description);
    const complexity = this.assessDescriptionComplexity(description);
    
    return {
      primaryGoal: description,
      outputType,
      complexity,
      requirements: this.extractRequirementsFromDescription(description),
      constraints: context.constraints || [],
      userFiles: [],
      context: context.userPreferences ? {
        userId: 'runtime_user',
        preferences: context.userPreferences
      } : undefined,
      confidence: 0.8
    };
  }

  private applyContextCustomizations(
    tasks: AtomicTask[],
    context: DecompositionContext
  ): AtomicTask[] {
    return tasks.map(task => {
      const customizedTask = { ...task };
      
      // Apply user preferences
      if (context.userPreferences.speedPriority > 7) {
        customizedTask.complexity = 'simple';
        customizedTask.estimatedDuration *= 0.7;
      }
      
      if (context.userPreferences.qualityLevel === 'premium') {
        customizedTask.complexity = 'complex';
        customizedTask.estimatedDuration *= 1.3;
      }
      
      // Apply constraints
      for (const constraint of context.constraints) {
        if (constraint.type === 'time' && constraint.priority === 'critical') {
          customizedTask.estimatedDuration *= 0.6;
          customizedTask.priority += 2;
        }
      }
      
      return customizedTask;
    });
  }

  private optimizeTaskDependencies(tasks: AtomicTask[]): AtomicTask[] {
    // Remove redundant dependencies
    const optimizedTasks = tasks.map(task => ({ ...task }));
    
    for (const task of optimizedTasks) {
      // Remove transitive dependencies
      const directDeps = new Set(task.dependencies);
      const transitiveDeps = new Set<string>();
      
      for (const depId of task.dependencies) {
        const depTask = optimizedTasks.find(t => t.id === depId);
        if (depTask) {
          for (const transitiveDep of depTask.dependencies) {
            transitiveDeps.add(transitiveDep);
          }
        }
      }
      
      // Remove dependencies that are transitive
      task.dependencies = Array.from(directDeps).filter(dep => !transitiveDeps.has(dep));
    }
    
    return optimizedTasks;
  }

  private async optimizeTaskAssignment(
    tasks: AtomicTask[],
    resources: RuntimeResource[]
  ): Promise<AtomicTask[]> {
    return tasks.map(task => {
      // Find best resource for each task
      const compatibleResources = resources.filter(resource =>
        task.requiredCapabilities.some(cap => resource.capabilities.includes(cap))
      );
      
      if (compatibleResources.length > 0) {
        // Select resource based on performance and cost
        const bestResource = compatibleResources.reduce((best, current) => {
          const bestScore = this.calculateResourceScore(best, task);
          const currentScore = this.calculateResourceScore(current, task);
          return currentScore > bestScore ? current : best;
        });
        
        // Assign resource and adjust estimates
        task.metadata = {
          ...task.metadata,
          assignedResource: bestResource.id,
          performanceMultiplier: bestResource.performance.speed / 10,
          qualityMultiplier: bestResource.performance.quality / 10,
          estimatedCost: bestResource.cost * (task.estimatedDuration / 1000)
        };
        
        // Adjust duration based on resource performance
        task.estimatedDuration = Math.round(
          task.estimatedDuration * (10 / bestResource.performance.speed)
        );
      }
      
      return task;
    });
  }

  private optimizeParallelization(
    executionGraph: ExecutionGraph,
    tasks: AtomicTask[]
  ): ExecutionGraph {
    const optimizedGraph = { ...executionGraph };
    
    // Identify additional parallelization opportunities
    const taskMap = new Map(tasks.map(t => [t.id, t]));
    const newBatches: string[][] = [];
    
    // Group tasks that can run in parallel
    const processedTasks = new Set<string>();
    
    for (const task of tasks) {
      if (processedTasks.has(task.id) || !task.canRunInParallel) continue;
      
      const batch = [task.id];
      processedTasks.add(task.id);
      
      // Find tasks that can run with this one
      for (const otherTask of tasks) {
        if (processedTasks.has(otherTask.id) || !otherTask.canRunInParallel) continue;
        
        // Check if they don't have dependencies on each other
        if (!this.hasTaskDependency(task.id, otherTask.id, tasks) &&
            !this.hasTaskDependency(otherTask.id, task.id, tasks)) {
          batch.push(otherTask.id);
          processedTasks.add(otherTask.id);
        }
      }
      
      if (batch.length > 1) {
        newBatches.push(batch);
      }
    }
    
    optimizedGraph.parallelBatches = newBatches;
    return optimizedGraph;
  }

  private applyConstraintOptimizations(
    tasks: AtomicTask[],
    constraints: WorkflowConstraint[]
  ): AtomicTask[] {
    return tasks.map(task => {
      const optimizedTask = { ...task };
      
      for (const constraint of constraints) {
        switch (constraint.type) {
          case 'time':
            if (constraint.priority === 'critical') {
              // Reduce quality for speed
              optimizedTask.complexity = 'simple';
              optimizedTask.estimatedDuration *= 0.5;
            }
            break;
            
          case 'quality':
            if (constraint.priority === 'critical') {
              // Increase quality, may take longer
              optimizedTask.complexity = 'complex';
              optimizedTask.estimatedDuration *= 1.5;
            }
            break;
            
          case 'resource':
            // Optimize for resource usage
            optimizedTask.canRunInParallel = false;
            break;
            
          case 'budget':
            // Reduce complexity to save costs
            if (optimizedTask.complexity === 'complex') {
              optimizedTask.complexity = 'moderate';
              optimizedTask.estimatedDuration *= 0.8;
            }
            break;
        }
      }
      
      return optimizedTask;
    });
  }

  private calculateOptimizedDuration(
    tasks: AtomicTask[],
    executionGraph: ExecutionGraph
  ): number {
    // Calculate duration considering parallelization
    let totalDuration = 0;
    
    // Process parallel batches
    for (const batch of executionGraph.parallelBatches) {
      const batchTasks = tasks.filter(t => batch.includes(t.id));
      const batchDuration = Math.max(...batchTasks.map(t => t.estimatedDuration));
      totalDuration += batchDuration;
    }
    
    // Add sequential tasks
    const parallelTaskIds = new Set(executionGraph.parallelBatches.flat());
    const sequentialTasks = tasks.filter(t => !parallelTaskIds.has(t.id));
    const sequentialDuration = sequentialTasks.reduce((sum, t) => sum + t.estimatedDuration, 0);
    
    return totalDuration + sequentialDuration;
  }

  private calculateResourceScore(resource: RuntimeResource, task: AtomicTask): number {
    // Calculate compatibility score
    const capabilityMatch = task.requiredCapabilities.filter(cap =>
      resource.capabilities.includes(cap)
    ).length / task.requiredCapabilities.length;
    
    // Weight by performance and cost
    const performanceScore = (resource.performance.speed + resource.performance.quality + resource.performance.reliability) / 3;
    const costScore = Math.max(0, 10 - resource.cost * 10); // Lower cost = higher score
    
    return (capabilityMatch * 0.5 + performanceScore * 0.3 + costScore * 0.2) * 10;
  }

  private hasTaskDependency(taskId1: string, taskId2: string, tasks: AtomicTask[]): boolean {
    const task1 = tasks.find(t => t.id === taskId1);
    return task1 ? task1.dependencies.includes(taskId2) : false;
  }

  private async validateWorkflowFeasibility(
    workflow: AtomicWorkflow,
    resources: RuntimeResource[]
  ): Promise<ValidationResult> {
    const errors: any[] = [];
    const warnings: any[] = [];
    
    // Check resource availability
    for (const task of workflow.atomicTasks) {
      const requiredCapabilities = task.requiredCapabilities;
      const availableCapabilities = resources.flatMap(r => r.capabilities);
      
      const missingCapabilities = requiredCapabilities.filter(cap =>
        !availableCapabilities.includes(cap)
      );
      
      if (missingCapabilities.length > 0) {
        errors.push({
          code: 'MISSING_CAPABILITIES',
          message: `Task ${task.id} requires capabilities: ${missingCapabilities.join(', ')}`,
          taskId: task.id,
          severity: 'error'
        });
      }
    }
    
    // Check for circular dependencies
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    
    const hasCycle = (taskId: string): boolean => {
      if (recursionStack.has(taskId)) return true;
      if (visited.has(taskId)) return false;
      
      visited.add(taskId);
      recursionStack.add(taskId);
      
      const task = workflow.atomicTasks.find(t => t.id === taskId);
      if (task) {
        for (const depId of task.dependencies) {
          if (hasCycle(depId)) return true;
        }
      }
      
      recursionStack.delete(taskId);
      return false;
    };
    
    for (const task of workflow.atomicTasks) {
      if (hasCycle(task.id)) {
        errors.push({
          code: 'CIRCULAR_DEPENDENCY',
          message: `Circular dependency detected involving task: ${task.id}`,
          taskId: task.id,
          severity: 'critical'
        });
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions: [],
      score: Math.max(0, 100 - (errors.length * 20) - (warnings.length * 5))
    };
  }

  private calculateWorkflowMetrics(workflow: AtomicWorkflow): WorkflowOptimization {
    const parallelTaskCount = workflow.executionGraph.parallelBatches.flat().length;
    const totalTaskCount = workflow.atomicTasks.length;
    
    const parallelization = totalTaskCount > 0 ? parallelTaskCount / totalTaskCount : 0;
    
    // Calculate resource utilization
    const assignedTasks = workflow.atomicTasks.filter(t => t.metadata?.assignedResource);
    const resourceUtilization = assignedTasks.length / totalTaskCount;
    
    // Estimate cost
    const estimatedCost = workflow.atomicTasks.reduce((cost, task) => 
      cost + (task.metadata?.estimatedCost || 0.05), 0
    );
    
    // Quality score based on complexity and resource quality
    const avgComplexityScore = workflow.atomicTasks.reduce((sum, task) => {
      const complexityScores = { trivial: 1, simple: 2, moderate: 3, complex: 4 };
      return sum + (complexityScores[task.complexity] || 2);
    }, 0) / totalTaskCount;
    
    const qualityScore = Math.min(10, avgComplexityScore * 2.5);
    
    // Feasibility score
    const feasibilityScore = Math.min(10, 
      (resourceUtilization * 5) + 
      (parallelization * 3) + 
      ((workflow.metadata?.successRate || 0.8) * 2)
    );
    
    return {
      parallelization: Math.round(parallelization * 100) / 100,
      resourceUtilization: Math.round(resourceUtilization * 100) / 100,
      estimatedTime: workflow.estimatedDuration,
      estimatedCost: Math.round(estimatedCost * 100) / 100,
      qualityScore: Math.round(qualityScore * 100) / 100,
      feasibilityScore: Math.round(feasibilityScore * 100) / 100
    };
  }

  private generateOptimizationReport(
    original: AtomicWorkflow,
    optimized: AtomicWorkflow
  ): any {
    return {
      timeImprovement: Math.round(
        ((original.estimatedDuration - optimized.estimatedDuration) / original.estimatedDuration) * 100
      ),
      parallelizationIncrease: optimized.executionGraph.parallelBatches.length - 
                               original.executionGraph.parallelBatches.length,
      resourceAssignments: optimized.atomicTasks.filter(t => t.metadata?.assignedResource).length,
      optimizationStrategies: ['task_assignment', 'parallelization', 'dependency_optimization']
    };
  }

  private generateResourceAssignments(tasks: AtomicTask[], resources: RuntimeResource[]): any {
    const assignments: Record<string, string[]> = {};
    
    for (const resource of resources) {
      assignments[resource.id] = tasks
        .filter(t => t.metadata?.assignedResource === resource.id)
        .map(t => t.id);
    }
    
    return assignments;
  }

  private generateCacheKey(intent: WorkflowIntent, files: FileMetadata[]): string {
    const intentHash = this.hashString(JSON.stringify({
      goal: intent.primaryGoal,
      outputType: intent.outputType,
      complexity: intent.complexity,
      constraints: intent.constraints
    }));
    
    const filesInfo = files.map(f => `${f.mimeType}:${f.size}`).join(',');
    const filesHash = this.hashString(filesInfo);
    
    return `wf_${intentHash}_${filesHash}`;
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  private cloneWorkflow(workflow: AtomicWorkflow): AtomicWorkflow {
    return JSON.parse(JSON.stringify(workflow));
  }

  private clearAffectedCaches(resourceId: string): void {
    // Clear workflow caches that used this resource
    for (const [key, workflow] of this.workflowCache.entries()) {
      const usesResource = workflow.atomicTasks.some(task =>
        task.metadata?.assignedResource === resourceId
      );
      if (usesResource) {
        this.workflowCache.delete(key);
      }
    }
  }

  private extractRequiredCapabilities(intent: WorkflowIntent): string[] {
    const capabilities: string[] = [];
    
    switch (intent.outputType) {
      case 'video':
        capabilities.push('video_editing', 'text_generation', 'image_generation', 'audio_generation');
        break;
      case 'audio':
        capabilities.push('audio_generation', 'text_to_speech');
        break;
      case 'image':
        capabilities.push('image_generation', 'image_processing');
        break;
      case 'text':
        capabilities.push('text_generation', 'content_analysis');
        break;
      case 'document':
        capabilities.push('document_processing', 'text_generation');
        break;
    }
    
    if (intent.userFiles.length > 0) {
      capabilities.push('content_analysis', 'data_extraction');
    }
    
    return capabilities;
  }

  private detectOutputTypeFromDescription(description: string): any {
    const lowerDesc = description.toLowerCase();
    
    if (/video|movie|clip|animation/.test(lowerDesc)) return 'video';
    if (/audio|sound|music|speech/.test(lowerDesc)) return 'audio';
    if (/image|picture|photo|graphic/.test(lowerDesc)) return 'image';
    if (/document|report|paper|analysis/.test(lowerDesc)) return 'document';
    if (/data|chart|graph|visualization/.test(lowerDesc)) return 'data';
    
    return 'text';
  }

  private assessDescriptionComplexity(description: string): number {
    let complexity = 1;
    
    // Length-based complexity
    complexity += Math.min(5, description.length / 100);
    
    // Keyword-based complexity
    const complexKeywords = ['comprehensive', 'detailed', 'advanced', 'professional', 'high-quality'];
    const simpleKeywords = ['simple', 'basic', 'quick', 'draft'];
    
    for (const keyword of complexKeywords) {
      if (description.toLowerCase().includes(keyword)) complexity += 1;
    }
    
    for (const keyword of simpleKeywords) {
      if (description.toLowerCase().includes(keyword)) complexity -= 1;
    }
    
    return Math.max(1, Math.min(10, Math.round(complexity)));
  }

  private extractRequirementsFromDescription(description: string): string[] {
    const requirements: string[] = [];
    const lowerDesc = description.toLowerCase();
    
    if (/high.quality|professional|premium/.test(lowerDesc)) {
      requirements.push('high_quality');
    }
    
    if (/fast|quick|urgent|immediately/.test(lowerDesc)) {
      requirements.push('fast_processing');
    }
    
    if (/accurate|precise|detailed/.test(lowerDesc)) {
      requirements.push('high_accuracy');
    }
    
    if (/custom|specific|tailored/.test(lowerDesc)) {
      requirements.push('customization');
    }
    
    return requirements;
  }

  private getDefaultPreferences(): UserPreferences {
    return {
      qualityLevel: 'standard',
      speedPriority: 5,
      costSensitivity: 5,
      preferredFormats: [],
      autoOptimize: true
    };
  }
}

export default RuntimeWorkflowGenerator;