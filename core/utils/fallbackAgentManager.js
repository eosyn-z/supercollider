"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FallbackAgentManager = void 0;
class FallbackAgentManager {
    constructor(apiKeyManager, config = {}) {
        this.agentHealthMap = new Map();
        this.loadBalancingMetrics = new Map();
        this.healthCheckTimers = new Map();
        this.performanceHistory = new Map();
        this.apiKeyManager = apiKeyManager;
        this.config = {
            enabled: true,
            maxFallbackDepth: 3,
            fallbackDelay: 5000,
            healthCheckInterval: 30000,
            circuitBreakerThreshold: 5,
            circuitBreakerTimeout: 300000,
            loadBalancingStrategy: 'capability-based',
            enableAutoRecovery: true,
            performanceWeighting: true,
            ...config
        };
    }
    async registerAgents(agents) {
        for (const agent of agents) {
            await this.registerAgent(agent);
        }
    }
    async registerAgent(agent) {
        const health = {
            agentId: agent.id,
            status: 'healthy',
            lastHealthCheck: new Date(),
            consecutiveFailures: 0,
            averageResponseTime: 0,
            successRate: 1.0,
            currentLoad: 0,
            capabilities: new Set(agent.capabilities)
        };
        this.agentHealthMap.set(agent.id, health);
        const metrics = {
            agentId: agent.id,
            currentSubtasks: 0,
            queuedSubtasks: 0,
            averageExecutionTime: 0,
            cpuUtilization: 0,
            memoryUtilization: 0,
            throughput: 0,
            lastUpdated: new Date()
        };
        this.loadBalancingMetrics.set(agent.id, metrics);
        this.startHealthChecking(agent);
        await this.performHealthCheck(agent);
    }
    async selectAgent(subtask, availableAgents, excludeAgents = []) {
        const viableAgents = availableAgents.filter(agent => {
            if (excludeAgents.includes(agent.id))
                return false;
            const health = this.agentHealthMap.get(agent.id);
            if (!health)
                return false;
            if (health.status === 'circuit-open') {
                if (health.circuitBreakerOpenUntil && new Date() > health.circuitBreakerOpenUntil) {
                    health.status = 'degraded';
                    health.consecutiveFailures = 0;
                }
                else {
                    return false;
                }
            }
            return health.status !== 'failed';
        });
        if (viableAgents.length === 0) {
            return null;
        }
        switch (this.config.loadBalancingStrategy) {
            case 'round-robin':
                return this.selectRoundRobin(viableAgents);
            case 'least-loaded':
                return this.selectLeastLoaded(viableAgents);
            case 'capability-based':
                return this.selectCapabilityBased(subtask, viableAgents);
            case 'performance-based':
                return this.selectPerformanceBased(subtask, viableAgents);
            default:
                return viableAgents[0];
        }
    }
    async createFallbackPlan(subtask, originalAgent, availableAgents) {
        const fallbackChain = [];
        const reasoning = [];
        const alternatives = [];
        const capableAgents = availableAgents.filter(agent => agent.capabilities.includes(subtask.type) && agent.id !== originalAgent.id);
        const scoredAgents = await Promise.all(capableAgents.map(agent => this.scoreAgentCompatibility(agent, subtask, originalAgent)));
        scoredAgents.sort((a, b) => b.compatibility - a.compatibility);
        let depth = 0;
        for (const scoredAgent of scoredAgents) {
            if (depth >= this.config.maxFallbackDepth)
                break;
            const health = this.agentHealthMap.get(scoredAgent.agent.id);
            if (health?.status === 'healthy' || health?.status === 'degraded') {
                fallbackChain.push(scoredAgent.agent);
                reasoning.push(`Fallback ${depth + 1}: ${scoredAgent.agent.id} - ${scoredAgent.reasoning}`);
                depth++;
            }
            alternatives.push({
                agent: scoredAgent.agent,
                compatibility: scoredAgent.compatibility,
                confidence: scoredAgent.confidence,
                estimatedPerformance: scoredAgent.estimatedPerformance,
                reasoning: scoredAgent.reasoning
            });
        }
        const riskAssessment = this.assessFallbackRisk(fallbackChain, subtask);
        const estimatedDelayMinutes = fallbackChain.length * (this.config.fallbackDelay / 60000);
        return {
            originalAgent,
            fallbackChain,
            reasoning,
            estimatedDelayMinutes,
            riskAssessment,
            alternatives
        };
    }
    async executeFallback(subtask, failedAgent, error, availableAgents) {
        await this.recordAgentFailure(failedAgent.id, error);
        const fallbackPlan = await this.createFallbackPlan(subtask, failedAgent, availableAgents);
        if (fallbackPlan.fallbackChain.length === 0) {
            return null;
        }
        if (this.config.fallbackDelay > 0) {
            await this.sleep(this.config.fallbackDelay);
        }
        return fallbackPlan.fallbackChain[0];
    }
    async recordSuccess(agentId, executionResult) {
        const health = this.agentHealthMap.get(agentId);
        const metrics = this.loadBalancingMetrics.get(agentId);
        if (health && metrics) {
            health.consecutiveFailures = 0;
            health.lastHealthCheck = new Date();
            health.status = 'healthy';
            health.averageResponseTime = this.updateAverageResponseTime(health.averageResponseTime, executionResult.executionTime);
            const performanceHistory = this.performanceHistory.get(agentId) || [];
            performanceHistory.push(1);
            if (performanceHistory.length > 100) {
                performanceHistory.shift();
            }
            this.performanceHistory.set(agentId, performanceHistory);
            health.successRate = performanceHistory.reduce((a, b) => a + b, 0) / performanceHistory.length;
            metrics.currentSubtasks = Math.max(0, metrics.currentSubtasks - 1);
            metrics.averageExecutionTime = this.updateAverageResponseTime(metrics.averageExecutionTime, executionResult.executionTime);
            metrics.throughput = this.calculateThroughput(agentId);
            metrics.lastUpdated = new Date();
            if (health.circuitBreakerOpenUntil) {
                delete health.circuitBreakerOpenUntil;
            }
        }
    }
    async recordAgentFailure(agentId, error) {
        const health = this.agentHealthMap.get(agentId);
        if (!health)
            return;
        health.consecutiveFailures++;
        health.lastHealthCheck = new Date();
        const performanceHistory = this.performanceHistory.get(agentId) || [];
        performanceHistory.push(0);
        if (performanceHistory.length > 100) {
            performanceHistory.shift();
        }
        this.performanceHistory.set(agentId, performanceHistory);
        health.successRate = performanceHistory.reduce((a, b) => a + b, 0) / performanceHistory.length;
        if (health.consecutiveFailures >= this.config.circuitBreakerThreshold) {
            health.status = 'circuit-open';
            health.circuitBreakerOpenUntil = new Date(Date.now() + this.config.circuitBreakerTimeout);
        }
        else if (health.consecutiveFailures >= 3) {
            health.status = 'degraded';
        }
        const metrics = this.loadBalancingMetrics.get(agentId);
        if (metrics) {
            metrics.currentSubtasks = Math.max(0, metrics.currentSubtasks - 1);
            metrics.lastUpdated = new Date();
        }
    }
    getAgentHealthStatus() {
        return new Map(this.agentHealthMap);
    }
    getLoadBalancingMetrics() {
        return new Map(this.loadBalancingMetrics);
    }
    async forceHealthCheck() {
        const results = new Map();
        for (const [agentId, health] of this.agentHealthMap.entries()) {
            try {
                const agent = { id: agentId };
                const isHealthy = await this.performHealthCheck(agent);
                results.set(agentId, isHealthy);
            }
            catch (error) {
                results.set(agentId, false);
            }
        }
        return results;
    }
    selectRoundRobin(agents) {
        const timestamp = Date.now();
        const index = Math.floor(timestamp / 1000) % agents.length;
        return agents[index];
    }
    selectLeastLoaded(agents) {
        let leastLoadedAgent = agents[0];
        let minLoad = Infinity;
        for (const agent of agents) {
            const metrics = this.loadBalancingMetrics.get(agent.id);
            if (metrics) {
                const currentLoad = metrics.currentSubtasks + metrics.queuedSubtasks;
                if (currentLoad < minLoad) {
                    minLoad = currentLoad;
                    leastLoadedAgent = agent;
                }
            }
        }
        return leastLoadedAgent;
    }
    selectCapabilityBased(subtask, agents) {
        const capableAgents = agents.filter(agent => agent.capabilities.includes(subtask.type));
        if (capableAgents.length === 0) {
            return agents[0];
        }
        let bestAgent = capableAgents[0];
        let bestScore = 0;
        for (const agent of capableAgents) {
            const health = this.agentHealthMap.get(agent.id);
            if (health) {
                const score = health.successRate * (health.status === 'healthy' ? 1.0 : 0.5);
                if (score > bestScore) {
                    bestScore = score;
                    bestAgent = agent;
                }
            }
        }
        return bestAgent;
    }
    selectPerformanceBased(subtask, agents) {
        let bestAgent = agents[0];
        let bestScore = 0;
        for (const agent of agents) {
            const health = this.agentHealthMap.get(agent.id);
            const metrics = this.loadBalancingMetrics.get(agent.id);
            if (health && metrics) {
                let score = health.successRate * 0.4;
                score += (1.0 - (metrics.currentSubtasks / 10)) * 0.3;
                score += (1.0 / Math.max(health.averageResponseTime, 1)) * 0.2;
                score += (health.status === 'healthy' ? 1.0 : 0.5) * 0.1;
                if (score > bestScore) {
                    bestScore = score;
                    bestAgent = agent;
                }
            }
        }
        return bestAgent;
    }
    async scoreAgentCompatibility(agent, subtask, originalAgent) {
        const health = this.agentHealthMap.get(agent.id);
        const metrics = this.loadBalancingMetrics.get(agent.id);
        let compatibility = 0;
        let confidence = 0;
        let estimatedPerformance = 0;
        let reasoning = '';
        if (agent.capabilities.includes(subtask.type)) {
            compatibility += 0.4;
            reasoning += 'Supports required task type; ';
        }
        if (health) {
            compatibility += health.successRate * 0.3;
            confidence += health.status === 'healthy' ? 0.5 : 0.2;
            estimatedPerformance += health.successRate * 0.4;
            reasoning += `${(health.successRate * 100).toFixed(1)}% success rate; `;
        }
        if (metrics) {
            const loadFactor = Math.max(0, 1 - (metrics.currentSubtasks / 10));
            compatibility += loadFactor * 0.2;
            estimatedPerformance += loadFactor * 0.3;
            reasoning += `${metrics.currentSubtasks} current tasks; `;
        }
        const originalHealth = this.agentHealthMap.get(originalAgent.id);
        if (originalHealth && health) {
            if (health.averageResponseTime < originalHealth.averageResponseTime) {
                compatibility += 0.1;
                estimatedPerformance += 0.3;
                reasoning += 'Better response time than original; ';
            }
        }
        return {
            agent,
            compatibility: Math.min(1.0, compatibility),
            confidence: Math.min(1.0, confidence),
            estimatedPerformance: Math.min(1.0, estimatedPerformance),
            reasoning: reasoning.trim()
        };
    }
    assessFallbackRisk(fallbackChain, subtask) {
        if (fallbackChain.length === 0)
            return 'high';
        if (fallbackChain.length >= 2)
            return 'low';
        const firstFallback = fallbackChain[0];
        const health = this.agentHealthMap.get(firstFallback.id);
        if (!health || health.status !== 'healthy')
            return 'high';
        if (health.successRate < 0.8)
            return 'medium';
        return 'low';
    }
    startHealthChecking(agent) {
        const timer = setInterval(async () => {
            try {
                await this.performHealthCheck(agent);
            }
            catch (error) {
                console.error(`Health check failed for agent ${agent.id}:`, error);
            }
        }, this.config.healthCheckInterval);
        this.healthCheckTimers.set(agent.id, timer);
    }
    async performHealthCheck(agent) {
        try {
            const isHealthy = Math.random() > 0.1;
            const health = this.agentHealthMap.get(agent.id);
            if (health) {
                health.lastHealthCheck = new Date();
                if (isHealthy) {
                    if (health.status === 'failed') {
                        health.status = 'degraded';
                    }
                    else if (health.status === 'degraded' && health.consecutiveFailures === 0) {
                        health.status = 'healthy';
                    }
                }
                else {
                    health.consecutiveFailures++;
                    if (health.consecutiveFailures >= this.config.circuitBreakerThreshold) {
                        health.status = 'circuit-open';
                        health.circuitBreakerOpenUntil = new Date(Date.now() + this.config.circuitBreakerTimeout);
                    }
                }
            }
            return isHealthy;
        }
        catch (error) {
            return false;
        }
    }
    updateAverageResponseTime(currentAverage, newTime) {
        if (currentAverage === 0)
            return newTime;
        return (currentAverage * 0.8) + (newTime * 0.2);
    }
    calculateThroughput(agentId) {
        const performanceHistory = this.performanceHistory.get(agentId) || [];
        const recentSuccess = performanceHistory.slice(-10).reduce((a, b) => a + b, 0);
        return recentSuccess * 6;
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    cleanup() {
        for (const timer of this.healthCheckTimers.values()) {
            clearInterval(timer);
        }
        this.healthCheckTimers.clear();
    }
}
exports.FallbackAgentManager = FallbackAgentManager;
//# sourceMappingURL=fallbackAgentManager.js.map