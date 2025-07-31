/**
 * Core types for workflow orchestration and management
 */
import { Subtask, SubtaskType, Priority } from './subtaskSchema';
import { AgentAssignment } from './agentRegistry';

export interface Workflow {
  id: string;
  prompt: string;
  subtasks: Subtask[];
  status: WorkflowStatus;
  agentAssignments: AgentAssignment[];
}

export enum WorkflowStatus {
  DRAFT = 'DRAFT',
  PLANNING = 'PLANNING',
  EXECUTING = 'EXECUTING',
  COMPLETED = 'COMPLETED'
}

export interface WorkflowExecution {
  currentStep: number;
  results: WorkflowResult[];
  errors: WorkflowError[];
}


export interface WorkflowResult {
  subtaskId: string;
  content: string;
  metadata?: Record<string, any>;
}

export interface WorkflowError {
  message: string;
  timestamp: Date;
  subtaskId?: string;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  subtaskTemplates: SubtaskTemplate[];
}

export interface SubtaskTemplate {
  title: string;
  description: string;
  type: SubtaskType;
  priority: Priority;
} 