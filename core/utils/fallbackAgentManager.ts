/**
 * Fallback agent management system for handling agent failures and load balancing
 */

import { Agent } from '../types/agentRegistry';
import { Subtask, SubtaskType } from '../types/subtaskSchema';
import { ExecutionError, ExecutionStatus, SubtaskExecutionResult } from '../types/executionTypes';
import { SecureApiKeyManager } from './apiKeyManager';

export interface FallbackConfig {
  enabled: boolean;
  maxFallbackDepth: number;
  fallbackDelay: number; // milliseconds
  healthCheckInterval: number; // milliseconds
  circuitBreakerThreshold: number; // failure count
  circuitBreakerTimeout: number; // milliseconds
  loadBalancingStrategy: 'round-robin' | 'least-loaded' | 'capability-based' | 'performance-based';
  enableAutoRecovery: boolean;
  performanceWeighting: boolean;
}

export interface AgentHealth {
  agentId: string;
  status: 'healthy' | 'degraded' | 'failed' | 'circuit-open';
  lastHealthCheck: Date;
  consecutiveFailures: number;
  averageResponseTime: number;
  successRate: number; // 0-1
  currentLoad: number;
  capabilities: Set<SubtaskType>;
  circuitBreakerOpenUntil?: Date;
}

export interface FallbackPlan {
  originalAgent: Agent;
  fallbackChain: Agent[];
  reasoning: string[];
  estimatedDelayMinutes: number;
  riskAssessment: 'low' | 'medium' | 'high';
  alternatives: FallbackAlternative[];
}

export interface FallbackAlternative {
  agent: Agent;
  compatibility: number; // 0-1
  confidence: number; // 0-1
  estimatedPerformance: number; // 0-1
  reasoning: string;
}

export interface LoadBalancingMetrics {
  agentId: string;
  currentSubtasks: number;
  queuedSubtasks: number;
  averageExecutionTime: number;
  cpuUtilization: number; // 0-1 (simulated)
  memoryUtilization: number; // 0-1 (simulated)
  throughput: number; // tasks per minute
  lastUpdated: Date;
}

export class FallbackAgentManager {
  private config: FallbackConfig;
  private agentHealthMap: Map<string, AgentHealth> = new Map();
  private loadBalancingMetrics: Map<string, LoadBalancingMetrics> = new Map();
  private apiKeyManager: SecureApiKeyManager;
  private healthCheckTimers: Map<string, NodeJS.Timeout> = new Map();
  private performanceHistory: Map<string, number[]> = new Map();

  constructor(
    apiKeyManager: SecureApiKeyManager,
    config: Partial<FallbackConfig> = {}
  ) {
    this.apiKeyManager = apiKeyManager;
    this.config = {
      enabled: true,
      maxFallbackDepth: 3,
      fallbackDelay: 5000,
      healthCheckInterval: 30000,
      circuitBreakerThreshold: 5,
      circuitBreakerTimeout: 300000, // 5 minutes
      loadBalancingStrategy: 'capability-based',
      enableAutoRecovery: true,
      performanceWeighting: true,
      ...config
    };
  }

  /**
   * Registers agents and starts health monitoring
   */
  async registerAgents(agents: Agent[]): Promise<void> {
    for (const agent of agents) {
      await this.registerAgent(agent);
    }
  }

  /**
   * Registers a single agent
   */
  async registerAgent(agent: Agent): Promise<void> {
    // Initialize health status
    const health: AgentHealth = {
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

    // Initialize load balancing metrics
    const metrics: LoadBalancingMetrics = {
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

    // Start health checking
    this.startHealthChecking(agent);

    // Perform initial health check
    await this.performHealthCheck(agent);
  }

  /**
   * Selects the best agent for a subtask with fallback consideration
   */
  async selectAgent(
    subtask: Subtask,
    availableAgents: Agent[],
    excludeAgents: string[] = []
  ): Promise<Agent | null> {
    // Filter out excluded and unhealthy agents
    const viableAgents = availableAgents.filter(agent => {
      if (excludeAgents.includes(agent.id)) return false;
      
      const health = this.agentHealthMap.get(agent.id);
      if (!health) return false;
      
      // Check circuit breaker
      if (health.status === 'circuit-open') {
        if (health.circuitBreakerOpenUntil && new Date() > health.circuitBreakerOpenUntil) {
          // Circuit breaker timeout expired, try to recover
          health.status = 'degraded';
          health.consecutiveFailures = 0;
        } else {
          return false;
        }
      }
      
      return health.status !== 'failed';
    });

    if (viableAgents.length === 0) {
      return null;
    }

    // Select agent based on strategy
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

  /**
   * Creates a comprehensive fallback plan for a subtask
   */
  async createFallbackPlan(
    subtask: Subtask,
    originalAgent: Agent,
    availableAgents: Agent[]
  ): Promise<FallbackPlan> {
    const fallbackChain: Agent[] = [];
    const reasoning: string[] = [];
    const alternatives: FallbackAlternative[] = [];

    // Filter agents that can handle this subtask type
    const capableAgents = availableAgents.filter(agent => 
      agent.capabilities.includes(subtask.type) && agent.id !== originalAgent.id
    );

    // Score and sort agents by compatibility
    const scoredAgents = await Promise.all(
      capableAgents.map(agent => this.scoreAgentCompatibility(agent, subtask, originalAgent))
    );

    scoredAgents.sort((a, b) => b.compatibility - a.compatibility);

    // Build fallback chain
    let depth = 0;
    for (const scoredAgent of scoredAgents) {
      if (depth >= this.config.maxFallbackDepth) break;
      
      const health = this.agentHealthMap.get(scoredAgent.agent.id);
      if (health?.status === 'healthy' || health?.status === 'degraded') {
        fallbackChain.push(scoredAgent.agent);
        reasoning.push(
          `Fallback ${depth + 1}: ${scoredAgent.agent.id} - ${scoredAgent.reasoning}`
        );
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

    // Assess risk
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

  /**
   * Executes fallback logic when an agent fails
   */
  async executeFallback(
    subtask: Subtask,
    failedAgent: Agent,
    error: ExecutionError,
    availableAgents: Agent[]
  ): Promise<Agent | null> {
    // Record failure
    await this.recordAgentFailure(failedAgent.id, error);

    // Create fallback plan
    const fallbackPlan = await this.createFallbackPlan(subtask, failedAgent, availableAgents);
    
    if (fallbackPlan.fallbackChain.length === 0) {
      return null;
    }

    // Apply fallback delay
    if (this.config.fallbackDelay > 0) {
      await this.sleep(this.config.fallbackDelay);
    }

    // Return first viable fallback agent
    return fallbackPlan.fallbackChain[0];
  }

  /**
   * Records successful execution for performance tracking
   */
  async recordSuccess(
    agentId: string,
    executionResult: SubtaskExecutionResult
  ): Promise<void> {
    const health = this.agentHealthMap.get(agentId);
    const metrics = this.loadBalancingMetrics.get(agentId);
    
    if (health && metrics) {
      // Update health metrics
      health.consecutiveFailures = 0;
      health.lastHealthCheck = new Date();
      health.status = 'healthy';
      health.averageResponseTime = this.updateAverageResponseTime(
        health.averageResponseTime,
        executionResult.executionTime
      );
      
      // Update success rate
      const performanceHistory = this.performanceHistory.get(agentId) || [];
      performanceHistory.push(1); // Success
      if (performanceHistory.length > 100) {
        performanceHistory.shift();
      }
      this.performanceHistory.set(agentId, performanceHistory);
      health.successRate = performanceHistory.reduce((a, b) => a + b, 0) / performanceHistory.length;

      // Update load metrics
      metrics.currentSubtasks = Math.max(0, metrics.currentSubtasks - 1);
      metrics.averageExecutionTime = this.updateAverageResponseTime(
        metrics.averageExecutionTime,
        executionResult.executionTime
      );
      metrics.throughput = this.calculateThroughput(agentId);
      metrics.lastUpdated = new Date();

      // Reset circuit breaker if it was open
      if (health.circuitBreakerOpenUntil) {
        delete health.circuitBreakerOpenUntil;
      }
    }
  }

  /**
   * Records agent failure and updates health status
   */
  async recordAgentFailure(agentId: string, error: ExecutionError): Promise<void> {
    const health = this.agentHealthMap.get(agentId);
    if (!health) return;

    health.consecutiveFailures++;
    health.lastHealthCheck = new Date();

    // Update success rate
    const performanceHistory = this.performanceHistory.get(agentId) || [];
    performanceHistory.push(0); // Failure
    if (performanceHistory.length > 100) {
      performanceHistory.shift();
    }
    this.performanceHistory.set(agentId, performanceHistory);
    health.successRate = performanceHistory.reduce((a, b) => a + b, 0) / performanceHistory.length;

    // Determine new status
    if (health.consecutiveFailures >= this.config.circuitBreakerThreshold) {
      health.status = 'circuit-open';
      health.circuitBreakerOpenUntil = new Date(
        Date.now() + this.config.circuitBreakerTimeout
      );
    } else if (health.consecutiveFailures >= 3) {
      health.status = 'degraded';
    }

    // Update load metrics
    const metrics = this.loadBalancingMetrics.get(agentId);
    if (metrics) {
      metrics.currentSubtasks = Math.max(0, metrics.currentSubtasks - 1);
      metrics.lastUpdated = new Date();
    }
  }

  /**
   * Gets current health status of all agents
   */
  getAgentHealthStatus(): Map<string, AgentHealth> {
    return new Map(this.agentHealthMap);
  }

  /**
   * Gets load balancing metrics for all agents
   */
  getLoadBalancingMetrics(): Map<string, LoadBalancingMetrics> {
    return new Map(this.loadBalancingMetrics);
  }

  /**
   * Forces a health check for all agents
   */
  async forceHealthCheck(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    
    for (const [agentId, health] of this.agentHealthMap.entries()) {
      try {
        // Find the agent object (in a real implementation, you'd have access to this)
        const agent = { id: agentId } as Agent; // Simplified
        const isHealthy = await this.performHealthCheck(agent);
        results.set(agentId, isHealthy);
      } catch (error) {
        results.set(agentId, false);
      }
    }
    
    return results;
  }

  // Private methods
  private selectRoundRobin(agents: Agent[]): Agent {
    // Simple round-robin implementation
    const timestamp = Date.now();
    const index = Math.floor(timestamp / 1000) % agents.length;
    return agents[index];
  }

  private selectLeastLoaded(agents: Agent[]): Agent {
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

  private selectCapabilityBased(subtask: Subtask, agents: Agent[]): Agent {
    // Select agent with best capability match for the subtask type
    const capableAgents = agents.filter(agent => 
      agent.capabilities.includes(subtask.type)
    );
    
    if (capableAgents.length === 0) {
      return agents[0]; // Fallback to first agent
    }

    // Among capable agents, select the healthiest
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

  private selectPerformanceBased(subtask: Subtask, agents: Agent[]): Agent {
    let bestAgent = agents[0];
    let bestScore = 0;

    for (const agent of agents) {
      const health = this.agentHealthMap.get(agent.id);
      const metrics = this.loadBalancingMetrics.get(agent.id);
      
      if (health && metrics) {
        // Calculate performance score
        let score = health.successRate * 0.4; // Success rate weight
        score += (1.0 - (metrics.currentSubtasks / 10)) * 0.3; // Load weight (inverse)
        score += (1.0 / Math.max(health.averageResponseTime, 1)) * 0.2; // Speed weight
        score += (health.status === 'healthy' ? 1.0 : 0.5) * 0.1; // Health weight

        if (score > bestScore) {
          bestScore = score;
          bestAgent = agent;
        }
      }
    }

    return bestAgent;
  }

  private async scoreAgentCompatibility(
    agent: Agent,
    subtask: Subtask,
    originalAgent: Agent
  ): Promise<FallbackAlternative> {
    const health = this.agentHealthMap.get(agent.id);
    const metrics = this.loadBalancingMetrics.get(agent.id);
    
    let compatibility = 0;
    let confidence = 0;
    let estimatedPerformance = 0;
    let reasoning = '';

    // Capability compatibility
    if (agent.capabilities.includes(subtask.type)) {
      compatibility += 0.4;
      reasoning += 'Supports required task type; ';
    }

    // Health-based scoring
    if (health) {
      compatibility += health.successRate * 0.3;
      confidence += health.status === 'healthy' ? 0.5 : 0.2;
      estimatedPerformance += health.successRate * 0.4;
      reasoning += `${(health.successRate * 100).toFixed(1)}% success rate; `;
    }

    // Load-based scoring
    if (metrics) {
      const loadFactor = Math.max(0, 1 - (metrics.currentSubtasks / 10));
      compatibility += loadFactor * 0.2;
      estimatedPerformance += loadFactor * 0.3;
      reasoning += `${metrics.currentSubtasks} current tasks; `;
    }

    // Performance comparison with original agent
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

  private assessFallbackRisk(fallbackChain: Agent[], subtask: Subtask): 'low' | 'medium' | 'high' {
    if (fallbackChain.length === 0) return 'high';
    if (fallbackChain.length >= 2) return 'low';
    
    const firstFallback = fallbackChain[0];
    const health = this.agentHealthMap.get(firstFallback.id);
    
    if (!health || health.status !== 'healthy') return 'high';
    if (health.successRate < 0.8) return 'medium';
    
    return 'low';
  }

  private startHealthChecking(agent: Agent): void {
    const timer = setInterval(async () => {
      try {
        await this.performHealthCheck(agent);
      } catch (error) {
        console.error(`Health check failed for agent ${agent.id}:`, error);
      }
    }, this.config.healthCheckInterval);

    this.healthCheckTimers.set(agent.id, timer);
  }

  private async performHealthCheck(agent: Agent): Promise<boolean> {
    try {
      // In a real implementation, this would make an actual health check API call
      // For now, we'll simulate it
      const isHealthy = Math.random() > 0.1; // 90% healthy simulation
      
      const health = this.agentHealthMap.get(agent.id);
      if (health) {
        health.lastHealthCheck = new Date();
        if (isHealthy) {
          if (health.status === 'failed') {
            health.status = 'degraded'; // Gradual recovery
          } else if (health.status === 'degraded' && health.consecutiveFailures === 0) {
            health.status = 'healthy';
          }
        } else {
          health.consecutiveFailures++;
          if (health.consecutiveFailures >= this.config.circuitBreakerThreshold) {
            health.status = 'circuit-open';
            health.circuitBreakerOpenUntil = new Date(
              Date.now() + this.config.circuitBreakerTimeout
            );
          }
        }
      }
      
      return isHealthy;
    } catch (error) {
      return false;
    }
  }

  private updateAverageResponseTime(currentAverage: number, newTime: number): number {
    if (currentAverage === 0) return newTime;
    return (currentAverage * 0.8) + (newTime * 0.2); // Weighted average
  }

  private calculateThroughput(agentId: string): number {
    const performanceHistory = this.performanceHistory.get(agentId) || [];
    const recentSuccess = performanceHistory.slice(-10).reduce((a, b) => a + b, 0);
    return recentSuccess * 6; // Approximate tasks per minute
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cleanup method to stop all timers
   */
  cleanup(): void {
    for (const timer of this.healthCheckTimers.values()) {
      clearInterval(timer);
    }
    this.healthCheckTimers.clear();
  }
}