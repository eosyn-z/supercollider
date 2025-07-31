import { Agent, AgentMatch, AgentAssignment } from '../types/agentRegistry';
import { Subtask } from '../types/subtaskSchema';
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
export declare class AgentMatcher {
    match(subtask: Subtask, agents: Agent[], config: MatchingConfig): AgentMatch[];
    assign(subtasks: Subtask[], agents: Agent[], config: MatchingConfig): AgentAssignment[];
    private calculateMatchScore;
    private calculateCapabilityMatch;
    private calculateProficiencyScore;
    private calculateCostScore;
    private estimateCost;
    private estimateDuration;
    private calculatePerformanceMultiplier;
    private getDefaultDuration;
    private isCapabilityRelevant;
    private mapSubtaskTypeToCapabilityCategory;
    private generateMatchNotes;
    private applyFallbackRules;
}
//# sourceMappingURL=agentMatcher.d.ts.map