import { EventEmitter } from 'events';
import { WorkflowIntent, AtomicWorkflow, AtomicTask, DecompositionContext } from '../../../shared/types/atomicWorkflow';
import { FileMetadata } from '../../../shared/types/fileManagement';
interface RuntimeResource {
    id: string;
    type: 'agent' | 'service' | 'capability' | 'tool';
    name: string;
    availability: 'available' | 'busy' | 'unavailable';
    capabilities: string[];
    performance: {
        speed: number;
        quality: number;
        reliability: number;
    };
    cost: number;
    metadata: Record<string, any>;
}
interface WorkflowOptimization {
    parallelization: number;
    resourceUtilization: number;
    estimatedTime: number;
    estimatedCost: number;
    qualityScore: number;
    feasibilityScore: number;
}
export declare class RuntimeWorkflowGenerator extends EventEmitter {
    private decomposer;
    private availableResources;
    private workflowCache;
    private optimizationCache;
    constructor();
    generateWorkflowFromIntent(intent: WorkflowIntent, availableFiles: FileMetadata[]): Promise<AtomicWorkflow>;
    decomposeComplexTask(taskDescription: string, context: DecompositionContext): Promise<AtomicTask[]>;
    optimizeWorkflowExecution(workflow: AtomicWorkflow, availableResources?: RuntimeResource[], intent?: WorkflowIntent): Promise<AtomicWorkflow>;
    registerResource(resource: RuntimeResource): void;
    updateResourceAvailability(resourceId: string, availability: RuntimeResource['availability']): void;
    getRuntimeMetrics(workflowId: string): Promise<WorkflowOptimization>;
    private initializeDefaultResources;
    private findCompatibleResources;
    private createWorkflowContext;
    private createIntentFromDescription;
    private applyContextCustomizations;
    private optimizeTaskDependencies;
    private optimizeTaskAssignment;
    private optimizeParallelization;
    private applyConstraintOptimizations;
    private calculateOptimizedDuration;
    private calculateResourceScore;
    private hasTaskDependency;
    private validateWorkflowFeasibility;
    private calculateWorkflowMetrics;
    private generateOptimizationReport;
    private generateResourceAssignments;
    private generateCacheKey;
    private hashString;
    private cloneWorkflow;
    private clearAffectedCaches;
    private extractRequiredCapabilities;
    private detectOutputTypeFromDescription;
    private assessDescriptionComplexity;
    private extractRequirementsFromDescription;
    private getDefaultPreferences;
}
export default RuntimeWorkflowGenerator;
//# sourceMappingURL=runtimeWorkflowGenerator.d.ts.map