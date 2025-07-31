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
export declare enum CapabilityCategory {
    RESEARCH = "RESEARCH",
    ANALYSIS = "ANALYSIS",
    CREATION = "CREATION",
    VALIDATION = "VALIDATION"
}
export declare enum ProficiencyLevel {
    BEGINNER = "BEGINNER",
    INTERMEDIATE = "INTERMEDIATE",
    ADVANCED = "ADVANCED",
    EXPERT = "EXPERT"
}
export interface PerformanceMetrics {
    averageCompletionTime: number;
    successRate: number;
    qualityScore: number;
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
//# sourceMappingURL=agentRegistry.d.ts.map