import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Workflow } from '../../../core/types/workflowSchema';
import { Subtask, SubtaskType, Priority, SubtaskStatus } from '../../../core/types/subtaskSchema';

export interface FileMetadata {
  id: string;
  name: string;
  type: 'workflow' | 'prompt' | 'agent' | 'template';
  createdAt: Date;
  updatedAt: Date;
  size: number;
  tags: string[];
  description?: string;
}

export interface AtomicWorkflowDecomposition {
  workflowId: string;
  atomicUnits: AtomicUnit[];
  decompositionStrategy: 'hierarchical' | 'sequential' | 'parallel' | 'hybrid';
  metadata: {
    totalUnits: number;
    estimatedDuration: number;
    complexity: 'low' | 'medium' | 'high';
    dependencies: string[];
  };
}

export interface AtomicUnit {
  id: string;
  title: string;
  description: string;
  type: SubtaskType;
  priority: Priority;
  estimatedDuration: number;
  dependencies: string[];
  requirements: string[];
  deliverables: string[];
  validationCriteria: string[];
  agentRequirements: string[];
  atomicLevel: 'micro' | 'mini' | 'standard';
  complexity: number; // 1-10 scale
  canParallelize: boolean;
  retryPolicy: {
    maxRetries: number;
    backoffStrategy: 'linear' | 'exponential';
    failureThreshold: number;
  };
}

export class FileManager {
  private dataDir: string;
  private workflowsDir: string;
  private promptsDir: string;
  private agentsDir: string;
  private templatesDir: string;

  constructor() {
    this.dataDir = path.join(process.cwd(), 'data');
    this.workflowsDir = path.join(this.dataDir, 'workflows');
    this.promptsDir = path.join(this.dataDir, 'prompts');
    this.agentsDir = path.join(this.dataDir, 'agents');
    this.templatesDir = path.join(this.dataDir, 'templates');
    this.ensureDirectories();
  }

  private async ensureDirectories(): Promise<void> {
    const dirs = [this.dataDir, this.workflowsDir, this.promptsDir, this.agentsDir, this.templatesDir];
    for (const dir of dirs) {
      try {
        await fs.access(dir);
      } catch {
        await fs.mkdir(dir, { recursive: true });
      }
    }
  }

  // File Management Methods
  async saveWorkflow(workflow: Workflow): Promise<string> {
    const filename = `${workflow.id}.json`;
    const filepath = path.join(this.workflowsDir, filename);
    
    const workflowData = {
      ...workflow,
      metadata: {
        savedAt: new Date(),
        version: '1.0',
        fileSize: 0
      }
    };

    const content = JSON.stringify(workflowData, null, 2);
    await fs.writeFile(filepath, content, 'utf8');
    
    // Update file size
    const stats = await fs.stat(filepath);
    workflowData.metadata.fileSize = stats.size;
    await fs.writeFile(filepath, JSON.stringify(workflowData, null, 2), 'utf8');
    
    return filepath;
  }

  async loadWorkflow(workflowId: string): Promise<Workflow | null> {
    try {
      const filename = `${workflowId}.json`;
      const filepath = path.join(this.workflowsDir, filename);
      const content = await fs.readFile(filepath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      console.error(`Failed to load workflow ${workflowId}:`, error);
      return null;
    }
  }

  async listWorkflows(): Promise<FileMetadata[]> {
    try {
      const files = await fs.readdir(this.workflowsDir);
      const metadata: FileMetadata[] = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const filepath = path.join(this.workflowsDir, file);
          const stats = await fs.stat(filepath);
          const content = await fs.readFile(filepath, 'utf8');
          const workflow = JSON.parse(content);

          metadata.push({
            id: workflow.id,
            name: workflow.name || workflow.id,
            type: 'workflow',
            createdAt: new Date(stats.birthtime),
            updatedAt: new Date(stats.mtime),
            size: stats.size,
            tags: workflow.tags || [],
            description: workflow.description
          });
        }
      }

      return metadata.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    } catch (error) {
      console.error('Failed to list workflows:', error);
      return [];
    }
  }

  async deleteWorkflow(workflowId: string): Promise<boolean> {
    try {
      const filename = `${workflowId}.json`;
      const filepath = path.join(this.workflowsDir, filename);
      await fs.unlink(filepath);
      return true;
    } catch (error) {
      console.error(`Failed to delete workflow ${workflowId}:`, error);
      return false;
    }
  }

  // Atomic Workflow Decomposition Methods
  async decomposeWorkflow(workflow: Workflow): Promise<AtomicWorkflowDecomposition> {
    const atomicUnits: AtomicUnit[] = [];
    
    // Analyze workflow complexity and determine decomposition strategy
    const strategy = this.determineDecompositionStrategy(workflow);
    
    // Create atomic units from subtasks
    for (const subtask of workflow.subtasks) {
      const atomicUnit = await this.createAtomicUnit(subtask, workflow);
      atomicUnits.push(atomicUnit);
    }

    // Add additional atomic units for workflow-level tasks
    const workflowLevelUnits = await this.createWorkflowLevelUnits(workflow);
    atomicUnits.push(...workflowLevelUnits);

    // Calculate metadata
    const metadata = this.calculateDecompositionMetadata(atomicUnits);

    return {
      workflowId: workflow.id,
      atomicUnits,
      decompositionStrategy: strategy,
      metadata
    };
  }

  private determineDecompositionStrategy(workflow: Workflow): 'hierarchical' | 'sequential' | 'parallel' | 'hybrid' {
    const subtaskCount = workflow.subtasks.length;
    const hasComplexDependencies = workflow.subtasks.some(s => s.dependencies.length > 2);
    const hasParallelSubtasks = workflow.subtasks.some(s => s.dependencies.length === 0);

    if (subtaskCount > 10 && hasComplexDependencies) {
      return 'hierarchical';
    } else if (hasParallelSubtasks && subtaskCount > 5) {
      return 'parallel';
    } else if (subtaskCount <= 5) {
      return 'sequential';
    } else {
      return 'hybrid';
    }
  }

  private async createAtomicUnit(subtask: Subtask, workflow: Workflow): Promise<AtomicUnit> {
    const complexity = this.calculateComplexity(subtask);
    const atomicLevel = this.determineAtomicLevel(subtask, complexity);
    const canParallelize = subtask.dependencies.length === 0;

    return {
      id: `atomic-${subtask.id}`,
      title: subtask.title,
      description: subtask.description,
      type: subtask.type,
      priority: subtask.priority,
      estimatedDuration: subtask.estimatedDuration || 30,
      dependencies: subtask.dependencies.map(d => d.subtaskId),
      requirements: this.extractRequirements(subtask),
      deliverables: this.defineDeliverables(subtask),
      validationCriteria: this.defineValidationCriteria(subtask),
      agentRequirements: this.defineAgentRequirements(subtask),
      atomicLevel,
      complexity,
      canParallelize,
      retryPolicy: {
        maxRetries: 3,
        backoffStrategy: 'exponential',
        failureThreshold: 0.8
      }
    };
  }

  private async createWorkflowLevelUnits(workflow: Workflow): Promise<AtomicUnit[]> {
    const units: AtomicUnit[] = [];

    // Add workflow initialization unit
    units.push({
      id: `atomic-init-${workflow.id}`,
      title: 'Workflow Initialization',
      description: 'Initialize workflow execution environment and validate prerequisites',
      type: SubtaskType.VALIDATION,
      priority: 'HIGH' as Priority,
      estimatedDuration: 5,
      dependencies: [],
      requirements: ['All agents available', 'API keys valid', 'Storage accessible'],
      deliverables: ['Initialization report', 'Environment status'],
      validationCriteria: ['All prerequisites met', 'No blocking errors'],
      agentRequirements: ['System agent'],
      atomicLevel: 'micro',
      complexity: 2,
      canParallelize: false,
      retryPolicy: {
        maxRetries: 1,
        backoffStrategy: 'linear',
        failureThreshold: 1.0
      }
    });

    // Add workflow completion unit
    units.push({
      id: `atomic-complete-${workflow.id}`,
      title: 'Workflow Completion',
      description: 'Finalize workflow execution and generate summary report',
      type: SubtaskType.VALIDATION,
      priority: 'HIGH' as Priority,
      estimatedDuration: 10,
      dependencies: workflow.subtasks.map(s => s.id),
      requirements: ['All subtasks completed', 'Results available'],
      deliverables: ['Final report', 'Execution summary', 'Quality metrics'],
      validationCriteria: ['All deliverables present', 'Quality thresholds met'],
      agentRequirements: ['Analysis agent'],
      atomicLevel: 'standard',
      complexity: 4,
      canParallelize: false,
      retryPolicy: {
        maxRetries: 2,
        backoffStrategy: 'linear',
        failureThreshold: 0.9
      }
    });

    return units;
  }

  private calculateComplexity(subtask: Subtask): number {
    let complexity = 3; // Base complexity

    // Adjust based on type
    switch (subtask.type) {
      case SubtaskType.RESEARCH:
        complexity += 2;
        break;
      case SubtaskType.ANALYSIS:
        complexity += 3;
        break;
      case SubtaskType.CREATION:
        complexity += 4;
        break;
      case SubtaskType.VALIDATION:
        complexity += 2;
        break;
    }

    // Adjust based on dependencies
    complexity += subtask.dependencies.length * 0.5;

    // Adjust based on priority
    if (subtask.priority === 'HIGH') complexity += 1;
    if (subtask.priority === 'LOW') complexity -= 1;

    // Adjust based on estimated duration
    if (subtask.estimatedDuration && subtask.estimatedDuration > 60) complexity += 2;

    return Math.min(Math.max(complexity, 1), 10);
  }

  private determineAtomicLevel(subtask: Subtask, complexity: number): 'micro' | 'mini' | 'standard' {
    if (complexity <= 3 && subtask.estimatedDuration && subtask.estimatedDuration <= 15) {
      return 'micro';
    } else if (complexity <= 6 && subtask.estimatedDuration && subtask.estimatedDuration <= 45) {
      return 'mini';
    } else {
      return 'standard';
    }
  }

  private extractRequirements(subtask: Subtask): string[] {
    const requirements: string[] = [];
    
    // Add dependencies as requirements
    subtask.dependencies.forEach(dep => {
      requirements.push(`Dependency: ${dep.description}`);
    });

    // Add type-specific requirements
    switch (subtask.type) {
      case SubtaskType.RESEARCH:
        requirements.push('Access to research databases', 'Search capabilities');
        break;
      case SubtaskType.ANALYSIS:
        requirements.push('Analytical tools', 'Data processing capabilities');
        break;
      case SubtaskType.CREATION:
        requirements.push('Content generation tools', 'Formatting capabilities');
        break;
      case SubtaskType.VALIDATION:
        requirements.push('Validation frameworks', 'Quality assessment tools');
        break;
    }

    return requirements;
  }

  private defineDeliverables(subtask: Subtask): string[] {
    const deliverables: string[] = [];

    switch (subtask.type) {
      case SubtaskType.RESEARCH:
        deliverables.push('Research findings', 'Source citations', 'Data summary');
        break;
      case SubtaskType.ANALYSIS:
        deliverables.push('Analysis report', 'Insights summary', 'Recommendations');
        break;
      case SubtaskType.CREATION:
        deliverables.push('Created content', 'Formatted output', 'Metadata');
        break;
      case SubtaskType.VALIDATION:
        deliverables.push('Validation report', 'Quality metrics', 'Approval status');
        break;
    }

    return deliverables;
  }

  private defineValidationCriteria(subtask: Subtask): string[] {
    const criteria: string[] = [];

    // Add type-specific validation criteria
    switch (subtask.type) {
      case SubtaskType.RESEARCH:
        criteria.push('Sources are credible', 'Information is current', 'Coverage is comprehensive');
        break;
      case SubtaskType.ANALYSIS:
        criteria.push('Analysis is thorough', 'Conclusions are supported', 'Insights are actionable');
        break;
      case SubtaskType.CREATION:
        criteria.push('Content is accurate', 'Format is appropriate', 'Quality meets standards');
        break;
      case SubtaskType.VALIDATION:
        criteria.push('Validation is complete', 'Quality thresholds met', 'No critical issues');
        break;
    }

    return criteria;
  }

  private defineAgentRequirements(subtask: Subtask): string[] {
    const requirements: string[] = [];

    switch (subtask.type) {
      case SubtaskType.RESEARCH:
        requirements.push('Research capabilities', 'Information gathering');
        break;
      case SubtaskType.ANALYSIS:
        requirements.push('Analytical capabilities', 'Data processing');
        break;
      case SubtaskType.CREATION:
        requirements.push('Content creation', 'Formatting capabilities');
        break;
      case SubtaskType.VALIDATION:
        requirements.push('Quality assessment', 'Validation expertise');
        break;
    }

    return requirements;
  }

  private calculateDecompositionMetadata(atomicUnits: AtomicUnit[]) {
    const totalUnits = atomicUnits.length;
    const estimatedDuration = atomicUnits.reduce((sum, unit) => sum + unit.estimatedDuration, 0);
    const avgComplexity = atomicUnits.reduce((sum, unit) => sum + unit.complexity, 0) / totalUnits;
    
    let complexity: 'low' | 'medium' | 'high';
    if (avgComplexity <= 4) complexity = 'low';
    else if (avgComplexity <= 7) complexity = 'medium';
    else complexity = 'high';

    const dependencies = atomicUnits
      .flatMap(unit => unit.dependencies)
      .filter((dep, index, arr) => arr.indexOf(dep) === index);

    return {
      totalUnits,
      estimatedDuration,
      complexity,
      dependencies
    };
  }

  // Save and load atomic decompositions
  async saveAtomicDecomposition(decomposition: AtomicWorkflowDecomposition): Promise<string> {
    const filename = `atomic-${decomposition.workflowId}.json`;
    const filepath = path.join(this.workflowsDir, filename);
    
    const content = JSON.stringify(decomposition, null, 2);
    await fs.writeFile(filepath, content, 'utf8');
    
    return filepath;
  }

  async loadAtomicDecomposition(workflowId: string): Promise<AtomicWorkflowDecomposition | null> {
    try {
      const filename = `atomic-${workflowId}.json`;
      const filepath = path.join(this.workflowsDir, filename);
      const content = await fs.readFile(filepath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      console.error(`Failed to load atomic decomposition for workflow ${workflowId}:`, error);
      return null;
    }
  }

  // File system utilities
  async getFileStats(filepath: string): Promise<fs.Stats | null> {
    try {
      return await fs.stat(filepath);
    } catch {
      return null;
    }
  }

  async backupWorkflow(workflowId: string): Promise<string> {
    const sourceFile = path.join(this.workflowsDir, `${workflowId}.json`);
    const backupFile = path.join(this.workflowsDir, `${workflowId}-backup-${Date.now()}.json`);
    
    await fs.copyFile(sourceFile, backupFile);
    return backupFile;
  }

  async cleanupOldBackups(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<number> {
    const files = await fs.readdir(this.workflowsDir);
    const backupFiles = files.filter(f => f.includes('-backup-'));
    let deletedCount = 0;

    for (const file of backupFiles) {
      const filepath = path.join(this.workflowsDir, file);
      const stats = await fs.stat(filepath);
      const age = Date.now() - stats.mtime.getTime();

      if (age > maxAge) {
        await fs.unlink(filepath);
        deletedCount++;
      }
    }

    return deletedCount;
  }
}

export const fileManager = new FileManager(); 