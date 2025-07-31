/**
 * Enhanced Agent Registry with auto-detection, tagging, and intelligent selection
 */

import { Agent } from '../../../core/types/agentRegistry';
import { AgentTag, UserAgent } from '../../../client/src/components/AgentKeysManager';

export interface AgentRequirements {
  taskType: string;
  priority: 'low' | 'medium' | 'high';
  estimatedComplexity: number;
  requiredCapabilities?: string[];
  preferredProviders?: string[];
  maxCost?: number;
  maxLatency?: number;
}

export class AgentRegistry {
  private agents: Map<string, UserAgent> = new Map();
  private providerPatterns: Map<string, RegExp[]> = new Map();
  private tagToCapabilityMap: Map<AgentTag, string[]> = new Map();

  constructor() {
    this.initializeProviderPatterns();
    this.initializeTagMappings();
  }

  /**
   * Initialize provider detection patterns
   */
  private initializeProviderPatterns(): void {
    this.providerPatterns.set('openai', [
      /^sk-[a-zA-Z0-9]{48,}$/,  // Standard OpenAI format
      /openai/i,                 // Contains "openai"
      /^sk-proj-[a-zA-Z0-9\-_]+$/ // Project API keys
    ]);

    this.providerPatterns.set('anthropic', [
      /^sk-ant-api03-[a-zA-Z0-9\-_]{95}$/,  // Anthropic format
      /^claude-[a-zA-Z0-9\-_]+$/,           // Claude prefix
      /anthropic/i                           // Contains "anthropic"
    ]);

    this.providerPatterns.set('google', [
      /^AIza[a-zA-Z0-9\-_]{35}$/,  // Google AI API key
      /google/i,                    // Contains "google"
      /gemini/i                     // Contains "gemini"
    ]);

    this.providerPatterns.set('groq', [
      /^gsk_[a-zA-Z0-9]{56}$/,     // Groq format
      /groq/i                       // Contains "groq"
    ]);

    this.providerPatterns.set('cohere', [
      /^[a-zA-Z0-9]{40}$/,         // Cohere format (40 char alphanumeric)
      /cohere/i                     // Contains "cohere"
    ]);
  }

  /**
   * Initialize tag to capability mappings
   */
  private initializeTagMappings(): void {
    this.tagToCapabilityMap.set('CREATION', ['text-generation', 'creative-writing', 'content-creation']);
    this.tagToCapabilityMap.set('RESEARCH', ['web-search', 'data-analysis', 'information-retrieval']);
    this.tagToCapabilityMap.set('TTS', ['text-to-speech', 'voice-synthesis', 'audio-generation']);
    this.tagToCapabilityMap.set('CODEGEN', ['code-generation', 'programming', 'software-development']);
    this.tagToCapabilityMap.set('IMAGE_GEN', ['image-generation', 'visual-creation', 'dalle', 'midjourney']);
    this.tagToCapabilityMap.set('ANALYSIS', ['data-analysis', 'text-analysis', 'sentiment-analysis']);
    this.tagToCapabilityMap.set('TRANSLATION', ['language-translation', 'multilingual', 'localization']);
  }

  /**
   * Enhanced provider detection with pattern matching
   */
  static detectProvider(apiKey: string): string {
    const registry = new AgentRegistry();
    
    for (const [provider, patterns] of registry.providerPatterns) {
      for (const pattern of patterns) {
        if (pattern.test(apiKey)) {
          return provider;
        }
      }
    }
    
    return 'custom';
  }

  /**
   * Validates API key format and makes test call
   */
  static async validateKey(apiKey: string, provider: string): Promise<boolean> {
    try {
      const registry = new AgentRegistry();
      const patterns = registry.providerPatterns.get(provider);
      
      if (!patterns) {
        // For custom providers, do basic validation
        return apiKey.length > 10;
      }

      // Check format first
      const formatValid = patterns.some(pattern => pattern.test(apiKey));
      if (!formatValid) {
        return false;
      }

      // Make a test API call
      return await registry.testApiCall(apiKey, provider);
    } catch (error) {
      console.error(`API key validation failed for ${provider}:`, error);
      return false;
    }
  }

  /**
   * Get agents filtered by tags
   */
  static getAgentsByTags(agents: UserAgent[], tags: AgentTag[]): UserAgent[] {
    if (tags.length === 0) {
      return agents;
    }

    return agents.filter(agent => 
      tags.some(tag => agent.tags.includes(tag)) && agent.enabled
    );
  }

  /**
   * Select optimal agent based on requirements
   */
  static selectOptimalAgent(
    agents: UserAgent[], 
    taskType: string, 
    requirements: AgentRequirements
  ): UserAgent | null {
    const registry = new AgentRegistry();
    
    // Filter by availability and enabled status
    let candidates = agents.filter(agent => agent.enabled && agent.availability);

    // Filter by required capabilities
    if (requirements.requiredCapabilities) {
      candidates = candidates.filter(agent => 
        requirements.requiredCapabilities!.every(capability =>
          agent.capabilities.some(cap => cap.name === capability)
        )
      );
    }

    // Filter by preferred providers
    if (requirements.preferredProviders) {
      const preferredCandidates = candidates.filter(agent =>
        requirements.preferredProviders!.includes(agent.provider)
      );
      if (preferredCandidates.length > 0) {
        candidates = preferredCandidates;
      }
    }

    // Filter by cost constraints
    if (requirements.maxCost) {
      candidates = candidates.filter(agent => agent.costPerMinute <= requirements.maxCost!);
    }

    if (candidates.length === 0) {
      return null;
    }

    // Score and rank candidates
    const scoredCandidates = candidates.map(agent => ({
      agent,
      score: registry.calculateAgentScore(agent, taskType, requirements)
    }));

    // Sort by score (highest first)
    scoredCandidates.sort((a, b) => b.score - a.score);

    return scoredCandidates[0].agent;
  }

  /**
   * Calculate agent suitability score
   */
  private calculateAgentScore(
    agent: UserAgent, 
    taskType: string, 
    requirements: AgentRequirements
  ): number {
    let score = 0;

    // Base score from performance metrics
    score += agent.performanceMetrics.successRate * 0.4;
    score += agent.performanceMetrics.qualityScore * 0.3;

    // Usage frequency bonus (agents used more often get slight preference)
    const usageBonus = Math.min(agent.usageCount * 0.1, 10);
    score += usageBonus;

    // Recency bonus (recently used agents get slight preference)
    if (agent.lastUsed) {
      const daysSinceUsed = (Date.now() - agent.lastUsed.getTime()) / (1000 * 60 * 60 * 24);
      const recencyBonus = Math.max(0, 5 - daysSinceUsed * 0.5);
      score += recencyBonus;
    }

    // Task type matching
    const relevantCapabilities = agent.capabilities.filter(cap => 
      cap.category.toString().toLowerCase() === taskType.toLowerCase()
    );
    
    if (relevantCapabilities.length > 0) {
      const avgProficiency = relevantCapabilities.reduce((sum, cap) => {
        const proficiencyScore = this.getProficiencyScore(cap.proficiency);
        return sum + proficiencyScore;
      }, 0) / relevantCapabilities.length;
      
      score += avgProficiency * 0.3;
    }

    // Tag matching bonus
    const taskTags = this.getTaskTags(taskType);
    const matchingTags = agent.tags.filter(tag => taskTags.includes(tag));
    score += matchingTags.length * 5;

    // Cost efficiency (lower cost is better, but not the primary factor)
    const costPenalty = agent.costPerMinute * 0.1;
    score -= costPenalty;

    // Priority adjustment
    if (requirements.priority === 'high') {
      // For high priority, prefer agents with higher success rates
      score += agent.performanceMetrics.successRate * 0.2;
    } else if (requirements.priority === 'low') {
      // For low priority, prefer cost-effective agents
      score -= agent.costPerMinute * 0.2;
    }

    return Math.max(0, score);
  }

  /**
   * Convert proficiency level to numeric score
   */
  private getProficiencyScore(proficiency: string): number {
    switch (proficiency.toUpperCase()) {
      case 'EXPERT': return 100;
      case 'ADVANCED': return 80;
      case 'INTERMEDIATE': return 60;
      case 'BEGINNER': return 40;
      default: return 50;
    }
  }

  /**
   * Get relevant tags for a task type
   */
  private getTaskTags(taskType: string): AgentTag[] {
    const taskTypeLower = taskType.toLowerCase();
    const relevantTags: AgentTag[] = [];

    if (taskTypeLower.includes('creat') || taskTypeLower.includes('generat')) {
      relevantTags.push('CREATION');
    }
    if (taskTypeLower.includes('research') || taskTypeLower.includes('search')) {
      relevantTags.push('RESEARCH');
    }
    if (taskTypeLower.includes('code') || taskTypeLower.includes('program')) {
      relevantTags.push('CODEGEN');
    }
    if (taskTypeLower.includes('analy') || taskTypeLower.includes('examine')) {
      relevantTags.push('ANALYSIS');
    }
    if (taskTypeLower.includes('translat') || taskTypeLower.includes('language')) {
      relevantTags.push('TRANSLATION');
    }
    if (taskTypeLower.includes('image') || taskTypeLower.includes('visual')) {
      relevantTags.push('IMAGE_GEN');
    }
    if (taskTypeLower.includes('speech') || taskTypeLower.includes('audio')) {
      relevantTags.push('TTS');
    }

    return relevantTags;
  }

  /**
   * Test API call to validate key
   */
  private async testApiCall(apiKey: string, provider: string): Promise<boolean> {
    try {
      const endpoints = this.getProviderEndpoints();
      const endpoint = endpoints[provider];
      
      if (!endpoint) {
        return false; // Unknown provider
      }

      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...endpoint.headers,
          [endpoint.authHeader]: endpoint.authFormat.replace('{key}', apiKey)
        },
        body: JSON.stringify(endpoint.testPayload)
      });

      // Consider both success and certain error codes as valid (key exists but quota/limits)
      return response.status < 500 && response.status !== 401 && response.status !== 403;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get provider endpoint configurations
   */
  private getProviderEndpoints(): Record<string, any> {
    return {
      openai: {
        url: 'https://api.openai.com/v1/chat/completions',
        headers: {},
        authHeader: 'Authorization',
        authFormat: 'Bearer {key}',
        testPayload: {
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 1
        }
      },
      anthropic: {
        url: 'https://api.anthropic.com/v1/messages',
        headers: { 'anthropic-version': '2023-06-01' },
        authHeader: 'x-api-key',
        authFormat: '{key}',
        testPayload: {
          model: 'claude-3-haiku-20240307',
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 1
        }
      },
      google: {
        url: 'https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent',
        headers: {},
        authHeader: 'Authorization',
        authFormat: 'Bearer {key}',
        testPayload: {
          contents: [{ parts: [{ text: 'test' }] }],
          generationConfig: { maxOutputTokens: 1 }
        }
      },
      groq: {
        url: 'https://api.groq.com/openai/v1/chat/completions',
        headers: {},
        authHeader: 'Authorization',
        authFormat: 'Bearer {key}',
        testPayload: {
          model: 'mixtral-8x7b-32768',
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 1
        }
      }
    };
  }

  /**
   * Register a new agent
   */
  registerAgent(agent: UserAgent): void {
    this.agents.set(agent.id, agent);
  }

  /**
   * Update agent usage statistics
   */
  updateAgentUsage(agentId: string, success: boolean): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.usageCount++;
      agent.lastUsed = new Date();
      
      // Update performance metrics
      const metrics = agent.performanceMetrics;
      const totalTasks = metrics.totalTasksCompleted + 1;
      const newSuccessRate = ((metrics.successRate * metrics.totalTasksCompleted) + (success ? 100 : 0)) / totalTasks;
      
      metrics.totalTasksCompleted = totalTasks;
      metrics.successRate = newSuccessRate;
      metrics.lastUpdated = new Date();
    }
  }

  /**
   * Get all registered agents
   */
  getAllAgents(): UserAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get agent by ID
   */
  getAgent(agentId: string): UserAgent | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Remove agent
   */
  removeAgent(agentId: string): boolean {
    return this.agents.delete(agentId);
  }

  /**
   * Get agents by provider
   */
  getAgentsByProvider(provider: string): UserAgent[] {
    return Array.from(this.agents.values()).filter(agent => agent.provider === provider);
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(): {
    totalAgents: number;
    activeAgents: number;
    averageSuccessRate: number;
    totalUsage: number;
    providerDistribution: Record<string, number>;
    tagDistribution: Record<AgentTag, number>;
  } {
    const agents = this.getAllAgents();
    const activeAgents = agents.filter(a => a.enabled);
    
    const providerDistribution: Record<string, number> = {};
    const tagDistribution: Record<AgentTag, number> = {};
    
    let totalSuccessRate = 0;
    let totalUsage = 0;
    
    agents.forEach(agent => {
      // Provider distribution
      providerDistribution[agent.provider] = (providerDistribution[agent.provider] || 0) + 1;
      
      // Tag distribution
      agent.tags.forEach(tag => {
        tagDistribution[tag] = (tagDistribution[tag] || 0) + 1;
      });
      
      totalSuccessRate += agent.performanceMetrics.successRate;
      totalUsage += agent.usageCount;
    });
    
    return {
      totalAgents: agents.length,
      activeAgents: activeAgents.length,
      averageSuccessRate: agents.length > 0 ? totalSuccessRate / agents.length : 0,
      totalUsage,
      providerDistribution,
      tagDistribution
    };
  }
}