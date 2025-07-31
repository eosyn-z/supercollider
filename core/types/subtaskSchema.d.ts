export interface Subtask {
    id: string;
    title: string;
    description: string;
    type: SubtaskType;
    priority: Priority;
    status: SubtaskStatus;
    dependencies: SubtaskDependency[];
    result?: SubtaskResult;
    createdAt: Date;
    updatedAt: Date;
    estimatedDuration?: number;
    actualDuration?: number;
    assignedAgentId?: string;
    parentWorkflowId: string;
    requiredCapabilities?: string[];
    metadata?: Record<string, any>;
}
export declare enum SubtaskType {
    RESEARCH = "RESEARCH",
    ANALYSIS = "ANALYSIS",
    CREATION = "CREATION",
    VALIDATION = "VALIDATION"
}
export declare enum Priority {
    LOW = "LOW",
    MEDIUM = "MEDIUM",
    HIGH = "HIGH",
    CRITICAL = "CRITICAL"
}
export declare enum SubtaskStatus {
    PENDING = "PENDING",
    ASSIGNED = "ASSIGNED",
    IN_PROGRESS = "IN_PROGRESS",
    COMPLETED = "COMPLETED",
    FAILED = "FAILED",
    CANCELLED = "CANCELLED"
}
export interface SubtaskResult {
    content: string;
    metadata?: Record<string, any>;
    generatedAt: Date;
    agentId?: string;
    confidence?: number;
    errors?: string[];
    warnings?: string[];
}
export interface SubtaskDependency {
    subtaskId: string;
    type: 'BLOCKING' | 'SOFT_DEPENDENCY';
    description?: string;
}
//# sourceMappingURL=subtaskSchema.d.ts.map