/**
 * Agent matching utilities for assigning optimal AI agents to subtasks
 */

import { Agent, AgentMatch, AgentAssignment, Capability, CapabilityCategory, ProficiencyLevel } from '../types/agentRegistry';
import { Subtask, SubtaskType } from '../types/subtaskSchema';

export interface MatchingConfig {
  preferredCostCeiling?: number;
  requiredAvailability: boolean;
  fallbackRules: FallbackRule[];
  priorityWeights: PriorityWeights;
}

export interface FallbackRule {
  condition: 'no_matches' | 'low_quality_matches' | 'high_cost';
  action: 'lower_threshold' | 'expand_search' | 'assign_best_available';
  threshold?: number;
}

export interface PriorityWeights {
  capability: number;
  proficiency: number;
  cost: number;
  availability: number;
}

export class AgentMatcher {
  /**
   * Finds the best agent matches for a subtask
   */
  match(subtask: Subtask, agents: Agent[], config: MatchingConfig): AgentMatch[] {
    const availableAgents = config.requiredAvailability 
      ? agents.filter(agent => agent.availability)
      : agents;
    
    const matches: AgentMatch[] = [];
    
    for (const agent of availableAgents) {
      const matchScore = this.calculateMatchScore(agent, subtask, config);
      
      // Apply cost ceiling filter if specified
      if (config.preferredCostCeiling) {
        const estimatedCost = this.estimateCost(agent, subtask);
        if (estimatedCost > config.preferredCostCeiling) {
          continue;
        }
      }
      
      const match: AgentMatch = {
        agentId: agent.id,
        matchScore,
        notes: this.generateMatchNotes(agent, subtask, matchScore),
        estimatedCost: this.estimateCost(agent, subtask),
        estimatedDuration: this.estimateDuration(agent, subtask)
      };
      
      matches.push(match);
    }
    
    // Sort by match score descending
    matches.sort((a, b) => b.matchScore - a.matchScore);
    
    // Apply fallback rules if needed
    return this.applyFallbackRules(matches, config.fallbackRules, subtask, agents);
  }

  /**
   * Assigns agents to multiple subtasks optimally
   */
  assign(subtasks: Subtask[], agents: Agent[], config: MatchingConfig): AgentAssignment[] {
    const assignments: AgentAssignment[] = [];
    const assignedAgents = new Set<string>();
    
    // Sort subtasks by priority (high priority first)
    const sortedSubtasks = [...subtasks].sort((a, b) => {
      const priorityOrder = { 'CRITICAL': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
      return priorityOrder[b.priority as keyof typeof priorityOrder] - 
             priorityOrder[a.priority as keyof typeof priorityOrder];
    });
    
    for (const subtask of sortedSubtasks) {
      // Filter out already assigned agents for load balancing
      const availableAgents = agents.filter(agent => !assignedAgents.has(agent.id));
      
      if (availableAgents.length === 0) {
        // If all agents are assigned, use all agents (allow multiple assignments)
        const matches = this.match(subtask, agents, config);
        if (matches.length > 0) {
          const bestMatch = matches[0];
          assignments.push({
            agentId: bestMatch.agentId,
            subtaskId: subtask.id,
            assignedAt: new Date(),
            status: 'ASSIGNED'
          });
        }
      } else {
        const matches = this.match(subtask, availableAgents, config);
        if (matches.length > 0) {
          const bestMatch = matches[0];
          assignments.push({
            agentId: bestMatch.agentId,
            subtaskId: subtask.id,
            assignedAt: new Date(),
            status: 'ASSIGNED'
          });
          assignedAgents.add(bestMatch.agentId);
        }
      }
    }
    
    return assignments;
  }

  /**
   * Calculates match score between agent and subtask
   */
  private calculateMatchScore(agent: Agent, subtask: Subtask, config: MatchingConfig): number {
    const weights = config.priorityWeights;
    let totalScore = 0;
    
    // Capability match score
    const capabilityScore = this.calculateCapabilityMatch(agent, subtask);
    totalScore += capabilityScore * weights.capability;
    
    // Proficiency level score
    const proficiencyScore = this.calculateProficiencyScore(agent, subtask);
    totalScore += proficiencyScore * weights.proficiency;
    
    // Cost efficiency score (lower cost = higher score)
    const costScore = this.calculateCostScore(agent, subtask);
    totalScore += costScore * weights.cost;
    
    // Availability score
    const availabilityScore = agent.availability ? 100 : 0;
    totalScore += availabilityScore * weights.availability;
    
    // Normalize to 0-100 scale
    const totalWeight = weights.capability + weights.proficiency + weights.cost + weights.availability;
    return Math.round(totalScore / totalWeight);
  }

  /**
   * Calculates capability match between agent and subtask
   */
  private calculateCapabilityMatch(agent: Agent, subtask: Subtask): number {
    const relevantCapabilities = agent.capabilities.filter(cap => 
      this.isCapabilityRelevant(cap, subtask.type)
    );
    
    if (relevantCapabilities.length === 0) {
      return 0;
    }
    
    // Score based on having relevant capabilities
    const baseScore = Math.min(relevantCapabilities.length * 25, 100);
    
    // Bonus for direct type match
    const hasDirectMatch = relevantCapabilities.some(cap => 
      cap.category === this.mapSubtaskTypeToCapabilityCategory(subtask.type)
    );
    
    return hasDirectMatch ? Math.min(baseScore + 20, 100) : baseScore;
  }

  /**
   * Calculates proficiency score for relevant capabilities
   */
  private calculateProficiencyScore(agent: Agent, subtask: Subtask): number {
    const relevantCapabilities = agent.capabilities.filter(cap => 
      this.isCapabilityRelevant(cap, subtask.type)
    );
    
    if (relevantCapabilities.length === 0) {
      return 0;
    }
    
    const proficiencyScores = relevantCapabilities.map(cap => {
      switch (cap.proficiency) {
        case ProficiencyLevel.EXPERT: return 100;
        case ProficiencyLevel.ADVANCED: return 80;
        case ProficiencyLevel.INTERMEDIATE: return 60;
        case ProficiencyLevel.BEGINNER: return 40;
        default: return 0;
      }
    });
    
    // Return average proficiency score
    return proficiencyScores.reduce((sum, score) => sum + score, 0) / proficiencyScores.length;
  }

  /**
   * Calculates cost efficiency score
   */
  private calculateCostScore(agent: Agent, subtask: Subtask): number {
    if (!agent.costPerMinute) {
      return 100; // No cost information = max score
    }
    
    const estimatedCost = this.estimateCost(agent, subtask);
    
    // Normalize cost to 0-100 scale (lower cost = higher score)
    // Assuming max reasonable cost per subtask is $50
    const maxCost = 50;
    return Math.max(0, Math.round(100 - (estimatedCost / maxCost) * 100));
  }

  /**
   * Estimates cost for agent to complete subtask
   */
  private estimateCost(agent: Agent, subtask: Subtask): number {
    if (!agent.costPerMinute) {
      return 0;
    }
    
    const estimatedDuration = this.estimateDuration(agent, subtask);
    return (estimatedDuration / 60) * agent.costPerMinute;
  }

  /**
   * Estimates duration for agent to complete subtask
   */
  private estimateDuration(agent: Agent, subtask: Subtask): number {
    const baseDuration = subtask.estimatedDuration || this.getDefaultDuration(subtask.type);
    
    // Adjust based on agent performance if available
    if (agent.performanceMetrics) {
      const performanceMultiplier = this.calculatePerformanceMultiplier(agent);
      return Math.round(baseDuration * performanceMultiplier);
    }
    
    return baseDuration;
  }

  /**
   * Calculates performance multiplier based on agent metrics
   */
  private calculatePerformanceMultiplier(agent: Agent): number {
    const metrics = agent.performanceMetrics;
    
    // Better performance = faster completion
    const qualityFactor = metrics.qualityScore / 100;
    const successFactor = metrics.successRate / 100;
    
    // Higher quality and success rate = lower multiplier (faster)
    return Math.max(0.5, 1.5 - (qualityFactor * 0.3 + successFactor * 0.2));
  }

  /**
   * Gets default duration for subtask type
   */
  private getDefaultDuration(type: SubtaskType): number {
    const defaultDurations = {
      [SubtaskType.RESEARCH]: 20,
      [SubtaskType.ANALYSIS]: 15,
      [SubtaskType.CREATION]: 30,
      [SubtaskType.VALIDATION]: 10
    };
    
    return defaultDurations[type] || 20;
  }

  /**
   * Checks if capability is relevant to subtask type
   */
  private isCapabilityRelevant(capability: Capability, subtaskType: SubtaskType): boolean {
    const relevantCategory = this.mapSubtaskTypeToCapabilityCategory(subtaskType);
    return capability.category === relevantCategory;
  }

  /**
   * Maps subtask type to capability category
   */
  private mapSubtaskTypeToCapabilityCategory(type: SubtaskType): CapabilityCategory {
    const mapping = {
      [SubtaskType.RESEARCH]: CapabilityCategory.RESEARCH,
      [SubtaskType.ANALYSIS]: CapabilityCategory.ANALYSIS,
      [SubtaskType.CREATION]: CapabilityCategory.CREATION,
      [SubtaskType.VALIDATION]: CapabilityCategory.VALIDATION
    };
    
    return mapping[type];
  }

  /**
   * Generates descriptive notes for a match
   */
  private generateMatchNotes(agent: Agent, subtask: Subtask, score: number): string {
    const relevantCaps = agent.capabilities.filter(cap => 
      this.isCapabilityRelevant(cap, subtask.type)
    );
    
    const capabilityNames = relevantCaps.map(cap => cap.name).join(', ');
    const proficiencyLevels = relevantCaps.map(cap => cap.proficiency).join(', ');
    
    return `Score: ${score}/100. Relevant capabilities: ${capabilityNames} (${proficiencyLevels}). ` +
           `Availability: ${agent.availability ? 'Available' : 'Unavailable'}.`;
  }

  /**
   * Applies fallback rules to matches
   */
  private applyFallbackRules(
    matches: AgentMatch[], 
    fallbackRules: FallbackRule[], 
    subtask: Subtask, 
    allAgents: Agent[]
  ): AgentMatch[] {
    // If no matches found
    if (matches.length === 0) {
      const noMatchRule = fallbackRules.find(rule => rule.condition === 'no_matches');
      if (noMatchRule && noMatchRule.action === 'assign_best_available') {
        // Find any available agent and create a low-score match
        const availableAgent = allAgents.find(agent => agent.availability);
        if (availableAgent) {
          return [{
            agentId: availableAgent.id,
            matchScore: 30, // Low but acceptable score
            notes: 'Fallback assignment - no ideal matches found',
            estimatedCost: this.estimateCost(availableAgent, subtask),
            estimatedDuration: this.estimateDuration(availableAgent, subtask)
          }];
        }
      }
    }
    
    // If only low quality matches
    const highQualityMatches = matches.filter(match => match.matchScore >= 70);
    if (highQualityMatches.length === 0 && matches.length > 0) {
      const lowQualityRule = fallbackRules.find(rule => rule.condition === 'low_quality_matches');
      if (lowQualityRule && lowQualityRule.action === 'assign_best_available') {
        // Return the best match even if it's low quality
        return [matches[0]];
      }
    }
    
    return matches;
  }
}