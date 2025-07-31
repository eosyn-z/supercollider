/**
 * Agent management service
 */

import { v4 as uuidv4 } from 'uuid';

export interface Agent {
  id: string;
  name: string;
  apiKey: string;
  capabilities: AgentCapability[];
  performanceMetrics: AgentPerformanceMetrics;
  availability: boolean;
  costPerMinute: number;
}

export interface AgentCapability {
  name: string;
  category: 'RESEARCH' | 'ANALYSIS' | 'CREATION' | 'VALIDATION';
  proficiency: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';
}

export interface AgentPerformanceMetrics {
  averageCompletionTime: number;
  successRate: number;
  qualityScore: number;
  totalTasksCompleted: number;
  lastUpdated: Date;
}

export class AgentService {
  private agents: Map<string, Agent> = new Map();

  constructor() {
    this.initializeMockAgents();
  }

  private initializeMockAgents(): void {
    const mockAgents: Agent[] = [
      {
        id: 'agent-1',
        name: 'Claude-3 Opus',
        apiKey: 'sk-ant-mock-key-1',
        capabilities: [
          { name: 'Research', category: 'RESEARCH', proficiency: 'EXPERT' },
          { name: 'Analysis', category: 'ANALYSIS', proficiency: 'ADVANCED' }
        ],
        performanceMetrics: {
          averageCompletionTime: 45,
          successRate: 92,
          qualityScore: 88,
          totalTasksCompleted: 156,
          lastUpdated: new Date()
        },
        availability: true,
        costPerMinute: 0.15
      },
      {
        id: 'agent-2',
        name: 'GPT-4',
        apiKey: 'sk-mock-key-2',
        capabilities: [
          { name: 'Creation', category: 'CREATION', proficiency: 'EXPERT' },
          { name: 'Validation', category: 'VALIDATION', proficiency: 'ADVANCED' }
        ],
        performanceMetrics: {
          averageCompletionTime: 38,
          successRate: 89,
          qualityScore: 85,
          totalTasksCompleted: 243,
          lastUpdated: new Date()
        },
        availability: true,
        costPerMinute: 0.12
      },
      {
        id: 'agent-3',
        name: 'Gemini Pro',
        apiKey: 'mock-google-key-3',
        capabilities: [
          { name: 'Research', category: 'RESEARCH', proficiency: 'ADVANCED' },
          { name: 'Creation', category: 'CREATION', proficiency: 'INTERMEDIATE' }
        ],
        performanceMetrics: {
          averageCompletionTime: 52,
          successRate: 86,
          qualityScore: 82,
          totalTasksCompleted: 98,
          lastUpdated: new Date()
        },
        availability: false,
        costPerMinute: 0.08
      }
    ];

    mockAgents.forEach(agent => {
      this.agents.set(agent.id, agent);
    });

    console.log(`Initialized ${mockAgents.length} mock agents`);
  }

  async getAllAgents(): Promise<Agent[]> {
    return Array.from(this.agents.values());
  }

  async getAgent(agentId: string): Promise<Agent | null> {
    return this.agents.get(agentId) || null;
  }

  async createAgent(agentData: Omit<Agent, 'id'>): Promise<Agent> {
    const agentId = uuidv4();
    const agent: Agent = {
      ...agentData,
      id: agentId,
      performanceMetrics: {
        ...agentData.performanceMetrics,
        lastUpdated: new Date()
      }
    };

    this.agents.set(agentId, agent);

    // Mock API key validation for demo
    console.log(`Agent ${agentId} created with mock API key validation`);

    return agent;
  }

  async updateAgent(agentId: string, updates: Partial<Agent>): Promise<Agent | null> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return null;
    }

    const updatedAgent = {
      ...agent,
      ...updates,
      performanceMetrics: {
        ...agent.performanceMetrics,
        ...updates.performanceMetrics,
        lastUpdated: new Date()
      }
    };

    this.agents.set(agentId, updatedAgent);

    // Mock API key update for demo
    if (updates.apiKey) {
      console.log(`API key updated for agent ${agentId}`);
    }

    return updatedAgent;
  }

  async deleteAgent(agentId: string): Promise<boolean> {
    const deleted = this.agents.delete(agentId);
    if (deleted) {
      console.log(`Agent ${agentId} deleted`);
    }
    return deleted;
  }

  async validateApiKey(agentId: string, apiKey: string): Promise<boolean> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return false;
    }

    // Mock validation - always return true for demo
    return true;
  }

  async getAgentHealth(agentId: string): Promise<any | null> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return null;
    }

    return {
      agentId,
      status: agent.availability ? 'healthy' : 'unavailable',
      lastHealthCheck: new Date(),
      consecutiveFailures: 0,
      averageResponseTime: agent.performanceMetrics.averageCompletionTime,
      successRate: agent.performanceMetrics.successRate / 100,
      currentLoad: Math.random() * 0.5, // Mock current load
      capabilities: agent.capabilities.map(c => c.category)
    };
  }

  async getPerformanceMetrics(agentId: string): Promise<AgentPerformanceMetrics | null> {
    const agent = this.agents.get(agentId);
    return agent?.performanceMetrics || null;
  }

  async updatePerformanceMetrics(
    agentId: string, 
    metrics: Partial<AgentPerformanceMetrics>
  ): Promise<boolean> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return false;
    }

    agent.performanceMetrics = {
      ...agent.performanceMetrics,
      ...metrics,
      lastUpdated: new Date()
    };

    this.agents.set(agentId, agent);
    return true;
  }

  async getAvailableAgents(): Promise<Agent[]> {
    return Array.from(this.agents.values()).filter(agent => agent.availability);
  }

  async getAgentsByCapability(capability: string): Promise<Agent[]> {
    return Array.from(this.agents.values()).filter(agent =>
      agent.capabilities.some(cap => cap.category === capability)
    );
  }

  async setAgentAvailability(agentId: string, availability: boolean): Promise<boolean> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return false;
    }

    agent.availability = availability;
    this.agents.set(agentId, agent);
    
    console.log(`Agent ${agentId} availability set to ${availability}`);
    return true;
  }

  // Get agent statistics
  async getAgentStats(): Promise<any> {
    const agents = Array.from(this.agents.values());
    
    return {
      total: agents.length,
      available: agents.filter(a => a.availability).length,
      byCapability: this.getCapabilityDistribution(agents),
      averageSuccessRate: agents.length > 0 
        ? agents.reduce((sum, a) => sum + a.performanceMetrics.successRate, 0) / agents.length
        : 0,
      totalTasksCompleted: agents.reduce((sum, a) => sum + a.performanceMetrics.totalTasksCompleted, 0)
    };
  }

  private getCapabilityDistribution(agents: Agent[]): Record<string, number> {
    const distribution: Record<string, number> = {};
    
    agents.forEach(agent => {
      agent.capabilities.forEach(capability => {
        distribution[capability.category] = (distribution[capability.category] || 0) + 1;
      });
    });

    return distribution;
  }
}