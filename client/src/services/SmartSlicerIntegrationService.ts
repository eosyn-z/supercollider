/**
 * Smart Slicer Integration Service
 * Orchestrates the complete flow: User Input → Slicer → Clean Prompts → Preambles → Workflow Visualization
 */

import { SmartShredder, PromptShred, ShredResult } from '../../../server/core/utils/smartShredder';
import { BatchOptimizer, BatchGroup } from '../../../server/core/batch/batchOptimizer';
import { AgentExecutorService } from './AgentExecutorService';

// Export types for use in other components
export type { PromptShred, ShredResult, BatchGroup };

interface Agent {
  id: string;
  name: string;
  type: string;
  capabilities: string[];
  preamble: string;
  endpoint?: string;
}

interface AtomicTask {
  id: string;
  title: string;
  type: string;
  originalShred: PromptShred;
  cleanPrompt: string;
  agentPrompt: string;
  assignedAgent: Agent | null;
  status: 'pending' | 'generating' | 'ready' | 'executing' | 'completed' | 'failed';
  dependencies: string[];
  estimatedDuration: number;
  batchGroup?: string;
  executionResult?: any;
  error?: string;
}

interface WorkflowGraph {
  id: string;
  originalPrompt: string;
  atomicTasks: AtomicTask[];
  batchGroups: BatchGroup[];
  executionOrder: string[][];
  estimatedDuration: number;
  status: 'draft' | 'ready' | 'executing' | 'completed' | 'failed';
  createdAt: Date;
  modifiedAt: Date;
}

interface SlicerProgress {
  phase: 'slicing' | 'generating_clean' | 'adding_preambles' | 'optimizing' | 'ready';
  message: string;
  progress: number;
  currentTask?: string;
}

export class SmartSlicerIntegrationService {
  private smartShredder: SmartShredder;
  private batchOptimizer: BatchOptimizer;
  private agentExecutor: AgentExecutorService;
  private availableAgents: Agent[] = [];

  constructor() {
    this.smartShredder = new SmartShredder();
    this.batchOptimizer = new BatchOptimizer();
    this.agentExecutor = new AgentExecutorService();
  }

  /**
   * Main entry point: Process user prompt into executable workflow
   */
  async processUserPrompt(
    userPrompt: string,
    options: {
      targetTokenSize?: number;
      maxTasks?: number;
      enableBatching?: boolean;
      autoAssignAgents?: boolean;
    } = {},
    onProgress?: (progress: SlicerProgress) => void
  ): Promise<WorkflowGraph> {
    const {
      targetTokenSize = 2000,
      maxTasks = 20,
      enableBatching = true,
      autoAssignAgents = true
    } = options;

    // Phase 1: Smart Slicing
    onProgress?.({
      phase: 'slicing',
      message: 'Analyzing prompt and identifying atomic tasks...',
      progress: 10
    });

    const shredResult = await this.smartShredder.smartShred(userPrompt, targetTokenSize);
    const limitedShreds = shredResult.shreds.slice(0, maxTasks);

    onProgress?.({
      phase: 'slicing',
      message: `Identified ${limitedShreds.length} atomic tasks`,
      progress: 25
    });

    // Phase 2: Generate Clean Prompts
    onProgress?.({
      phase: 'generating_clean',
      message: 'Generating clean, context-free prompts...',
      progress: 35
    });

    const cleanPrompts = await this.generateCleanPrompts(limitedShreds, userPrompt);

    onProgress?.({
      phase: 'generating_clean',
      message: 'Clean prompts generated successfully',
      progress: 50
    });

    // Phase 3: Add Agent-Specific Preambles
    onProgress?.({
      phase: 'adding_preambles',
      message: 'Adding agent-specific preambles...',
      progress: 65
    });

    const atomicTasks = await this.createAtomicTasks(limitedShreds, cleanPrompts, autoAssignAgents);

    onProgress?.({
      phase: 'adding_preambles',
      message: 'Agent assignments and preambles added',
      progress: 75
    });

    // Phase 4: Batch Optimization
    let batchGroups: BatchGroup[] = [];
    if (enableBatching) {
      onProgress?.({
        phase: 'optimizing',
        message: 'Optimizing batch execution...',
        progress: 85
      });

      batchGroups = this.batchOptimizer.identifyBatchGroups(limitedShreds);
      this.applyBatchGroupsToTasks(atomicTasks, batchGroups);
    }

    // Phase 5: Create Workflow Graph
    onProgress?.({
      phase: 'ready',
      message: 'Workflow ready for review and execution',
      progress: 100
    });

    const workflowGraph: WorkflowGraph = {
      id: this.generateId(),
      originalPrompt: userPrompt,
      atomicTasks,
      batchGroups,
      executionOrder: this.calculateExecutionOrder(atomicTasks, batchGroups),
      estimatedDuration: this.calculateTotalDuration(atomicTasks, batchGroups),
      status: 'ready',
      createdAt: new Date(),
      modifiedAt: new Date()
    };

    return workflowGraph;
  }

  /**
   * Generate clean prompts without preambles using AI
   */
  private async generateCleanPrompts(
    shreds: PromptShred[],
    originalPrompt: string
  ): Promise<Map<string, string>> {
    const cleanPrompts = new Map<string, string>();
    
    const cleanPromptGeneratorPrompt = `You are a prompt cleaner. Your job is to take atomic task descriptions and convert them into clean, self-contained prompts without any preambles, explanations, or meta-commentary.

Original User Request: "${originalPrompt}"

For each atomic task below, output ONLY the clean prompt that should be sent to an AI agent. No preamble, no "Here's the task:", no explanations - just the direct instruction.

Format your response as:
TASK_ID: clean prompt here
TASK_ID: clean prompt here

Tasks to clean:
${shreds.map(shred => `${shred.id}: ${shred.content}`).join('\n')}`;

    try {
      const response = await this.agentExecutor.executeAgent({
        agentType: 'PROMPTCLEANER',
        inputs: { user_input_here: cleanPromptGeneratorPrompt },
        options: { timeout: 30000 }
      });

      if (response.success) {
        // Parse the response to extract clean prompts
        const lines = response.output.split('\n').filter(line => line.includes(':'));
        for (const line of lines) {
          const [taskId, ...promptParts] = line.split(':');
          if (taskId && promptParts.length > 0) {
            const cleanPrompt = promptParts.join(':').trim();
            cleanPrompts.set(taskId.trim(), cleanPrompt);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to generate clean prompts via AI, using fallback method');
      // Fallback: Basic cleaning
      for (const shred of shreds) {
        cleanPrompts.set(shred.id, this.basicCleanPrompt(shred.content));
      }
    }

    // Ensure all shreds have clean prompts
    for (const shred of shreds) {
      if (!cleanPrompts.has(shred.id)) {
        cleanPrompts.set(shred.id, this.basicCleanPrompt(shred.content));
      }
    }

    return cleanPrompts;
  }

  /**
   * Basic fallback method for cleaning prompts
   */
  private basicCleanPrompt(content: string): string {
    return content
      .replace(/^(Task|Subtask|Phase)\s*\d*:?\s*/i, '')
      .replace(/^(Research|Analysis|Creation|Validation)\s*(Phase|Task)?\s*\d*:?\s*/i, '')
      .replace(/^(Please|You should|The task is to)\s*/i, '')
      .trim();
  }

  /**
   * Create atomic tasks with agent assignments and preambles
   */
  private async createAtomicTasks(
    shreds: PromptShred[],
    cleanPrompts: Map<string, string>,
    autoAssignAgents: boolean
  ): Promise<AtomicTask[]> {
    const atomicTasks: AtomicTask[] = [];

    for (const shred of shreds) {
      const cleanPrompt = cleanPrompts.get(shred.id) || shred.content;
      let assignedAgent: Agent | null = null;
      let agentPrompt = cleanPrompt;

      if (autoAssignAgents) {
        assignedAgent = this.findBestAgent(shred);
        if (assignedAgent) {
          agentPrompt = this.attachPreamble(cleanPrompt, assignedAgent);
        }
      }

      const atomicTask: AtomicTask = {
        id: shred.id,
        title: this.generateTaskTitle(shred),
        type: shred.atomType,
        originalShred: shred,
        cleanPrompt,
        agentPrompt,
        assignedAgent,
        status: 'ready',
        dependencies: shred.dependencies,
        estimatedDuration: Math.ceil(shred.estimatedTokens * 0.1),
        batchGroup: undefined,
        executionResult: undefined,
        error: undefined
      };

      atomicTasks.push(atomicTask);
    }

    return atomicTasks;
  }

  /**
   * Find the best agent for a given shred based on capabilities
   */
  private findBestAgent(shred: PromptShred): Agent | null {
    if (this.availableAgents.length === 0) {
      return null;
    }

    // Score agents based on capability match
    const agentScores = this.availableAgents.map(agent => ({
      agent,
      score: this.calculateAgentScore(agent, shred)
    }));

    agentScores.sort((a, b) => b.score - a.score);
    
    return agentScores[0].score > 0 ? agentScores[0].agent : this.availableAgents[0];
  }

  /**
   * Calculate how well an agent matches a shred's requirements
   */
  private calculateAgentScore(agent: Agent, shred: PromptShred): number {
    let score = 0;

    // Capability overlap
    const agentCaps = new Set(agent.capabilities.map(c => c.toLowerCase()));
    const shredCaps = new Set(shred.agentCapabilities.map(c => c.toLowerCase()));
    const intersection = new Set([...agentCaps].filter(x => shredCaps.has(x)));
    score += (intersection.size / Math.max(shredCaps.size, 1)) * 50;

    // Atom type match
    const atomTypeMap: Record<string, string[]> = {
      'RESEARCH': ['research', 'search', 'data'],
      'ANALYSIS': ['analysis', 'reasoning', 'evaluation'],
      'CREATION': ['creation', 'generation', 'coding', 'writing'],
      'VALIDATION': ['validation', 'testing', 'qa', 'debugging']
    };

    const expectedTypes = atomTypeMap[shred.atomType] || [];
    const hasTypeMatch = expectedTypes.some(type => 
      agent.type.toLowerCase().includes(type) || 
      agent.capabilities.some(cap => cap.toLowerCase().includes(type))
    );
    if (hasTypeMatch) score += 30;

    // Complexity match - complex tasks for specialized agents
    if (shred.estimatedTokens > 1000 && agent.type !== 'general-purpose') {
      score += 20;
    } else if (shred.estimatedTokens <= 500 && agent.type === 'general-purpose') {
      score += 10;
    }

    return score;
  }

  /**
   * Attach agent-specific preamble to clean prompt
   */
  private attachPreamble(cleanPrompt: string, agent: Agent): string {
    if (!agent.preamble) {
      return cleanPrompt;
    }

    return `${agent.preamble}

${cleanPrompt}`;
  }

  /**
   * Apply batch group information to atomic tasks
   */
  private applyBatchGroupsToTasks(atomicTasks: AtomicTask[], batchGroups: BatchGroup[]): void {
    const taskToBatch = new Map<string, string>();

    for (const group of batchGroups) {
      for (const task of group.tasks) {
        taskToBatch.set(task.id, group.groupId);
      }
    }

    for (const task of atomicTasks) {
      const batchGroupId = taskToBatch.get(task.id);
      if (batchGroupId) {
        task.batchGroup = batchGroupId;
      }
    }
  }

  /**
   * Calculate execution order considering dependencies and batching
   */
  private calculateExecutionOrder(atomicTasks: AtomicTask[], batchGroups: BatchGroup[]): string[][] {
    const executionBatches: string[][] = [];
    const processedTasks = new Set<string>();
    const taskMap = new Map(atomicTasks.map(task => [task.id, task]));

    // Create batch groups that can execute in parallel
    const batchableTaskIds = new Set(
      batchGroups.flatMap(group => 
        group.canExecuteInParallel ? group.tasks.map(t => t.id) : []
      )
    );

    while (processedTasks.size < atomicTasks.length) {
      const currentBatch: string[] = [];

      // Find tasks that can execute now (all dependencies met)
      for (const task of atomicTasks) {
        if (processedTasks.has(task.id)) continue;

        const dependenciesMet = task.dependencies.every(depId => processedTasks.has(depId));
        if (dependenciesMet) {
          currentBatch.push(task.id);
          processedTasks.add(task.id);
        }
      }

      if (currentBatch.length === 0) {
        // Prevent infinite loop - add remaining tasks even if dependencies aren't met
        const remainingTasks = atomicTasks
          .filter(task => !processedTasks.has(task.id))
          .map(task => task.id);
        
        if (remainingTasks.length > 0) {
          currentBatch.push(...remainingTasks);
          remainingTasks.forEach(id => processedTasks.add(id));
        }
      }

      if (currentBatch.length > 0) {
        executionBatches.push(currentBatch);
      }
    }

    return executionBatches;
  }

  /**
   * Calculate total estimated duration considering parallel execution
   */
  private calculateTotalDuration(atomicTasks: AtomicTask[], batchGroups: BatchGroup[]): number {
    let totalDuration = 0;

    // If we have batch groups, use their optimized timing
    if (batchGroups.length > 0) {
      const sequentialGroups = batchGroups.filter(g => !g.canExecuteInParallel);
      const parallelGroups = batchGroups.filter(g => g.canExecuteInParallel);

      // Sequential groups add their full duration
      totalDuration += sequentialGroups.reduce((sum, group) => sum + group.estimatedExecutionTime, 0);

      // Parallel groups take the maximum duration among them
      if (parallelGroups.length > 0) {
        totalDuration += Math.max(...parallelGroups.map(g => g.estimatedExecutionTime));
      }

      // Add individual tasks not in any group
      const groupedTaskIds = new Set(batchGroups.flatMap(g => g.tasks.map(t => t.id)));
      const ungroupedTasks = atomicTasks.filter(task => !groupedTaskIds.has(task.id));
      totalDuration += ungroupedTasks.reduce((sum, task) => sum + task.estimatedDuration, 0);
    } else {
      // No batching - assume sequential execution
      totalDuration = atomicTasks.reduce((sum, task) => sum + task.estimatedDuration, 0);
    }

    return totalDuration;
  }

  /**
   * Generate a descriptive title for an atomic task
   */
  private generateTaskTitle(shred: PromptShred): string {
    const typeMap: Record<string, string> = {
      'RESEARCH': 'Research',
      'ANALYSIS': 'Analyze',
      'CREATION': 'Create',
      'VALIDATION': 'Validate',
      'PLANNING': 'Plan',
      'OPTIMIZATION': 'Optimize', 
      'DOCUMENTATION': 'Document',
      'INTEGRATION': 'Integrate'
    };

    const action = typeMap[shred.atomType] || 'Process';
    const snippet = shred.content.length > 50 
      ? shred.content.substring(0, 47) + '...'
      : shred.content;

    return `${action}: ${snippet}`;
  }

  /**
   * Set available agents for task assignment
   */
  setAvailableAgents(agents: Agent[]): void {
    this.availableAgents = agents;
  }

  /**
   * Modify workflow tasks (for user editing)
   */
  modifyWorkflow(
    workflow: WorkflowGraph, 
    modifications: {
      taskId: string;
      changes: Partial<AtomicTask>;
    }[]
  ): WorkflowGraph {
    const updatedTasks = workflow.atomicTasks.map(task => {
      const modification = modifications.find(mod => mod.taskId === task.id);
      if (modification) {
        return { ...task, ...modification.changes };
      }
      return task;
    });

    return {
      ...workflow,
      atomicTasks: updatedTasks,
      modifiedAt: new Date(),
      // Recalculate execution order if dependencies changed
      executionOrder: this.calculateExecutionOrder(updatedTasks, workflow.batchGroups)
    };
  }

  /**
   * Execute a single atomic task
   */
  async executeAtomicTask(task: AtomicTask): Promise<AtomicTask> {
    if (!task.assignedAgent) {
      throw new Error(`No agent assigned to task: ${task.id}`);
    }

    try {
      const result = await this.agentExecutor.executeAgent({
        agentType: task.assignedAgent.type,
        inputs: { user_input_here: task.agentPrompt },
        options: { timeout: 60000 }
      });

      return {
        ...task,
        status: result.success ? 'completed' : 'failed',
        executionResult: result.success ? result.output : undefined,
        error: result.success ? undefined : result.error
      };
    } catch (error) {
      return {
        ...task,
        status: 'failed',
        error: error.toString()
      };
    }
  }

  private generateId(): string {
    return `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export additional types
export type { Agent, AtomicTask, WorkflowGraph, SlicerProgress };