/**
 * Enhanced execution planning utilities with cycle detection and large prompt batching
 */

import { Subtask, SubtaskDependency } from '../types/subtaskSchema';
import { Agent } from '../types/agentRegistry';

export interface CycleDetectionResult {
  hasCycles: boolean;
  cycles: string[][];
  affectedSubtasks: string[];
  suggestions: string[];
}

export interface BatchingConfig {
  maxBatchSize: number;
  maxPromptLength: number;
  maxTokensPerBatch: number;
  allowPartialBatching: boolean;
  respectDependencies: boolean;
  balanceWorkloads: boolean;
}

export interface LargePromptBatchingResult {
  batches: Subtask[][];
  oversizedTasks: Subtask[];
  totalTokenCount: number;
  batchStatistics: {
    averageBatchSize: number;
    averageTokensPerBatch: number;
    maxTokensInBatch: number;
    dependencyViolations: number;
  };
}

export interface ExecutionPlan {
  orderedBatches: Subtask[][];
  assignedAgents: Record<string, string>; // batchId -> agentId
  dependencyTree: DependencyNode[];
  estimatedTotalDuration: number;
}

export interface DependencyNode {
  subtaskId: string;
  dependencies: string[];
  dependents: string[];
  level: number; // Execution level/depth in dependency tree
}

/**
 * Enhanced batching with cycle detection and large prompt handling
 */
export function batchSubtasksAdvanced(
  subtasks: Subtask[], 
  config: BatchingConfig
): LargePromptBatchingResult {
  // First, detect and resolve dependency cycles
  const cycleResult = detectDependencyCycles(subtasks);
  if (cycleResult.hasCycles) {
    // Resolve cycles by breaking least critical dependencies
    subtasks = resolveDependencyCycles(subtasks, cycleResult);
  }

  // Sort by dependencies if required
  const sortedSubtasks = config.respectDependencies ? 
    topologicalSort(subtasks) : subtasks;

  const batches: Subtask[][] = [];
  const oversizedTasks: Subtask[] = [];
  let currentBatch: Subtask[] = [];
  let currentBatchTokens = 0;
  let totalTokens = 0;
  let dependencyViolations = 0;

  for (const subtask of sortedSubtasks) {
    const subtaskTokens = estimateTokenCount(subtask);
    totalTokens += subtaskTokens;

    // Check if task is oversized for any batch
    if (subtaskTokens > config.maxTokensPerBatch) {
      oversizedTasks.push(subtask);
      continue;
    }

    // Check batch constraints
    const wouldExceedSize = currentBatch.length >= config.maxBatchSize;
    const wouldExceedTokens = currentBatchTokens + subtaskTokens > config.maxTokensPerBatch;
    const wouldViolateDependencies = config.respectDependencies && 
      !canSubtaskBeAddedToBatch(subtask, currentBatch, batches);

    if (wouldViolateDependencies) {
      dependencyViolations++;
    }

    if (wouldExceedSize || wouldExceedTokens || 
        (config.respectDependencies && wouldViolateDependencies)) {
      // Finalize current batch
      if (currentBatch.length > 0) {
        batches.push([...currentBatch]);
      }
      
      // Start new batch
      currentBatch = [subtask];
      currentBatchTokens = subtaskTokens;
    } else {
      currentBatch.push(subtask);
      currentBatchTokens += subtaskTokens;
    }
  }

  // Add final batch
  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  // Balance workloads if requested
  const finalBatches = config.balanceWorkloads ? 
    balanceWorkloadAcrossBatches(batches) : batches;

  // Calculate statistics
  const batchStatistics = {
    averageBatchSize: finalBatches.length > 0 ? 
      finalBatches.reduce((sum, batch) => sum + batch.length, 0) / finalBatches.length : 0,
    averageTokensPerBatch: finalBatches.length > 0 ?
      finalBatches.reduce((sum, batch) => sum + estimateBatchTokens(batch), 0) / finalBatches.length : 0,
    maxTokensInBatch: Math.max(...finalBatches.map(batch => estimateBatchTokens(batch)), 0),
    dependencyViolations
  };

  return {
    batches: finalBatches,
    oversizedTasks,
    totalTokenCount: totalTokens,
    batchStatistics
  };
}

/**
 * Groups subtasks into batches based on specified range and dependencies (legacy)
 */
export function batchSubtasks(subtasks: Subtask[], range: number): Subtask[][] {
  // First, sort subtasks by dependencies to respect execution order
  const sortedSubtasks = topologicalSort(subtasks);
  
  const batches: Subtask[][] = [];
  let currentBatch: Subtask[] = [];
  
  for (const subtask of sortedSubtasks) {
    // Check if adding this subtask would exceed the batch size
    if (currentBatch.length >= range) {
      // Start a new batch
      batches.push([...currentBatch]);
      currentBatch = [subtask];
    } else {
      // Check if subtask dependencies are satisfied by previous batches
      const canAddToBatch = canSubtaskBeAddedToBatch(subtask, currentBatch, batches);
      
      if (canAddToBatch) {
        currentBatch.push(subtask);
      } else {
        // Must start a new batch due to dependencies
        if (currentBatch.length > 0) {
          batches.push([...currentBatch]);
        }
        currentBatch = [subtask];
      }
    }
  }
  
  // Add the final batch if it has any subtasks
  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }
  
  return batches;
}

/**
 * Plans dispatch strategy for subtask batches to agents
 */
export function planDispatch(
  subtaskBatches: Subtask[][], 
  strategy: 'parallel' | 'serial', 
  agents: Agent[]
): ExecutionPlan {
  const assignedAgents: Record<string, string> = {};
  const dependencyTree = buildDependencyTree(
    subtaskBatches.flat()
  );
  
  let estimatedTotalDuration = 0;
  
  if (strategy === 'parallel') {
    // Assign different agents to each batch for parallel execution
    subtaskBatches.forEach((batch, index) => {
      const batchId = `batch_${index}`;
      const agentIndex = index % agents.length;
      const assignedAgent = agents[agentIndex];
      
      if (assignedAgent) {
        assignedAgents[batchId] = assignedAgent.id;
      }
      
      // For parallel execution, duration is the maximum batch duration
      const batchDuration = calculateBatchDuration(batch);
      estimatedTotalDuration = Math.max(estimatedTotalDuration, batchDuration);
    });
  } else {
    // Serial execution: same agent processes all batches sequentially
    const primaryAgent = agents[0];
    
    subtaskBatches.forEach((batch, index) => {
      const batchId = `batch_${index}`;
      assignedAgents[batchId] = primaryAgent?.id || 'default_agent';
      
      // For serial execution, add up all batch durations
      estimatedTotalDuration += calculateBatchDuration(batch);
    });
  }
  
  return {
    orderedBatches: subtaskBatches,
    assignedAgents,
    dependencyTree,
    estimatedTotalDuration
  };
}

/**
 * Detects dependency cycles in subtask graph
 */
export function detectDependencyCycles(subtasks: Subtask[]): CycleDetectionResult {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const subtaskMap = new Map(subtasks.map(task => [task.id, task]));
  const affectedSubtasks = new Set<string>();
  
  function dfs(subtaskId: string, path: string[]): void {
    if (recursionStack.has(subtaskId)) {
      // Cycle detected - extract the cycle
      const cycleStart = path.indexOf(subtaskId);
      const cycle = path.slice(cycleStart).concat([subtaskId]);
      cycles.push(cycle);
      cycle.forEach(id => affectedSubtasks.add(id));
      return;
    }
    
    if (visited.has(subtaskId)) {
      return;
    }
    
    const subtask = subtaskMap.get(subtaskId);
    if (!subtask) {
      return;
    }
    
    visited.add(subtaskId);
    recursionStack.add(subtaskId);
    path.push(subtaskId);
    
    // Visit all dependencies
    for (const dependency of subtask.dependencies) {
      dfs(dependency.subtaskId, [...path]);
    }
    
    recursionStack.delete(subtaskId);
    path.pop();
  }
  
  // Check all subtasks for cycles
  for (const subtask of subtasks) {
    if (!visited.has(subtask.id)) {
      dfs(subtask.id, []);
    }
  }
  
  const suggestions = generateCycleResolutionSuggestions(cycles, subtaskMap);
  
  return {
    hasCycles: cycles.length > 0,
    cycles,
    affectedSubtasks: Array.from(affectedSubtasks),
    suggestions
  };
}

/**
 * Resolves dependency cycles by breaking least critical dependencies
 */
function resolveDependencyCycles(subtasks: Subtask[], cycleResult: CycleDetectionResult): Subtask[] {
  const resolvedSubtasks = subtasks.map(task => ({ ...task, dependencies: [...task.dependencies] }));
  const subtaskMap = new Map(resolvedSubtasks.map(task => [task.id, task]));
  
  for (const cycle of cycleResult.cycles) {
    // Find the least critical dependency to break
    let minCriticality = Infinity;
    let targetDepToBreak: { from: string; to: string } | null = null;
    
    for (let i = 0; i < cycle.length - 1; i++) {
      const fromId = cycle[i];
      const toId = cycle[i + 1];
      const fromTask = subtaskMap.get(fromId);
      
      if (fromTask) {
        const dependency = fromTask.dependencies.find(dep => dep.subtaskId === toId);
        if (dependency) {
          const criticality = getDependencyCriticality(dependency);
          if (criticality < minCriticality) {
            minCriticality = criticality;
            targetDepToBreak = { from: fromId, to: toId };
          }
        }
      }
    }
    
    // Break the least critical dependency
    if (targetDepToBreak) {
      const task = subtaskMap.get(targetDepToBreak.from);
      if (task) {
        task.dependencies = task.dependencies.filter(
          dep => dep.subtaskId !== targetDepToBreak!.to
        );
      }
    }
  }
  
  return resolvedSubtasks;
}

/**
 * Enhanced topological sort with cycle handling
 */
function topologicalSort(subtasks: Subtask[]): Subtask[] {
  // First detect cycles
  const cycleResult = detectDependencyCycles(subtasks);
  let workingSubtasks = subtasks;
  
  if (cycleResult.hasCycles) {
    workingSubtasks = resolveDependencyCycles(subtasks, cycleResult);
  }
  
  const result: Subtask[] = [];
  const visited = new Set<string>();
  const subtaskMap = new Map(workingSubtasks.map(task => [task.id, task]));
  
  function dfs(subtaskId: string): void {
    if (visited.has(subtaskId)) {
      return;
    }
    
    const subtask = subtaskMap.get(subtaskId);
    if (!subtask) {
      return;
    }
    
    visited.add(subtaskId);
    
    // Visit all dependencies first
    for (const dependency of subtask.dependencies) {
      dfs(dependency.subtaskId);
    }
    
    result.push(subtask);
  }
  
  // Start DFS from all subtasks
  for (const subtask of workingSubtasks) {
    if (!visited.has(subtask.id)) {
      dfs(subtask.id);
    }
  }
  
  return result;
}

/**
 * Checks if a subtask can be added to the current batch without violating dependencies
 */
function canSubtaskBeAddedToBatch(
  subtask: Subtask, 
  currentBatch: Subtask[], 
  completedBatches: Subtask[][]
): boolean {
  // Get all subtasks that are already processed (in current batch or completed batches)
  const processedSubtasks = new Set<string>();
  
  // Add completed batches
  for (const batch of completedBatches) {
    for (const task of batch) {
      processedSubtasks.add(task.id);
    }
  }
  
  // Add current batch
  for (const task of currentBatch) {
    processedSubtasks.add(task.id);
  }
  
  // Check if all blocking dependencies are satisfied
  for (const dependency of subtask.dependencies) {
    if (dependency.type === 'BLOCKING' && !processedSubtasks.has(dependency.subtaskId)) {
      return false;
    }
  }
  
  return true;
}

/**
 * Builds a dependency tree from subtasks
 */
function buildDependencyTree(subtasks: Subtask[]): DependencyNode[] {
  const nodes: DependencyNode[] = [];
  const nodeMap = new Map<string, DependencyNode>();
  
  // Create nodes for all subtasks
  for (const subtask of subtasks) {
    const node: DependencyNode = {
      subtaskId: subtask.id,
      dependencies: subtask.dependencies.map(dep => dep.subtaskId),
      dependents: [],
      level: 0
    };
    
    nodes.push(node);
    nodeMap.set(subtask.id, node);
  }
  
  // Build dependent relationships and calculate levels
  for (const node of nodes) {
    for (const depId of node.dependencies) {
      const depNode = nodeMap.get(depId);
      if (depNode) {
        depNode.dependents.push(node.subtaskId);
      }
    }
  }
  
  // Calculate execution levels (topological levels)
  const visited = new Set<string>();
  
  function calculateLevel(nodeId: string): number {
    if (visited.has(nodeId)) {
      return nodeMap.get(nodeId)?.level || 0;
    }
    
    const node = nodeMap.get(nodeId);
    if (!node) {
      return 0;
    }
    
    visited.add(nodeId);
    
    // Level is 1 + max level of dependencies
    let maxDepLevel = -1;
    for (const depId of node.dependencies) {
      maxDepLevel = Math.max(maxDepLevel, calculateLevel(depId));
    }
    
    node.level = maxDepLevel + 1;
    return node.level;
  }
  
  // Calculate levels for all nodes
  for (const node of nodes) {
    if (!visited.has(node.subtaskId)) {
      calculateLevel(node.subtaskId);
    }
  }
  
  return nodes;
}

/**
 * Calculates estimated duration for a batch of subtasks
 */
function calculateBatchDuration(batch: Subtask[]): number {
  return batch.reduce((total, subtask) => {
    return total + (subtask.estimatedDuration || 20);
  }, 0);
}

/**
 * Validates that batching respects dependency constraints
 */
export function validateBatching(batches: Subtask[][]): boolean {
  const processedSubtasks = new Set<string>();
  
  for (const batch of batches) {
    // Check that all dependencies for tasks in this batch have been processed
    for (const subtask of batch) {
      for (const dependency of subtask.dependencies) {
        if (dependency.type === 'BLOCKING' && !processedSubtasks.has(dependency.subtaskId)) {
          return false; // Dependency violation found
        }
      }
    }
    
    // Mark all tasks in this batch as processed
    for (const subtask of batch) {
      processedSubtasks.add(subtask.id);
    }
  }
  
  return true; // All batches respect dependencies
}

/**
 * Estimates token count for a subtask
 */
function estimateTokenCount(subtask: Subtask): number {
  // Rough estimation: 1 token ≈ 4 characters for English text
  const titleTokens = Math.ceil(subtask.title.length / 4);
  const descriptionTokens = Math.ceil(subtask.description.length / 4);
  const metadataTokens = subtask.metadata ? 
    Math.ceil(JSON.stringify(subtask.metadata).length / 4) : 0;
  
  return titleTokens + descriptionTokens + metadataTokens + 50; // +50 for prompt formatting
}

/**
 * Estimates total token count for a batch
 */
function estimateBatchTokens(batch: Subtask[]): number {
  return batch.reduce((total, subtask) => total + estimateTokenCount(subtask), 0);
}

/**
 * Balances workload across batches
 */
function balanceWorkloadAcrossBatches(batches: Subtask[][]): Subtask[][] {
  if (batches.length <= 1) {
    return batches;
  }
  
  // Calculate current workloads
  const batchWorkloads = batches.map(batch => ({
    batch,
    duration: calculateBatchDuration(batch),
    tokens: estimateBatchTokens(batch)
  }));
  
  // Sort by workload (duration + token complexity)
  batchWorkloads.sort((a, b) => {
    const aLoad = a.duration + (a.tokens * 0.1); // Weight tokens less than duration
    const bLoad = b.duration + (b.tokens * 0.1);
    return bLoad - aLoad;
  });
  
  // Redistribute tasks from heavily loaded batches to lighter ones
  const maxIterations = 10;
  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const heaviest = batchWorkloads[0];
    const lightest = batchWorkloads[batchWorkloads.length - 1];
    
    const heavyLoad = heaviest.duration + (heaviest.tokens * 0.1);
    const lightLoad = lightest.duration + (lightest.tokens * 0.1);
    
    // If difference is acceptable, stop
    if (heavyLoad - lightLoad < heavyLoad * 0.2) {
      break;
    }
    
    // Move a task from heaviest to lightest if possible
    if (heaviest.batch.length > 1) {
      const taskToMove = heaviest.batch.pop();
      if (taskToMove) {
        lightest.batch.push(taskToMove);
        
        // Recalculate workloads
        heaviest.duration = calculateBatchDuration(heaviest.batch);
        heaviest.tokens = estimateBatchTokens(heaviest.batch);
        lightest.duration = calculateBatchDuration(lightest.batch);
        lightest.tokens = estimateBatchTokens(lightest.batch);
        
        // Re-sort
        batchWorkloads.sort((a, b) => {
          const aLoad = a.duration + (a.tokens * 0.1);
          const bLoad = b.duration + (b.tokens * 0.1);
          return bLoad - aLoad;
        });
      }
    } else {
      break; // Can't redistribute further
    }
  }
  
  return batchWorkloads.map(item => item.batch).filter(batch => batch.length > 0);
}

/**
 * Gets dependency criticality score (lower = less critical, easier to break)
 */
function getDependencyCriticality(dependency: SubtaskDependency): number {
  let score = 0;
  
  switch (dependency.type) {
    case 'BLOCKING':
      score += 10;
      break;
    case 'SOFT':
      score += 3;
      break;
    case 'REFERENCE':
      score += 1;
      break;
    default:
      score += 5;
  }
  
  // Add priority-based scoring
  switch (dependency.priority) {
    case 'HIGH':
      score += 5;
      break;
    case 'MEDIUM':
      score += 3;
      break;
    case 'LOW':
      score += 1;
      break;
  }
  
  return score;
}

/**
 * Generates suggestions for resolving dependency cycles
 */
function generateCycleResolutionSuggestions(
  cycles: string[][], 
  subtaskMap: Map<string, Subtask>
): string[] {
  const suggestions: string[] = [];
  
  for (let i = 0; i < cycles.length; i++) {
    const cycle = cycles[i];
    suggestions.push(`Cycle ${i + 1}: ${cycle.join(' → ')}`);
    
    // Suggest which dependency to break
    let minCriticality = Infinity;
    let suggestedBreak: { from: string; to: string } | null = null;
    
    for (let j = 0; j < cycle.length - 1; j++) {
      const fromId = cycle[j];
      const toId = cycle[j + 1];
      const fromTask = subtaskMap.get(fromId);
      
      if (fromTask) {
        const dependency = fromTask.dependencies.find(dep => dep.subtaskId === toId);
        if (dependency) {
          const criticality = getDependencyCriticality(dependency);
          if (criticality < minCriticality) {
            minCriticality = criticality;
            suggestedBreak = { from: fromId, to: toId };
          }
        }
      }
    }
    
    if (suggestedBreak) {
      suggestions.push(`  → Suggest breaking dependency: ${suggestedBreak.from} → ${suggestedBreak.to}`);
    }
  }
  
  return suggestions;
}

/**
 * Optimizes batch distribution for better load balancing
 */
export function optimizeBatches(
  batches: Subtask[][], 
  agents: Agent[], 
  strategy: 'parallel' | 'serial'
): Subtask[][] {
  if (strategy === 'serial' || agents.length <= 1) {
    return batches;
  }
  
  // For parallel execution, balance workload across agents
  const optimizedBatches: Subtask[][] = [];
  const agentWorkloads: number[] = new Array(agents.length).fill(0);
  
  for (const batch of batches) {
    const batchDuration = calculateBatchDuration(batch);
    const batchTokens = estimateBatchTokens(batch);
    const batchLoad = batchDuration + (batchTokens * 0.1);
    
    // Find agent with minimum current workload
    let minWorkloadIndex = 0;
    for (let i = 1; i < agentWorkloads.length; i++) {
      if (agentWorkloads[i] < agentWorkloads[minWorkloadIndex]) {
        minWorkloadIndex = i;
      }
    }
    
    // Assign batch to agent with minimum workload
    agentWorkloads[minWorkloadIndex] += batchLoad;
    
    // Ensure we have enough batches for all agents
    while (optimizedBatches.length <= minWorkloadIndex) {
      optimizedBatches.push([]);
    }
    
    optimizedBatches[minWorkloadIndex].push(...batch);
  }
  
  // Remove empty batches and apply final balancing
  const nonEmptyBatches = optimizedBatches.filter(batch => batch.length > 0);
  return balanceWorkloadAcrossBatches(nonEmptyBatches);
}