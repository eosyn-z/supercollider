/**
 * Simplified workflow management service without core dependencies
 */

import { v4 as uuidv4 } from 'uuid';

export interface WorkflowCreationRequest {
  prompt: string;
  config?: {
    granularity?: 'fine' | 'coarse';
    batchSize?: number;
    maxSubtasks?: number;
    maxPromptLength?: number;
    maxTokensPerSubtask?: number;
  };
}

export interface Subtask {
  id: string;
  title: string;
  description: string;
  type: 'RESEARCH' | 'ANALYSIS' | 'CREATION' | 'VALIDATION';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'HALTED';
  dependencies: SubtaskDependency[];
  createdAt: Date;
  updatedAt: Date;
  parentWorkflowId: string;
  estimatedDuration?: number;
  assignedAgentId?: string;
  result?: SubtaskResult;
  metadata?: Record<string, any>;
}

export interface SubtaskDependency {
  subtaskId: string;
  type: 'BLOCKING' | 'SOFT' | 'REFERENCE';
  description: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface SubtaskResult {
  content: string;
  metadata?: Record<string, any>;
  generatedAt: Date;
  agentId: string;
  confidence: number;
  errors?: string[];
}

export interface AgentAssignment {
  subtaskId: string;
  agentId: string;
}

export interface Workflow {
  id: string;
  prompt: string;
  subtasks: Subtask[];
  status: 'DRAFT' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'HALTED';
  agentAssignments: AgentAssignment[];
  createdAt: Date;
  updatedAt: Date;
}

export class WorkflowService {
  private workflows: Map<string, Workflow> = new Map();

  constructor() {
    // Initialize with demo workflow
    this.initializeDemoWorkflow();
  }

  private initializeDemoWorkflow(): void {
    const demoWorkflow = this.createDemoWorkflow();
    this.workflows.set(demoWorkflow.id, demoWorkflow);
    console.log(`Initialized demo workflow: ${demoWorkflow.id}`);
  }

  private createDemoWorkflow(): Workflow {
    const workflowId = 'demo-workflow-1';
    const subtasks: Subtask[] = [
      {
        id: 'subtask-1',
        title: 'Research AI Safety Best Practices',
        description: 'Research current best practices and standards for AI safety in organizational settings',
        type: 'RESEARCH',
        priority: 'HIGH',
        status: 'PENDING',
        dependencies: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        parentWorkflowId: workflowId,
        estimatedDuration: 900
      },
      {
        id: 'subtask-2', 
        title: 'Analyze Potential AI Risks',
        description: 'Analyze potential risks and vulnerabilities specific to our AI systems and usage patterns',
        type: 'ANALYSIS',
        priority: 'HIGH',
        status: 'PENDING',
        dependencies: [
          { subtaskId: 'subtask-1', type: 'BLOCKING', description: 'Requires research findings' }
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
        parentWorkflowId: workflowId,
        estimatedDuration: 720
      },
      {
        id: 'subtask-3',
        title: 'Create Implementation Guidelines',
        description: 'Create detailed implementation guidelines and procedures for AI safety protocols',
        type: 'CREATION',
        priority: 'MEDIUM',
        status: 'PENDING',
        dependencies: [
          { subtaskId: 'subtask-2', type: 'BLOCKING', description: 'Requires risk analysis' }
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
        parentWorkflowId: workflowId,
        estimatedDuration: 1200
      },
      {
        id: 'subtask-4',
        title: 'Develop Validation Procedures',
        description: 'Develop procedures for validating and testing AI safety measures',
        type: 'VALIDATION',
        priority: 'MEDIUM',
        status: 'PENDING',
        dependencies: [
          { subtaskId: 'subtask-3', type: 'BLOCKING', description: 'Requires implementation guidelines' }
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
        parentWorkflowId: workflowId,
        estimatedDuration: 600
      },
      {
        id: 'subtask-5',
        title: 'Create Training Materials',
        description: 'Create training materials and documentation for staff on AI safety protocols',
        type: 'CREATION',
        priority: 'LOW',
        status: 'PENDING',
        dependencies: [
          { subtaskId: 'subtask-3', type: 'SOFT', description: 'Benefits from implementation guidelines' }
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
        parentWorkflowId: workflowId,
        estimatedDuration: 480
      }
    ];

    return {
      id: workflowId,
      prompt: 'Create a comprehensive AI safety protocol for our organization. This should include research on current best practices, analysis of potential risks, creation of implementation guidelines, and validation procedures.',
      subtasks,
      status: 'DRAFT',
      agentAssignments: [
        { subtaskId: 'subtask-1', agentId: 'agent-1' },
        { subtaskId: 'subtask-2', agentId: 'agent-1' },
        { subtaskId: 'subtask-3', agentId: 'agent-2' },
        { subtaskId: 'subtask-4', agentId: 'agent-2' },
        { subtaskId: 'subtask-5', agentId: 'agent-2' }
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  async getAllWorkflows(): Promise<Workflow[]> {
    return Array.from(this.workflows.values());
  }

  async getWorkflow(workflowId: string): Promise<Workflow | null> {
    return this.workflows.get(workflowId) || null;
  }

  async createWorkflow(request: WorkflowCreationRequest): Promise<Workflow> {
    const workflowId = uuidv4();
    
    // Simple task slicing based on prompt analysis
    const subtasks = this.simpleTaskSlicing(request.prompt, workflowId, request.config);
    
    // Simple agent assignment
    const agentAssignments: AgentAssignment[] = subtasks.map((subtask, index) => ({
      subtaskId: subtask.id,
      // Alternate between agents for demo
      agentId: index % 2 === 0 ? 'agent-1' : 'agent-2'
    }));

    const workflow: Workflow = {
      id: workflowId,
      prompt: request.prompt,
      subtasks,
      status: 'DRAFT',
      agentAssignments,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.workflows.set(workflowId, workflow);
    
    console.log(`Created workflow ${workflowId} with ${subtasks.length} subtasks`);
    return workflow;
  }

  private simpleTaskSlicing(prompt: string, workflowId: string, config?: any): Subtask[] {
    const maxSubtasks = config?.maxSubtasks || 8;
    const granularity = config?.granularity || 'coarse';
    
    // Simple keyword-based task identification
    const taskKeywords = {
      'RESEARCH': ['research', 'investigate', 'study', 'analyze', 'explore', 'examine'],
      'ANALYSIS': ['analyze', 'evaluate', 'assess', 'review', 'compare', 'determine'],
      'CREATION': ['create', 'develop', 'build', 'design', 'implement', 'generate', 'write'],
      'VALIDATION': ['validate', 'test', 'verify', 'check', 'confirm', 'ensure']
    };

    const subtasks: Subtask[] = [];
    const promptLower = prompt.toLowerCase();
    
    // Detect task types based on keywords
    const detectedTypes: Array<'RESEARCH' | 'ANALYSIS' | 'CREATION' | 'VALIDATION'> = [];
    
    Object.entries(taskKeywords).forEach(([type, keywords]) => {
      if (keywords.some(keyword => promptLower.includes(keyword))) {
        detectedTypes.push(type as any);
      }
    });

    // If no types detected, use default sequence
    if (detectedTypes.length === 0) {
      detectedTypes.push('RESEARCH', 'ANALYSIS', 'CREATION');
    }

    // Create subtasks based on detected types
    detectedTypes.forEach((type, index) => {
      const subtaskId = `subtask-${Date.now()}-${index}`;
      
      let title = '';
      let description = '';
      
      switch (type) {
        case 'RESEARCH':
          title = 'Research and Information Gathering';
          description = 'Gather relevant information and research existing solutions';
          break;
        case 'ANALYSIS':
          title = 'Analysis and Evaluation';
          description = 'Analyze the gathered information and evaluate options';
          break;
        case 'CREATION':
          title = 'Creation and Development';
          description = 'Create and develop the required deliverables';
          break;
        case 'VALIDATION':
          title = 'Validation and Testing';
          description = 'Validate and test the created deliverables';
          break;
      }

      const dependencies: SubtaskDependency[] = index > 0 ? [{
        subtaskId: `subtask-${Date.now()}-${index - 1}`,
        type: 'BLOCKING',
        description: 'Depends on previous subtask completion'
      }] : [];

      subtasks.push({
        id: subtaskId,
        title,
        description,
        type,
        priority: index === 0 ? 'HIGH' : 'MEDIUM',
        status: 'PENDING',
        dependencies,
        createdAt: new Date(),
        updatedAt: new Date(),
        parentWorkflowId: workflowId,
        estimatedDuration: 300 + Math.random() * 900 // 5-20 minutes
      });
    });

    // Add validation subtask if not already present and granularity is fine
    if (granularity === 'fine' && !detectedTypes.includes('VALIDATION') && subtasks.length < maxSubtasks) {
      const validationSubtask: Subtask = {
        id: `subtask-${Date.now()}-validation`,
        title: 'Final Validation',
        description: 'Perform final validation of all deliverables',
        type: 'VALIDATION',
        priority: 'LOW',
        status: 'PENDING',
        dependencies: subtasks.length > 0 ? [{
          subtaskId: subtasks[subtasks.length - 1].id,
          type: 'BLOCKING',
          description: 'Requires completion of creation tasks'
        }] : [],
        createdAt: new Date(),
        updatedAt: new Date(),
        parentWorkflowId: workflowId,
        estimatedDuration: 300
      };
      
      subtasks.push(validationSubtask);
    }

    return subtasks.slice(0, maxSubtasks);
  }

  async updateWorkflow(workflowId: string, updates: Partial<Workflow>): Promise<Workflow | null> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      return null;
    }

    const updatedWorkflow = {
      ...workflow,
      ...updates,
      updatedAt: new Date()
    };

    this.workflows.set(workflowId, updatedWorkflow);
    return updatedWorkflow;
  }

  async deleteWorkflow(workflowId: string): Promise<boolean> {
    return this.workflows.delete(workflowId);
  }

  async getWorkflowSubtasks(workflowId: string): Promise<Subtask[]> {
    const workflow = this.workflows.get(workflowId);
    return workflow?.subtasks || [];
  }

  async updateSubtask(workflowId: string, subtaskId: string, updates: Partial<Subtask>): Promise<boolean> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      return false;
    }

    const subtaskIndex = workflow.subtasks.findIndex(s => s.id === subtaskId);
    if (subtaskIndex === -1) {
      return false;
    }

    workflow.subtasks[subtaskIndex] = {
      ...workflow.subtasks[subtaskIndex],
      ...updates,
      updatedAt: new Date()
    };

    workflow.updatedAt = new Date();
    this.workflows.set(workflowId, workflow);
    
    return true;
  }

  async getWorkflowStats(): Promise<any> {
    const workflows = Array.from(this.workflows.values());
    
    return {
      total: workflows.length,
      byStatus: {
        draft: workflows.filter(w => w.status === 'DRAFT').length,
        running: workflows.filter(w => w.status === 'RUNNING').length,
        completed: workflows.filter(w => w.status === 'COMPLETED').length,
        failed: workflows.filter(w => w.status === 'FAILED').length,
        halted: workflows.filter(w => w.status === 'HALTED').length
      },
      averageSubtasks: workflows.length > 0 
        ? workflows.reduce((sum, w) => sum + w.subtasks.length, 0) / workflows.length 
        : 0,
      taskTypeDistribution: this.getTaskTypeDistribution(workflows)
    };
  }

  private getTaskTypeDistribution(workflows: Workflow[]): Record<string, number> {
    const distribution: Record<string, number> = {};
    
    workflows.forEach(workflow => {
      workflow.subtasks.forEach(subtask => {
        distribution[subtask.type] = (distribution[subtask.type] || 0) + 1;
      });
    });

    return distribution;
  }
}