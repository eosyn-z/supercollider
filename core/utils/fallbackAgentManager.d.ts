import { Agent } from '../types/agentRegistry';
import { Subtask, SubtaskType } from '../types/subtaskSchema';
import { ExecutionError, SubtaskExecutionResult } from '../types/executionTypes';
import { SecureApiKeyManager } from './apiKeyManager';
export interface FallbackConfig {
    enabled: boolean;
    maxFallbackDepth: number;
    fallbackDelay: number;
    healthCheckInterval: number;
    circuitBreakerThreshold: number;
    circuitBreakerTimeout: number;
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
    successRate: number;
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
    compatibility: number;
    confidence: number;
    estimatedPerformance: number;
    reasoning: string;
}
export interface LoadBalancingMetrics {
    agentId: string;
    currentSubtasks: number;
    queuedSubtasks: number;
    averageExecutionTime: number;
    cpuUtilization: number;
    memoryUtilization: number;
    throughput: number;
    lastUpdated: Date;
}
export declare class FallbackAgentManager {
    private config;
    private agentHealthMap;
    private loadBalancingMetrics;
    private apiKeyManager;
    private healthCheckTimers;
    private performanceHistory;
    constructor(apiKeyManager: SecureApiKeyManager, config?: Partial<FallbackConfig>);
    registerAgents(agents: Agent[]): Promise<void>;
    registerAgent(agent: Agent): Promise<void>;
    selectAgent(subtask: Subtask, availableAgents: Agent[], excludeAgents?: string[]): Promise<Agent | null>;
    createFallbackPlan(subtask: Subtask, originalAgent: Agent, availableAgents: Agent[]): Promise<FallbackPlan>;
    executeFallback(subtask: Subtask, failedAgent: Agent, error: ExecutionError, availableAgents: Agent[]): Promise<Agent | null>;
    recordSuccess(agentId: string, executionResult: SubtaskExecutionResult): Promise<void>;
    recordAgentFailure(agentId: string, error: ExecutionError): Promise<void>;
    getAgentHealthStatus(): Map<string, AgentHealth>;
    getLoadBalancingMetrics(): Map<string, LoadBalancingMetrics>;
    forceHealthCheck(): Promise<Map<string, boolean>>;
    private selectRoundRobin;
    private selectLeastLoaded;
    private selectCapabilityBased;
    private selectPerformanceBased;
    private scoreAgentCompatibility;
    private assessFallbackRisk;
    private startHealthChecking;
    private performHealthCheck;
    private updateAverageResponseTime;
    private calculateThroughput;
    private sleep;
    cleanup(): void;
}
//# sourceMappingURL=fallbackAgentManager.d.ts.map