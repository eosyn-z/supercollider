"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentMatcher = void 0;
const agentRegistry_1 = require("../types/agentRegistry");
const subtaskSchema_1 = require("../types/subtaskSchema");
class AgentMatcher {
    match(subtask, agents, config) {
        const availableAgents = config.requiredAvailability
            ? agents.filter(agent => agent.availability)
            : agents;
        const matches = [];
        for (const agent of availableAgents) {
            const matchScore = this.calculateMatchScore(agent, subtask, config);
            if (config.preferredCostCeiling) {
                const estimatedCost = this.estimateCost(agent, subtask);
                if (estimatedCost > config.preferredCostCeiling) {
                    continue;
                }
            }
            const match = {
                agentId: agent.id,
                matchScore,
                notes: this.generateMatchNotes(agent, subtask, matchScore),
                estimatedCost: this.estimateCost(agent, subtask),
                estimatedDuration: this.estimateDuration(agent, subtask)
            };
            matches.push(match);
        }
        matches.sort((a, b) => b.matchScore - a.matchScore);
        return this.applyFallbackRules(matches, config.fallbackRules, subtask, agents);
    }
    assign(subtasks, agents, config) {
        const assignments = [];
        const assignedAgents = new Set();
        const sortedSubtasks = [...subtasks].sort((a, b) => {
            const priorityOrder = { 'CRITICAL': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
            return priorityOrder[b.priority] -
                priorityOrder[a.priority];
        });
        for (const subtask of sortedSubtasks) {
            const availableAgents = agents.filter(agent => !assignedAgents.has(agent.id));
            if (availableAgents.length === 0) {
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
            }
            else {
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
    calculateMatchScore(agent, subtask, config) {
        const weights = config.priorityWeights;
        let totalScore = 0;
        const capabilityScore = this.calculateCapabilityMatch(agent, subtask);
        totalScore += capabilityScore * weights.capability;
        const proficiencyScore = this.calculateProficiencyScore(agent, subtask);
        totalScore += proficiencyScore * weights.proficiency;
        const costScore = this.calculateCostScore(agent, subtask);
        totalScore += costScore * weights.cost;
        const availabilityScore = agent.availability ? 100 : 0;
        totalScore += availabilityScore * weights.availability;
        const totalWeight = weights.capability + weights.proficiency + weights.cost + weights.availability;
        return Math.round(totalScore / totalWeight);
    }
    calculateCapabilityMatch(agent, subtask) {
        const relevantCapabilities = agent.capabilities.filter(cap => this.isCapabilityRelevant(cap, subtask.type));
        if (relevantCapabilities.length === 0) {
            return 0;
        }
        const baseScore = Math.min(relevantCapabilities.length * 25, 100);
        const hasDirectMatch = relevantCapabilities.some(cap => cap.category === this.mapSubtaskTypeToCapabilityCategory(subtask.type));
        return hasDirectMatch ? Math.min(baseScore + 20, 100) : baseScore;
    }
    calculateProficiencyScore(agent, subtask) {
        const relevantCapabilities = agent.capabilities.filter(cap => this.isCapabilityRelevant(cap, subtask.type));
        if (relevantCapabilities.length === 0) {
            return 0;
        }
        const proficiencyScores = relevantCapabilities.map(cap => {
            switch (cap.proficiency) {
                case agentRegistry_1.ProficiencyLevel.EXPERT: return 100;
                case agentRegistry_1.ProficiencyLevel.ADVANCED: return 80;
                case agentRegistry_1.ProficiencyLevel.INTERMEDIATE: return 60;
                case agentRegistry_1.ProficiencyLevel.BEGINNER: return 40;
                default: return 0;
            }
        });
        return proficiencyScores.reduce((sum, score) => sum + score, 0) / proficiencyScores.length;
    }
    calculateCostScore(agent, subtask) {
        if (!agent.costPerMinute) {
            return 100;
        }
        const estimatedCost = this.estimateCost(agent, subtask);
        const maxCost = 50;
        return Math.max(0, Math.round(100 - (estimatedCost / maxCost) * 100));
    }
    estimateCost(agent, subtask) {
        if (!agent.costPerMinute) {
            return 0;
        }
        const estimatedDuration = this.estimateDuration(agent, subtask);
        return (estimatedDuration / 60) * agent.costPerMinute;
    }
    estimateDuration(agent, subtask) {
        const baseDuration = subtask.estimatedDuration || this.getDefaultDuration(subtask.type);
        if (agent.performanceMetrics) {
            const performanceMultiplier = this.calculatePerformanceMultiplier(agent);
            return Math.round(baseDuration * performanceMultiplier);
        }
        return baseDuration;
    }
    calculatePerformanceMultiplier(agent) {
        const metrics = agent.performanceMetrics;
        const qualityFactor = metrics.qualityScore / 100;
        const successFactor = metrics.successRate / 100;
        return Math.max(0.5, 1.5 - (qualityFactor * 0.3 + successFactor * 0.2));
    }
    getDefaultDuration(type) {
        const defaultDurations = {
            [subtaskSchema_1.SubtaskType.RESEARCH]: 20,
            [subtaskSchema_1.SubtaskType.ANALYSIS]: 15,
            [subtaskSchema_1.SubtaskType.CREATION]: 30,
            [subtaskSchema_1.SubtaskType.VALIDATION]: 10
        };
        return defaultDurations[type] || 20;
    }
    isCapabilityRelevant(capability, subtaskType) {
        const relevantCategory = this.mapSubtaskTypeToCapabilityCategory(subtaskType);
        return capability.category === relevantCategory;
    }
    mapSubtaskTypeToCapabilityCategory(type) {
        const mapping = {
            [subtaskSchema_1.SubtaskType.RESEARCH]: agentRegistry_1.CapabilityCategory.RESEARCH,
            [subtaskSchema_1.SubtaskType.ANALYSIS]: agentRegistry_1.CapabilityCategory.ANALYSIS,
            [subtaskSchema_1.SubtaskType.CREATION]: agentRegistry_1.CapabilityCategory.CREATION,
            [subtaskSchema_1.SubtaskType.VALIDATION]: agentRegistry_1.CapabilityCategory.VALIDATION
        };
        return mapping[type];
    }
    generateMatchNotes(agent, subtask, score) {
        const relevantCaps = agent.capabilities.filter(cap => this.isCapabilityRelevant(cap, subtask.type));
        const capabilityNames = relevantCaps.map(cap => cap.name).join(', ');
        const proficiencyLevels = relevantCaps.map(cap => cap.proficiency).join(', ');
        return `Score: ${score}/100. Relevant capabilities: ${capabilityNames} (${proficiencyLevels}). ` +
            `Availability: ${agent.availability ? 'Available' : 'Unavailable'}.`;
    }
    applyFallbackRules(matches, fallbackRules, subtask, allAgents) {
        if (matches.length === 0) {
            const noMatchRule = fallbackRules.find(rule => rule.condition === 'no_matches');
            if (noMatchRule && noMatchRule.action === 'assign_best_available') {
                const availableAgent = allAgents.find(agent => agent.availability);
                if (availableAgent) {
                    return [{
                            agentId: availableAgent.id,
                            matchScore: 30,
                            notes: 'Fallback assignment - no ideal matches found',
                            estimatedCost: this.estimateCost(availableAgent, subtask),
                            estimatedDuration: this.estimateDuration(availableAgent, subtask)
                        }];
                }
            }
        }
        const highQualityMatches = matches.filter(match => match.matchScore >= 70);
        if (highQualityMatches.length === 0 && matches.length > 0) {
            const lowQualityRule = fallbackRules.find(rule => rule.condition === 'low_quality_matches');
            if (lowQualityRule && lowQualityRule.action === 'assign_best_available') {
                return [matches[0]];
            }
        }
        return matches;
    }
}
exports.AgentMatcher = AgentMatcher;
//# sourceMappingURL=agentMatcher.js.map