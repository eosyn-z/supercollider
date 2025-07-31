import { PromptShred } from '../utils/smartShredder';

interface BatchGroup {
  groupId: string;
  workflowType: string;
  tasks: PromptShred[];
  canExecuteInParallel: boolean;
  sharedContext: string;
  estimatedExecutionTime: number;
  requiredAgentCapabilities: string[];
  batchingReason: string;
  optimizationScore: number;
  contextSimilarity: number;
}

interface BatchingRules {
  maxGroupSize: number;
  minSimilarityThreshold: number;
  maxTokensPerGroup: number;
  allowCrossAtomTypeBatching: boolean;
  prioritizeSimilarContext: boolean;
  timeoutAlignmentThreshold: number;
}

interface OptimizationMetrics {
  totalGroups: number;
  parallelizableGroups: number;
  averageGroupSize: number;
  contextSharingEfficiency: number;
  estimatedTimeReduction: number;
  batchingEfficiency: number;
}

class BatchOptimizer {
  private readonly DEFAULT_RULES: BatchingRules = {
    maxGroupSize: 5,
    minSimilarityThreshold: 0.3,
    maxTokensPerGroup: 10000,
    allowCrossAtomTypeBatching: false,
    prioritizeSimilarContext: true,
    timeoutAlignmentThreshold: 0.5
  };

  constructor(private customRules?: Partial<BatchingRules>) {}

  private getRules(): BatchingRules {
    return { ...this.DEFAULT_RULES, ...this.customRules };
  }

  private generateGroupId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private calculateTokenSimilarity(shred1: PromptShred, shred2: PromptShred): number {
    const words1 = this.extractWords(shred1.content);
    const words2 = this.extractWords(shred2.content);
    
    const intersection = words1.filter(word => words2.includes(word));
    const union = [...new Set([...words1, ...words2])];
    
    return union.length > 0 ? intersection.length / union.length : 0;
  }

  private calculateCapabilitySimilarity(shred1: PromptShred, shred2: PromptShred): number {
    const caps1 = new Set(shred1.agentCapabilities);
    const caps2 = new Set(shred2.agentCapabilities);
    
    const intersection = new Set([...caps1].filter(x => caps2.has(x)));
    const union = new Set([...caps1, ...caps2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  private calculateTimingSimilarity(shred1: PromptShred, shred2: PromptShred): number {
    const time1 = shred1.estimatedTokens * 0.1;
    const time2 = shred2.estimatedTokens * 0.1;
    const maxTime = Math.max(time1, time2);
    const minTime = Math.min(time1, time2);
    
    return maxTime > 0 ? minTime / maxTime : 0;
  }

  private extractWords(text: string): string[] {
    return text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2)
      .filter(word => !this.isStopWord(word));
  }

  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the', 'is', 'at', 'which', 'on', 'and', 'a', 'to', 'are', 'as', 'was', 'were',
      'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'must', 'can', 'shall', 'for', 'of', 'with', 'by'
    ]);
    return stopWords.has(word);
  }

  canBatchTogether(shred1: PromptShred, shred2: PromptShred): boolean {
    const rules = this.getRules();
    
    if (shred1.dependencies.includes(shred2.id) || shred2.dependencies.includes(shred1.id)) {
      return false;
    }

    if (!rules.allowCrossAtomTypeBatching && shred1.atomType !== shred2.atomType) {
      return false;
    }

    if (!shred1.batchable || !shred2.batchable) {
      return false;
    }

    const totalTokens = shred1.estimatedTokens + shred2.estimatedTokens;
    if (totalTokens > rules.maxTokensPerGroup) {
      return false;
    }

    const tokenSimilarity = this.calculateTokenSimilarity(shred1, shred2);
    const capabilitySimilarity = this.calculateCapabilitySimilarity(shred1, shred2);
    const timingSimilarity = this.calculateTimingSimilarity(shred1, shred2);
    
    const overallSimilarity = (tokenSimilarity + capabilitySimilarity + timingSimilarity) / 3;
    
    return overallSimilarity >= rules.minSimilarityThreshold;
  }

  private calculateSharedContext(shreds: PromptShred[]): string {
    if (shreds.length === 0) return '';
    
    const allWords = shreds.flatMap(shred => this.extractWords(shred.content));
    const wordFrequency = new Map<string, number>();
    
    allWords.forEach(word => {
      wordFrequency.set(word, (wordFrequency.get(word) || 0) + 1);
    });
    
    const commonWords = Array.from(wordFrequency.entries())
      .filter(([_, count]) => count >= Math.ceil(shreds.length * 0.5))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
    
    const atomTypes = [...new Set(shreds.map(s => s.atomType))];
    const capabilities = [...new Set(shreds.flatMap(s => s.agentCapabilities))];
    
    return JSON.stringify({
      commonWords,
      atomTypes,
      capabilities,
      totalShreds: shreds.length,
      avgTokens: Math.round(shreds.reduce((sum, s) => sum + s.estimatedTokens, 0) / shreds.length)
    });
  }

  private estimateGroupExecutionTime(group: BatchGroup): number {
    if (group.canExecuteInParallel) {
      return Math.max(...group.tasks.map(task => task.estimatedTokens * 0.1));
    } else {
      return group.tasks.reduce((total, task) => total + (task.estimatedTokens * 0.1), 0);
    }
  }

  private calculateOptimizationScore(group: BatchGroup): number {
    const rules = this.getRules();
    let score = 0;
    
    const contextScore = group.contextSimilarity * 30;
    const sizeScore = Math.min(group.tasks.length / rules.maxGroupSize, 1) * 20;
    const parallelScore = group.canExecuteInParallel ? 25 : 0;
    const atomTypeConsistency = new Set(group.tasks.map(t => t.atomType)).size === 1 ? 15 : 0;
    const tokenEfficiency = Math.min(
      group.tasks.reduce((sum, t) => sum + t.estimatedTokens, 0) / rules.maxTokensPerGroup, 
      1
    ) * 10;
    
    score = contextScore + sizeScore + parallelScore + atomTypeConsistency + tokenEfficiency;
    
    return Math.min(100, Math.max(0, score));
  }

  private calculateContextSimilarity(shreds: PromptShred[]): number {
    if (shreds.length < 2) return 1;
    
    let totalSimilarity = 0;
    let comparisons = 0;
    
    for (let i = 0; i < shreds.length; i++) {
      for (let j = i + 1; j < shreds.length; j++) {
        const tokenSim = this.calculateTokenSimilarity(shreds[i], shreds[j]);
        const capSim = this.calculateCapabilitySimilarity(shreds[i], shreds[j]);
        const timeSim = this.calculateTimingSimilarity(shreds[i], shreds[j]);
        
        totalSimilarity += (tokenSim + capSim + timeSim) / 3;
        comparisons++;
      }
    }
    
    return comparisons > 0 ? totalSimilarity / comparisons : 0;
  }

  identifyBatchGroups(shreds: PromptShred[]): BatchGroup[] {
    const rules = this.getRules();
    const groups: BatchGroup[] = [];
    const processed = new Set<string>();
    
    const batchableShreds = shreds.filter(shred => 
      shred.batchable && shred.dependencies.length === 0
    );
    
    const atomTypeGroups = new Map<string, PromptShred[]>();
    batchableShreds.forEach(shred => {
      if (!atomTypeGroups.has(shred.atomType)) {
        atomTypeGroups.set(shred.atomType, []);
      }
      atomTypeGroups.get(shred.atomType)!.push(shred);
    });
    
    for (const [atomType, typeShreds] of atomTypeGroups) {
      const remainingShreds = typeShreds.filter(s => !processed.has(s.id));
      
      while (remainingShreds.length > 0) {
        const currentGroup: PromptShred[] = [remainingShreds.shift()!];
        processed.add(currentGroup[0].id);
        
        for (let i = remainingShreds.length - 1; i >= 0; i--) {
          const candidate = remainingShreds[i];
          
          if (currentGroup.length >= rules.maxGroupSize) break;
          
          const canBatch = currentGroup.every(groupShred => 
            this.canBatchTogether(groupShred, candidate)
          );
          
          if (canBatch) {
            const totalTokens = currentGroup.reduce((sum, s) => sum + s.estimatedTokens, 0) + candidate.estimatedTokens;
            
            if (totalTokens <= rules.maxTokensPerGroup) {
              currentGroup.push(candidate);
              processed.add(candidate.id);
              remainingShreds.splice(i, 1);
            }
          }
        }
        
        if (currentGroup.length > 1) {
          const contextSimilarity = this.calculateContextSimilarity(currentGroup);
          const sharedContext = this.calculateSharedContext(currentGroup);
          const requiredCapabilities = [...new Set(currentGroup.flatMap(s => s.agentCapabilities))];
          
          const group: BatchGroup = {
            groupId: this.generateGroupId(),
            workflowType: atomType,
            tasks: currentGroup,
            canExecuteInParallel: true,
            sharedContext,
            estimatedExecutionTime: 0,
            requiredAgentCapabilities: requiredCapabilities,
            batchingReason: `Grouped ${currentGroup.length} ${atomType} tasks with ${(contextSimilarity * 100).toFixed(1)}% similarity`,
            optimizationScore: 0,
            contextSimilarity
          };
          
          group.estimatedExecutionTime = this.estimateGroupExecutionTime(group);
          group.optimizationScore = this.calculateOptimizationScore(group);
          
          groups.push(group);
        }
      }
    }
    
    if (rules.allowCrossAtomTypeBatching) {
      const ungroupedShreds = batchableShreds.filter(s => !processed.has(s.id));
      
      while (ungroupedShreds.length > 1) {
        const currentGroup: PromptShred[] = [ungroupedShreds.shift()!];
        
        for (let i = ungroupedShreds.length - 1; i >= 0; i--) {
          const candidate = ungroupedShreds[i];
          
          if (currentGroup.length >= rules.maxGroupSize) break;
          
          const canBatch = currentGroup.every(groupShred => 
            this.canBatchTogether(groupShred, candidate)
          );
          
          if (canBatch) {
            currentGroup.push(candidate);
            ungroupedShreds.splice(i, 1);
          }
        }
        
        if (currentGroup.length > 1) {
          const contextSimilarity = this.calculateContextSimilarity(currentGroup);
          const sharedContext = this.calculateSharedContext(currentGroup);
          const requiredCapabilities = [...new Set(currentGroup.flatMap(s => s.agentCapabilities))];
          
          const group: BatchGroup = {
            groupId: this.generateGroupId(),
            workflowType: 'MIXED',
            tasks: currentGroup,
            canExecuteInParallel: true,
            sharedContext,
            estimatedExecutionTime: 0,
            requiredAgentCapabilities: requiredCapabilities,
            batchingReason: `Cross-type batch of ${currentGroup.length} tasks`,
            optimizationScore: 0,
            contextSimilarity
          };
          
          group.estimatedExecutionTime = this.estimateGroupExecutionTime(group);
          group.optimizationScore = this.calculateOptimizationScore(group);
          
          groups.push(group);
        }
      }
    }
    
    return groups.sort((a, b) => b.optimizationScore - a.optimizationScore);
  }

  calculateOptimizationMetrics(originalShreds: PromptShred[], batchGroups: BatchGroup[]): OptimizationMetrics {
    const originalTime = originalShreds.reduce((sum, shred) => sum + (shred.estimatedTokens * 0.1), 0);
    const batchedTime = batchGroups.reduce((sum, group) => sum + group.estimatedExecutionTime, 0);
    
    const totalGroupedTasks = batchGroups.reduce((sum, group) => sum + group.tasks.length, 0);
    const avgContextSimilarity = batchGroups.length > 0 
      ? batchGroups.reduce((sum, group) => sum + group.contextSimilarity, 0) / batchGroups.length 
      : 0;
    
    return {
      totalGroups: batchGroups.length,
      parallelizableGroups: batchGroups.filter(g => g.canExecuteInParallel).length,
      averageGroupSize: batchGroups.length > 0 ? totalGroupedTasks / batchGroups.length : 0,
      contextSharingEfficiency: avgContextSimilarity,
      estimatedTimeReduction: originalTime > 0 ? ((originalTime - batchedTime) / originalTime) * 100 : 0,
      batchingEfficiency: originalShreds.length > 0 ? (totalGroupedTasks / originalShreds.length) * 100 : 0
    };
  }

  optimizeBatchGroups(groups: BatchGroup[]): BatchGroup[] {
    const rules = this.getRules();
    
    return groups.map(group => {
      if (rules.prioritizeSimilarContext) {
        group.tasks.sort((a, b) => {
          const aSimilarity = this.calculateTokenSimilarity(a, group.tasks[0]);
          const bSimilarity = this.calculateTokenSimilarity(b, group.tasks[0]);
          return bSimilarity - aSimilarity;
        });
      }
      
      const timeVariance = this.calculateTimeVariance(group.tasks);
      if (timeVariance > rules.timeoutAlignmentThreshold) {
        group.canExecuteInParallel = false;
        group.estimatedExecutionTime = this.estimateGroupExecutionTime(group);
        group.batchingReason += ' (Sequential due to timing variance)';
      }
      
      return group;
    });
  }

  private calculateTimeVariance(tasks: PromptShred[]): number {
    if (tasks.length < 2) return 0;
    
    const times = tasks.map(task => task.estimatedTokens * 0.1);
    const mean = times.reduce((sum, time) => sum + time, 0) / times.length;
    const variance = times.reduce((sum, time) => sum + Math.pow(time - mean, 2), 0) / times.length;
    
    return Math.sqrt(variance) / mean;
  }
}

export { BatchOptimizer, BatchGroup, BatchingRules, OptimizationMetrics };