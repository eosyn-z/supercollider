/**
 * Core types for AI agent registry and capability management
 */

export interface Agent {
  id: string;
  name: string;
  apiKey: string;
  capabilities: Capability[];
  performanceMetrics: PerformanceMetrics;
  availability: boolean;
  description?: string;
  costPerMinute?: number;
  maxConcurrentTasks?: number;
  createdAt?: Date;
  updatedAt?: Date;
  metadata?: Record<string, any>;
}

export interface Capability {
  name: string;
  category: CapabilityCategory;
  proficiency: ProficiencyLevel;
}

export enum CapabilityCategory {
  RESEARCH = 'RESEARCH',
  ANALYSIS = 'ANALYSIS',
  CREATION = 'CREATION',
  VALIDATION = 'VALIDATION'
}

export enum ProficiencyLevel {
  BEGINNER = 'BEGINNER',
  INTERMEDIATE = 'INTERMEDIATE',
  ADVANCED = 'ADVANCED',
  EXPERT = 'EXPERT'
}

export interface PerformanceMetrics {
  averageCompletionTime: number; // in minutes
  successRate: number; // percentage
  qualityScore: number; // 0-100
  totalTasksCompleted: number;
  lastUpdated: Date;
}

export interface AgentMatch {
  agentId: string;
  matchScore: number;
  notes?: string;
  estimatedCost?: number;
  estimatedDuration?: number;
}

export interface AgentAssignment {
  agentId: string;
  subtaskId: string;
  assignedAt?: Date;
  status?: string;
}

 