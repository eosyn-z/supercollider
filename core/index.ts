/**
 * Core module exports for Supercollider
 * 
 * This module provides the core logic for the Supercollider system:
 * - Task slicing and subtask management
 * - Agent registry and capability matching
 * - Workflow orchestration and execution planning
 */

// Type exports
export * from './types/subtaskSchema';
export * from './types/agentRegistry';
export * from './types/workflowSchema';

// Utility exports
export * from './utils/taskSlicer';
export * from './utils/agentMatcher';
export * from './utils/executionPlanner';

// Re-export key classes for easy access
export { TaskSlicer } from './utils/taskSlicer';
export { AgentMatcher } from './utils/agentMatcher';
export { 
  batchSubtasks, 
  planDispatch, 
  validateBatching, 
  optimizeBatches 
} from './utils/executionPlanner';

// Type guards and utilities
export const isSubtaskCompleted = (subtask: any): boolean => {
  return subtask?.status === 'COMPLETED' && subtask?.result?.content;
};

export const isAgentAvailable = (agent: any): boolean => {
  return Boolean(agent?.availability);
};

export const hasRequiredCapability = (agent: any, capabilityName: string): boolean => {
  return agent?.capabilities?.some((cap: any) => cap.name === capabilityName) || false;
};