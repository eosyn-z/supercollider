/**
 * Universal Agent Integration - Agent Orchestration System
 * Manages and routes tasks to optimal agents based on capabilities and constraints
 */

import { EventEmitter } from 'events';
import { MediaInput, MediaType, ProcessingCapability, ProcessingPipeline, ProcessingStep } from './mediaClassifier';

export interface UniversalAgent {
  id: string;
  name: string;
  description: string;
  version: string;
  provider: string;
  category: 'ai_model' | 'api_service' | 'local_processor' | 'hybrid' | 'specialized';
  capabilities: ProcessingCapability[];
  supportedInputTypes: MediaType[];
  supportedOutputTypes: MediaType[];
  apiEndpoint?: string;
  localExecutorPath?: string;
  authentication: AgentAuthentication;
  performance: AgentPerformance;
  constraints: AgentConstraints;
  availability: AgentAvailability;
  metadata: AgentMetadata;
}

export interface AgentAuthentication {
  type: 'api_key' | 'oauth' | 'bearer_token' | 'basic_auth' | 'certificate' | 'none';
  credentials?: Record<string, string>;
  refreshToken?: string;
  expiresAt?: number;
  scopes?: string[];
}

export interface AgentPerformance {
  costPerRequest: number;
  costPerToken?: number;
  averageLatency: number;
  maxLatency: number;
  throughput: number;
  reliabilityScore: number;
  qualityScore: number;
  successRate: number;
  lastUpdated: number;
}

export interface AgentConstraints {
  maxConcurrentRequests: number;
  rateLimitPerMinute: number;
  rateLimitPerDay?: number;
  maxInputSize: number;
  maxOutputSize: number;
  timeoutMs: number;
  supportsBatch: boolean;
  maxBatchSize?: number;
  requiresGPU: boolean;
  minimumMemoryMB: number;
  geographicRestrictions?: string[];
}

export interface AgentAvailability {
  status: 'online' | 'offline' | 'maintenance' | 'rate_limited' | 'error';
  lastChecked: number;
  uptime: number;
  plannedMaintenance?: MaintenanceWindow[];
  currentLoad: number;
  maxLoad: number;
  queueLength: number;
  estimatedWaitTime: number;
}

export interface MaintenanceWindow {
  startTime: number;
  endTime: number;
  reason: string;
  severity: 'minor' | 'major' | 'critical';
}

export interface AgentMetadata {
  tags: string[];
  createdAt: number;
  lastUsed: number;
  usageCount: number;
  averageRating: number;
  specializations: string[];
  modelSize?: string;
  trainingData?: string;
  license: string;
  deprecated: boolean;
  recommendedAlternatives?: string[];
}

export interface AgentSelection {
  agentId: string;
  taskId: string;
  confidence: number;
  reasoning: string[];
  estimatedCost: number;
  estimatedDuration: number;
  qualityPrediction: number;
  fallbackAgents: AgentFallback[];
  constraints: SelectionConstraints;
}

export interface AgentFallback {
  agentId: string;
  reason: string;
  confidencePenalty: number;
  costDelta: number;
  durationDelta: number;
}

export interface SelectionConstraints {
  maxCost?: number;
  maxDuration?: number;
  minQuality?: number;
  preferredProviders?: string[];
  excludedProviders?: string[];
  requireLocal?: boolean;
  allowBatch?: boolean;
  geographicRegion?: string;
}

export interface ProcessingPlan {
  id: string;
  mediaInput: MediaInput;
  targetOutput: MediaType;
  selectedAgent: AgentSelection;
  preprocessingSteps: ProcessingStep[];
  postprocessingSteps: ProcessingStep[];
  estimatedTotalCost: number;
  estimatedTotalDuration: number;
  riskAssessment: PlanRiskAssessment;
  alternatives: ProcessingPlan[];
}

export interface PlanRiskAssessment {
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  riskFactors: PlanRiskFactor[];
  mitigationStrategies: string[];
  contingencyPlans: string[];
  successProbability: number;
}

export interface PlanRiskFactor {
  type: 'agent_availability' | 'rate_limits' | 'cost_overrun' | 'quality_degradation' | 'timeout';
  probability: number;
  impact: number;
  description: string;
  mitigation: string[];
}

export interface AgentPool {
  id: string;
  name: string;
  agents: string[];
  loadBalancingStrategy: 'round_robin' | 'least_loaded' | 'random' | 'quality_weighted' | 'cost_optimized';
  healthCheckInterval: number;
  autoFailover: boolean;
  maxRetries: number;
}

export interface TaskRoute {
  taskId: string;
  agentId: string;
  priority: number;
  timeout: number;
  retryCount: number;
  startTime: number;
  estimatedCompletion: number;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'timeout' | 'cancelled';
  result?: any;
  error?: string;
  metrics: TaskMetrics;
}

export interface TaskMetrics {
  actualDuration: number;
  actualCost: number;
  qualityScore: number;
  agentLatency: number;
  networkLatency: number;
  processingLatency: number;
  memoryUsed: number;
  cpuUsed: number;
  errorCount: number;
  retryCount: number;
}

export interface AgentHealth {
  agentId: string;
  timestamp: number;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  responseTime: number;
  errorRate: number;
  successRate: number;
  currentLoad: number;
  metrics: HealthMetrics;
  issues: HealthIssue[];
}

export interface HealthMetrics {
  avgResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  requestsPerMinute: number;
  errorsPerMinute: number;
  availabilityPercent: number;
  lastSuccessfulRequest: number;
  consecutiveFailures: number;
}

export interface HealthIssue {
  type: 'slow_response' | 'high_error_rate' | 'unavailable' | 'rate_limited' | 'authentication_failed';
  severity: 'warning' | 'error' | 'critical';
  description: string;
  firstDetected: number;
  lastSeen: number;
  occurrenceCount: number;
}

export class AgentOrchestrator extends EventEmitter {
  private agents: Map<string, UniversalAgent> = new Map();
  private agentPools: Map<string, AgentPool> = new Map();
  private activeRoutes: Map<string, TaskRoute> = new Map();
  private agentHealth: Map<string, AgentHealth> = new Map();
  private performanceHistory: Map<string, AgentPerformance[]> = new Map();
  private selectionCache: Map<string, AgentSelection> = new Map();

  constructor() {
    super();
    this.initializeHealthMonitoring();
    this.initializeDefaultAgents();
  }

  /**
   * Register a new agent in the orchestrator
   */
  registerAgent(agent: UniversalAgent): void {
    this.agents.set(agent.id, agent);
    this.initializeAgentHealth(agent);
    
    this.emit('agent-registered', {
      agentId: agent.id,
      name: agent.name,
      capabilities: agent.capabilities
    });
  }

  /**
   * Remove an agent from the orchestrator
   */
  unregisterAgent(agentId: string): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) return false;

    // Cancel any active routes for this agent
    this.cancelAgentRoutes(agentId);
    
    this.agents.delete(agentId);
    this.agentHealth.delete(agentId);
    this.performanceHistory.delete(agentId);
    
    this.emit('agent-unregistered', { agentId });
    return true;
  }

  /**
   * Select optimal agents for a processing pipeline
   */
  static selectOptimalAgents(
    pipeline: ProcessingPipeline,
    availableAgents: UniversalAgent[],
    constraints: SelectionConstraints = {}
  ): AgentSelection[] {
    const selections: AgentSelection[] = [];

    for (const step of pipeline.steps) {
      const candidateAgents = this.filterCandidateAgents(
        availableAgents,
        step,
        constraints
      );

      if (candidateAgents.length === 0) {
        throw new Error(`No suitable agents found for step: ${step.name}`);
      }

      const selection = this.scoreAndSelectAgent(
        candidateAgents,
        step,
        constraints
      );

      selections.push(selection);
    }

    return this.optimizeAgentSelections(selections, pipeline, constraints);
  }

  /**
   * Route media processing to appropriate agents
   */
  routeMediaProcessing(
    mediaInput: MediaInput,
    targetOutput: MediaType,
    agents: UniversalAgent[],
    constraints: SelectionConstraints = {}
  ): ProcessingPlan {
    const planId = `plan-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    // Find agents capable of the transformation
    const capableAgents = agents.filter(agent =>
      agent.supportedInputTypes.includes(mediaInput.type) &&
      agent.supportedOutputTypes.includes(targetOutput) &&
      this.meetsConstraints(agent, constraints)
    );

    if (capableAgents.length === 0) {
      throw new Error(`No agents capable of transforming ${mediaInput.type} to ${targetOutput}`);
    }

    // Score and select the best agent
    const scoredAgents = capableAgents.map(agent => ({
      agent,
      score: this.scoreAgentForTask(agent, mediaInput, targetOutput, constraints)
    }));

    const bestAgent = scoredAgents.sort((a, b) => b.score - a.score)[0].agent;

    // Create agent selection
    const selection: AgentSelection = {
      agentId: bestAgent.id,
      taskId: `task-${Date.now()}`,
      confidence: this.calculateSelectionConfidence(bestAgent, mediaInput, targetOutput),
      reasoning: this.generateSelectionReasoning(bestAgent, mediaInput, targetOutput),
      estimatedCost: this.estimateCost(bestAgent, mediaInput),
      estimatedDuration: this.estimateDuration(bestAgent, mediaInput),
      qualityPrediction: bestAgent.performance.qualityScore,
      fallbackAgents: this.generateFallbacks(capableAgents, bestAgent),
      constraints
    };

    // Generate preprocessing/postprocessing steps
    const preprocessingSteps = this.generatePreprocessingSteps(mediaInput, bestAgent);
    const postprocessingSteps = this.generatePostprocessingSteps(targetOutput, bestAgent);

    // Calculate total estimates
    const totalCost = selection.estimatedCost + 
      this.estimateStepsCost(preprocessingSteps) + 
      this.estimateStepsCost(postprocessingSteps);

    const totalDuration = selection.estimatedDuration + 
      this.estimateStepsDuration(preprocessingSteps) + 
      this.estimateStepsDuration(postprocessingSteps);

    // Assess risks
    const riskAssessment = this.assessPlanRisks(selection, mediaInput, targetOutput);

    // Generate alternatives
    const alternatives = this.generateAlternativePlans(
      mediaInput,
      targetOutput,
      capableAgents.filter(a => a.id !== bestAgent.id).slice(0, 3),
      constraints
    );

    return {
      id: planId,
      mediaInput,
      targetOutput,
      selectedAgent: selection,
      preprocessingSteps,
      postprocessingSteps,
      estimatedTotalCost: totalCost,
      estimatedTotalDuration: totalDuration,
      riskAssessment,
      alternatives
    };
  }

  /**
   * Handle agent failures with automatic fallbacks
   */
  async handleAgentFailures(
    failedTask: TaskRoute,
    fallbackAgents: UniversalAgent[]
  ): Promise<TaskRoute | null> {
    const originalAgent = this.agents.get(failedTask.agentId);
    if (!originalAgent) return null;

    // Update agent health
    this.updateAgentHealth(failedTask.agentId, {
      errorCount: 1,
      consecutiveFailures: 1
    });

    // Find suitable fallback
    const suitableFallback = fallbackAgents.find(agent =>
      this.isAgentHealthy(agent.id) &&
      agent.capabilities.some(cap => originalAgent.capabilities.includes(cap))
    );

    if (!suitableFallback) {
      this.emit('no-fallback-available', {
        taskId: failedTask.taskId,
        originalAgent: failedTask.agentId
      });
      return null;
    }

    // Create new route with fallback agent
    const fallbackRoute: TaskRoute = {
      ...failedTask,
      agentId: suitableFallback.id,
      retryCount: failedTask.retryCount + 1,
      startTime: Date.now(),
      status: 'queued',
      error: undefined
    };

    this.activeRoutes.set(failedTask.taskId, fallbackRoute);

    this.emit('agent-fallback', {
      taskId: failedTask.taskId,
      originalAgent: failedTask.agentId,
      fallbackAgent: suitableFallback.id,
      retryCount: fallbackRoute.retryCount
    });

    return fallbackRoute;
  }

  /**
   * Execute a task with the selected agent
   */
  async executeTask(
    taskId: string,
    agentId: string,
    input: any,
    options: ExecutionOptions = {}
  ): Promise<TaskResult> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    if (!this.isAgentAvailable(agentId)) {
      throw new Error(`Agent not available: ${agentId}`);
    }

    const route: TaskRoute = {
      taskId,
      agentId,
      priority: options.priority || 1,
      timeout: options.timeout || agent.constraints.timeoutMs,
      retryCount: 0,
      startTime: Date.now(),
      estimatedCompletion: Date.now() + (options.timeout || agent.constraints.timeoutMs),
      status: 'processing',
      metrics: {
        actualDuration: 0,
        actualCost: 0,
        qualityScore: 0,
        agentLatency: 0,
        networkLatency: 0,
        processingLatency: 0,
        memoryUsed: 0,
        cpuUsed: 0,
        errorCount: 0,
        retryCount: 0
      }
    };

    this.activeRoutes.set(taskId, route);

    try {
      const result = await this.executeAgentTask(agent, input, route);
      
      route.status = 'completed';
      route.result = result;
      route.metrics.actualDuration = Date.now() - route.startTime;
      
      this.updatePerformanceMetrics(agentId, route.metrics);
      
      this.emit('task-completed', {
        taskId,
        agentId,
        duration: route.metrics.actualDuration,
        result
      });

      return {
        taskId,
        agentId,
        success: true,
        result,
        metrics: route.metrics,
        duration: route.metrics.actualDuration
      };

    } catch (error) {
      route.status = 'failed';
      route.error = error.message;
      route.metrics.errorCount = 1;
      
      this.updateAgentHealth(agentId, { errorCount: 1 });
      
      this.emit('task-failed', {
        taskId,
        agentId,
        error: error.message,
        duration: Date.now() - route.startTime
      });

      // Attempt fallback if available
      if (options.fallbackAgents && options.fallbackAgents.length > 0) {
        const fallbackAgent = options.fallbackAgents[0];
        return this.executeTask(taskId, fallbackAgent, input, {
          ...options,
          fallbackAgents: options.fallbackAgents.slice(1)
        });
      }

      throw error;
    } finally {
      this.activeRoutes.delete(taskId);
    }
  }

  /**
   * Get agent health status
   */
  getAgentHealth(agentId: string): AgentHealth | null {
    return this.agentHealth.get(agentId) || null;
  }

  /**
   * Get all available agents
   */
  getAvailableAgents(): UniversalAgent[] {
    return Array.from(this.agents.values()).filter(agent =>
      this.isAgentAvailable(agent.id)
    );
  }

  /**
   * Create agent pool for load balancing
   */
  createAgentPool(
    id: string,
    name: string,
    agentIds: string[],
    strategy: AgentPool['loadBalancingStrategy'] = 'round_robin'
  ): AgentPool {
    const pool: AgentPool = {
      id,
      name,
      agents: agentIds.filter(id => this.agents.has(id)),
      loadBalancingStrategy: strategy,
      healthCheckInterval: 30000, // 30 seconds
      autoFailover: true,
      maxRetries: 3
    };

    this.agentPools.set(id, pool);
    
    this.emit('pool-created', {
      poolId: id,
      agentCount: pool.agents.length
    });

    return pool;
  }

  /**
   * Private helper methods
   */
  private static filterCandidateAgents(
    agents: UniversalAgent[],
    step: ProcessingStep,
    constraints: SelectionConstraints
  ): UniversalAgent[] {
    return agents.filter(agent => {
      // Check capability match
      if (!agent.capabilities.includes(step.requiredCapabilities[0] as ProcessingCapability)) {
        return false;
      }

      // Check input/output type support
      if (!agent.supportedInputTypes.includes(step.inputType) ||
          !agent.supportedOutputTypes.includes(step.outputType)) {
        return false;
      }

      // Check constraints
      if (constraints.maxCost && agent.performance.costPerRequest > constraints.maxCost) {
        return false;
      }

      if (constraints.maxDuration && agent.performance.averageLatency > constraints.maxDuration) {
        return false;
      }

      if (constraints.minQuality && agent.performance.qualityScore < constraints.minQuality) {
        return false;
      }

      if (constraints.preferredProviders && 
          !constraints.preferredProviders.includes(agent.provider)) {
        return false;
      }

      if (constraints.excludedProviders && 
          constraints.excludedProviders.includes(agent.provider)) {
        return false;
      }

      if (constraints.requireLocal && agent.category !== 'local_processor') {
        return false;
      }

      return true;
    });
  }

  private static scoreAndSelectAgent(
    candidates: UniversalAgent[],
    step: ProcessingStep,
    constraints: SelectionConstraints
  ): AgentSelection {
    const scored = candidates.map(agent => ({
      agent,
      score: this.calculateAgentScore(agent, step, constraints)
    }));

    const best = scored.sort((a, b) => b.score - a.score)[0];

    return {
      agentId: best.agent.id,
      taskId: step.id,
      confidence: best.score,
      reasoning: [`Best match for ${step.name}`, `Score: ${best.score.toFixed(2)}`],
      estimatedCost: best.agent.performance.costPerRequest,
      estimatedDuration: best.agent.performance.averageLatency,
      qualityPrediction: best.agent.performance.qualityScore,
      fallbackAgents: scored.slice(1, 3).map(s => ({
        agentId: s.agent.id,
        reason: 'Lower overall score',
        confidencePenalty: best.score - s.score,
        costDelta: s.agent.performance.costPerRequest - best.agent.performance.costPerRequest,
        durationDelta: s.agent.performance.averageLatency - best.agent.performance.averageLatency
      })),
      constraints
    };
  }

  private static calculateAgentScore(
    agent: UniversalAgent,
    step: ProcessingStep,
    constraints: SelectionConstraints
  ): number {
    let score = 0;

    // Quality score (40% weight)
    score += agent.performance.qualityScore * 0.4;

    // Reliability score (25% weight)
    score += agent.performance.reliabilityScore * 0.25;

    // Speed score (20% weight) - inverse of latency
    const speedScore = Math.max(0, 1 - (agent.performance.averageLatency / 60000)); // Normalize to 1 minute
    score += speedScore * 0.2;

    // Cost efficiency (15% weight) - inverse of cost
    const costScore = Math.max(0, 1 - (agent.performance.costPerRequest / 1)); // Normalize to $1
    score += costScore * 0.15;

    // Apply constraint penalties
    if (constraints.maxCost && agent.performance.costPerRequest > constraints.maxCost * 0.8) {
      score *= 0.8; // Penalty for high cost
    }

    if (constraints.maxDuration && agent.performance.averageLatency > constraints.maxDuration * 0.8) {
      score *= 0.8; // Penalty for slow response
    }

    return Math.min(1, Math.max(0, score));
  }

  private static optimizeAgentSelections(
    selections: AgentSelection[],
    pipeline: ProcessingPipeline,
    constraints: SelectionConstraints
  ): AgentSelection[] {
    // For now, return as-is. In a full implementation, this would optimize
    // for factors like agent colocation, batch processing opportunities, etc.
    return selections;
  }

  private meetsConstraints(agent: UniversalAgent, constraints: SelectionConstraints): boolean {
    if (constraints.maxCost && agent.performance.costPerRequest > constraints.maxCost) {
      return false;
    }

    if (constraints.maxDuration && agent.performance.averageLatency > constraints.maxDuration) {
      return false;
    }

    if (constraints.minQuality && agent.performance.qualityScore < constraints.minQuality) {
      return false;
    }

    if (constraints.preferredProviders && 
        !constraints.preferredProviders.includes(agent.provider)) {
      return false;
    }

    if (constraints.excludedProviders && 
        constraints.excludedProviders.includes(agent.provider)) {
      return false;
    }

    if (constraints.requireLocal && agent.category !== 'local_processor') {
      return false;
    }

    return true;
  }

  private scoreAgentForTask(
    agent: UniversalAgent,
    mediaInput: MediaInput,
    targetOutput: MediaType,
    constraints: SelectionConstraints
  ): number {
    let score = 0;

    // Base capability match
    if (agent.supportedInputTypes.includes(mediaInput.type) &&
        agent.supportedOutputTypes.includes(targetOutput)) {
      score += 0.5;
    }

    // Performance factors
    score += agent.performance.qualityScore * 0.25;
    score += agent.performance.reliabilityScore * 0.15;
    score += (1 - Math.min(1, agent.performance.averageLatency / 60000)) * 0.1; // Speed bonus

    return Math.min(1, score);
  }

  private calculateSelectionConfidence(
    agent: UniversalAgent,
    mediaInput: MediaInput,
    targetOutput: MediaType
  ): number {
    let confidence = 0.7; // Base confidence

    // Boost for exact input/output match
    if (agent.supportedInputTypes.includes(mediaInput.type) &&
        agent.supportedOutputTypes.includes(targetOutput)) {
      confidence += 0.2;
    }

    // Boost for high reliability
    confidence += agent.performance.reliabilityScore * 0.1;

    return Math.min(1, confidence);
  }

  private generateSelectionReasoning(
    agent: UniversalAgent,
    mediaInput: MediaInput,
    targetOutput: MediaType
  ): string[] {
    const reasons: string[] = [];

    reasons.push(`Supports ${mediaInput.type} to ${targetOutput} transformation`);
    reasons.push(`Quality score: ${agent.performance.qualityScore.toFixed(2)}`);
    reasons.push(`Reliability: ${agent.performance.reliabilityScore.toFixed(2)}`);
    reasons.push(`Average latency: ${agent.performance.averageLatency}ms`);

    return reasons;
  }

  private estimateCost(agent: UniversalAgent, mediaInput: MediaInput): number {
    let cost = agent.performance.costPerRequest;

    // Adjust based on input size
    const sizeFactor = Math.max(1, mediaInput.metadata.size / 1000000); // Scale per MB
    cost *= sizeFactor;

    return Math.round(cost * 100) / 100; // Round to cents
  }

  private estimateDuration(agent: UniversalAgent, mediaInput: MediaInput): number {
    let duration = agent.performance.averageLatency;

    // Adjust based on input size and type
    const sizeFactor = Math.max(1, Math.log10(mediaInput.metadata.size / 1000)); // Logarithmic scale
    duration *= sizeFactor;

    // Add type-specific factors
    const typeFactors = {
      'video': 2.0,
      'audio': 1.5,
      'image': 1.2,
      'document': 1.1,
      'text': 1.0,
      'data': 1.0,
      'code': 1.0,
      'url': 1.3,
      'mixed': 1.8
    };

    duration *= typeFactors[mediaInput.type] || 1.0;

    return Math.round(duration);
  }

  private generateFallbacks(
    capableAgents: UniversalAgent[],
    selectedAgent: UniversalAgent
  ): AgentFallback[] {
    return capableAgents
      .filter(agent => agent.id !== selectedAgent.id)
      .slice(0, 3)
      .map(agent => ({
        agentId: agent.id,
        reason: 'Alternative option with different performance characteristics',
        confidencePenalty: Math.random() * 0.2,
        costDelta: agent.performance.costPerRequest - selectedAgent.performance.costPerRequest,
        durationDelta: agent.performance.averageLatency - selectedAgent.performance.averageLatency
      }));
  }

  private generatePreprocessingSteps(
    mediaInput: MediaInput,
    agent: UniversalAgent
  ): ProcessingStep[] {
    const steps: ProcessingStep[] = [];

    // Add format conversion if needed
    if (!agent.supportedInputTypes.includes(mediaInput.type)) {
      steps.push({
        id: `preprocess-convert-${mediaInput.id}`,
        name: 'Format Conversion',
        inputType: mediaInput.type,
        outputType: agent.supportedInputTypes[0],
        dependencies: [],
        canBatch: false,
        estimatedDuration: 5000,
        requiredCapabilities: ['transform'],
        fallbackOptions: []
      });
    }

    // Add validation step
    steps.push({
      id: `preprocess-validate-${mediaInput.id}`,
      name: 'Input Validation',
      inputType: mediaInput.type,
      outputType: mediaInput.type,
      dependencies: [],
      canBatch: true,
      estimatedDuration: 1000,
      requiredCapabilities: ['analyze'],
      fallbackOptions: []
    });

    return steps;
  }

  private generatePostprocessingSteps(
    targetOutput: MediaType,
    agent: UniversalAgent
  ): ProcessingStep[] {
    const steps: ProcessingStep[] = [];

    // Add quality validation
    steps.push({
      id: `postprocess-validate-${targetOutput}`,
      name: 'Output Quality Validation',
      inputType: targetOutput,
      outputType: targetOutput,
      dependencies: [],
      canBatch: false,
      estimatedDuration: 2000,
      requiredCapabilities: ['analyze'],
      fallbackOptions: []
    });

    return steps;
  }

  private estimateStepsCost(steps: ProcessingStep[]): number {
    return steps.reduce((total, step) => total + 0.01, 0); // $0.01 per step
  }

  private estimateStepsDuration(steps: ProcessingStep[]): number {
    return steps.reduce((total, step) => total + step.estimatedDuration, 0);
  }

  private assessPlanRisks(
    selection: AgentSelection,
    mediaInput: MediaInput,
    targetOutput: MediaType
  ): PlanRiskAssessment {
    const riskFactors: PlanRiskFactor[] = [];

    // Agent availability risk
    const agent = this.agents.get(selection.agentId);
    if (agent && agent.availability.currentLoad > 0.8) {
      riskFactors.push({
        type: 'agent_availability',
        probability: 0.3,
        impact: 0.7,
        description: 'Agent is currently under high load',
        mitigation: ['Use fallback agent', 'Wait for lower load period']
      });
    }

    // Cost overrun risk
    if (selection.estimatedCost > 1.0) {
      riskFactors.push({
        type: 'cost_overrun',
        probability: 0.2,
        impact: 0.5,
        description: 'High cost estimation may exceed budget',
        mitigation: ['Use cheaper alternative', 'Reduce input size']
      });
    }

    const overallRisk = this.calculateOverallRisk(riskFactors);
    const successProbability = Math.max(0.5, 1 - (riskFactors.length * 0.1));

    return {
      overallRisk,
      riskFactors,
      mitigationStrategies: riskFactors.flatMap(r => r.mitigation),
      contingencyPlans: ['Switch to fallback agent', 'Retry with different parameters'],
      successProbability
    };
  }

  private calculateOverallRisk(riskFactors: PlanRiskFactor[]): 'low' | 'medium' | 'high' | 'critical' {
    if (riskFactors.length === 0) return 'low';

    const avgRisk = riskFactors.reduce((sum, risk) => 
      sum + (risk.probability * risk.impact), 0
    ) / riskFactors.length;

    if (avgRisk < 0.3) return 'low';
    if (avgRisk < 0.6) return 'medium';
    if (avgRisk < 0.8) return 'high';
    return 'critical';
  }

  private generateAlternativePlans(
    mediaInput: MediaInput,
    targetOutput: MediaType,
    alternativeAgents: UniversalAgent[],
    constraints: SelectionConstraints
  ): ProcessingPlan[] {
    return alternativeAgents.slice(0, 2).map(agent => {
      const selection: AgentSelection = {
        agentId: agent.id,
        taskId: `alt-task-${Date.now()}`,
        confidence: this.calculateSelectionConfidence(agent, mediaInput, targetOutput),
        reasoning: this.generateSelectionReasoning(agent, mediaInput, targetOutput),
        estimatedCost: this.estimateCost(agent, mediaInput),
        estimatedDuration: this.estimateDuration(agent, mediaInput),
        qualityPrediction: agent.performance.qualityScore,
        fallbackAgents: [],
        constraints
      };

      return {
        id: `alt-plan-${agent.id}`,
        mediaInput,
        targetOutput,
        selectedAgent: selection,
        preprocessingSteps: this.generatePreprocessingSteps(mediaInput, agent),
        postprocessingSteps: this.generatePostprocessingSteps(targetOutput, agent),
        estimatedTotalCost: selection.estimatedCost,
        estimatedTotalDuration: selection.estimatedDuration,
        riskAssessment: this.assessPlanRisks(selection, mediaInput, targetOutput),
        alternatives: []
      };
    });
  }

  private initializeHealthMonitoring(): void {
    // Monitor agent health every 30 seconds
    setInterval(() => {
      this.performHealthChecks();
    }, 30000);
  }

  private initializeDefaultAgents(): void {
    // Add some default agents for demonstration
    const defaultAgents: UniversalAgent[] = [
      {
        id: 'gpt-4-turbo',
        name: 'GPT-4 Turbo',
        description: 'Advanced language model for text generation and analysis',
        version: '4.0',
        provider: 'OpenAI',
        category: 'ai_model',
        capabilities: ['analyze', 'generate', 'transform', 'synthesize'],
        supportedInputTypes: ['text', 'code', 'document'],
        supportedOutputTypes: ['text', 'code'],
        apiEndpoint: 'https://api.openai.com/v1/chat/completions',
        authentication: {
          type: 'bearer_token',
          credentials: { token: process.env.OPENAI_API_KEY || '' }
        },
        performance: {
          costPerRequest: 0.03,
          costPerToken: 0.00003,
          averageLatency: 2000,
          maxLatency: 10000,
          throughput: 100,
          reliabilityScore: 0.95,
          qualityScore: 0.92,
          successRate: 0.98,
          lastUpdated: Date.now()
        },
        constraints: {
          maxConcurrentRequests: 10,
          rateLimitPerMinute: 3500,
          rateLimitPerDay: 200000,
          maxInputSize: 128000,
          maxOutputSize: 4096,
          timeoutMs: 30000,
          supportsBatch: false,
          requiresGPU: false,
          minimumMemoryMB: 0
        },
        availability: {
          status: 'online',
          lastChecked: Date.now(),
          uptime: 0.99,
          currentLoad: 0.3,
          maxLoad: 1.0,
          queueLength: 0,
          estimatedWaitTime: 0
        },
        metadata: {
          tags: ['language-model', 'text-generation', 'analysis'],
          createdAt: Date.now(),
          lastUsed: 0,
          usageCount: 0,
          averageRating: 4.8,
          specializations: ['creative-writing', 'code-generation', 'analysis'],
          license: 'Commercial',
          deprecated: false
        }
      }
    ];

    defaultAgents.forEach(agent => this.registerAgent(agent));
  }

  private initializeAgentHealth(agent: UniversalAgent): void {
    this.agentHealth.set(agent.id, {
      agentId: agent.id,
      timestamp: Date.now(),
      status: 'unknown',
      responseTime: 0,
      errorRate: 0,
      successRate: 1,
      currentLoad: 0,
      metrics: {
        avgResponseTime: agent.performance.averageLatency,
        p95ResponseTime: agent.performance.maxLatency,
        p99ResponseTime: agent.performance.maxLatency * 1.2,
        requestsPerMinute: 0,
        errorsPerMinute: 0,
        availabilityPercent: 100,
        lastSuccessfulRequest: Date.now(),
        consecutiveFailures: 0
      },
      issues: []
    });
  }

  private async performHealthChecks(): Promise<void> {
    const healthPromises = Array.from(this.agents.keys()).map(agentId =>
      this.checkAgentHealth(agentId)
    );

    await Promise.allSettled(healthPromises);
  }

  private async checkAgentHealth(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    const startTime = Date.now();
    let status: AgentHealth['status'] = 'healthy';
    const issues: HealthIssue[] = [];

    try {
      // Perform a lightweight health check
      await this.performAgentHealthCheck(agent);
      
      const responseTime = Date.now() - startTime;
      
      // Update health metrics
      const health = this.agentHealth.get(agentId)!;
      health.responseTime = responseTime;
      health.timestamp = Date.now();
      health.metrics.lastSuccessfulRequest = Date.now();
      health.metrics.consecutiveFailures = 0;

      // Check for performance issues
      if (responseTime > agent.performance.maxLatency) {
        status = 'degraded';
        issues.push({
          type: 'slow_response',
          severity: 'warning',
          description: `Response time ${responseTime}ms exceeds threshold`,
          firstDetected: Date.now(),
          lastSeen: Date.now(),
          occurrenceCount: 1
        });
      }

      health.status = status;
      health.issues = issues;

    } catch (error) {
      const health = this.agentHealth.get(agentId)!;
      health.status = 'unhealthy';
      health.metrics.consecutiveFailures++;
      health.issues = [{
        type: 'unavailable',
        severity: 'error',
        description: error.message,
        firstDetected: Date.now(),
        lastSeen: Date.now(),
        occurrenceCount: 1
      }];

      this.emit('agent-health-degraded', {
        agentId,
        status: 'unhealthy',
        error: error.message
      });
    }
  }

  private async performAgentHealthCheck(agent: UniversalAgent): Promise<void> {
    if (agent.category === 'local_processor') {
      // For local processors, just check if the executable exists
      return Promise.resolve();
    }

    if (agent.apiEndpoint) {
      // For API services, make a simple ping request
      // This is simplified - in real implementation would make actual API call
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          if (Math.random() > 0.05) { // 95% success rate
            resolve();
          } else {
            reject(new Error('Health check failed'));
          }
        }, Math.random() * 1000 + 100);
      });
    }

    return Promise.resolve();
  }

  private isAgentAvailable(agentId: string): boolean {
    const health = this.agentHealth.get(agentId);
    return health?.status === 'healthy' || health?.status === 'degraded';
  }

  private isAgentHealthy(agentId: string): boolean {
    const health = this.agentHealth.get(agentId);
    return health?.status === 'healthy';
  }

  private cancelAgentRoutes(agentId: string): void {
    const routesToCancel = Array.from(this.activeRoutes.values())
      .filter(route => route.agentId === agentId);

    routesToCancel.forEach(route => {
      route.status = 'cancelled';
      this.activeRoutes.delete(route.taskId);
    });
  }

  private updateAgentHealth(agentId: string, updates: Partial<HealthMetrics>): void {
    const health = this.agentHealth.get(agentId);
    if (health) {
      Object.assign(health.metrics, updates);
      health.timestamp = Date.now();
    }
  }

  private updatePerformanceMetrics(agentId: string, metrics: TaskMetrics): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      // Update running averages
      agent.performance.averageLatency = 
        (agent.performance.averageLatency + metrics.actualDuration) / 2;
      agent.performance.lastUpdated = Date.now();
      
      // Store in history
      const history = this.performanceHistory.get(agentId) || [];
      history.push({ ...agent.performance });
      if (history.length > 100) history.shift(); // Keep last 100 records
      this.performanceHistory.set(agentId, history);
    }
  }

  private async executeAgentTask(
    agent: UniversalAgent,
    input: any,
    route: TaskRoute
  ): Promise<any> {
    // Simulate agent execution
    return new Promise((resolve, reject) => {
      const executionTime = agent.performance.averageLatency + 
        (Math.random() - 0.5) * agent.performance.averageLatency * 0.4;

      setTimeout(() => {
        if (Math.random() > 0.05) { // 95% success rate
          resolve({
            result: `Processed by ${agent.name}`,
            quality: agent.performance.qualityScore,
            processingTime: executionTime
          });
        } else {
          reject(new Error(`Agent ${agent.name} execution failed`));
        }
      }, executionTime);
    });
  }
}

// Supporting interfaces
export interface ExecutionOptions {
  priority?: number;
  timeout?: number;
  fallbackAgents?: string[];
  retryCount?: number;
}

export interface TaskResult {
  taskId: string;
  agentId: string;
  success: boolean;
  result?: any;
  error?: string;
  metrics: TaskMetrics;
  duration: number;
}