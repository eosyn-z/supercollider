import { Workflow, Agent, UserAgent, EnhancedWorkflow, EnhancedExecutionState, MigrationUtility } from '../types/enhanced';
export declare class SupercolliderMigration implements MigrationUtility {
    private version;
    convertLegacyWorkflow(workflow: Workflow): EnhancedWorkflow;
    backfillAgentTags(agents: Agent[]): UserAgent[];
    migrateExecutionState(oldState: any): EnhancedExecutionState;
    private generateBatchGroups;
    private inferAgentTags;
    private mapLegacyStatus;
    private calculateProgress;
    private migrateBatches;
    private migrateSubtaskExecutions;
    private generateTimeline;
    private estimateBatchTime;
    static createMigrationGuide(): string;
    static validateMigration(originalWorkflows: Workflow[], migratedWorkflows: EnhancedWorkflow[]): {
        success: boolean;
        issues: string[];
    };
}
//# sourceMappingURL=migration.d.ts.map