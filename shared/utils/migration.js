"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupercolliderMigration = void 0;
const schema_1 = require("../config/schema");
class SupercolliderMigration {
    constructor() {
        this.version = '1.0.0';
    }
    convertLegacyWorkflow(workflow) {
        const enhanced = {
            ...workflow,
            batchGroups: this.generateBatchGroups(workflow),
            contextInjection: {
                enabled: true,
                config: schema_1.DEFAULT_INJECTION_CONFIG
            },
            parallelExecution: {
                enabled: true,
                maxConcurrency: 5,
                preferBatching: true
            },
            agentSelection: {
                strategy: 'auto',
                fallbackConfig: {
                    agentIds: [],
                    maxRetries: 3,
                    fallbackDelay: 1000
                }
            }
        };
        return enhanced;
    }
    backfillAgentTags(agents) {
        return agents.map(agent => {
            const tags = this.inferAgentTags(agent);
            return {
                ...agent,
                tags,
                enabled: agent.availability !== false,
                lastUsed: undefined,
                usageCount: agent.performanceMetrics?.totalTasksCompleted || 0
            };
        });
    }
    migrateExecutionState(oldState) {
        return {
            workflowId: oldState.workflowId || 'unknown',
            status: this.mapLegacyStatus(oldState.status),
            startTime: oldState.startTime ? new Date(oldState.startTime) : new Date(),
            endTime: oldState.endTime ? new Date(oldState.endTime) : undefined,
            runningSubtasks: oldState.runningSubtasks || [],
            completedSubtasks: oldState.completedSubtasks || [],
            failedSubtasks: oldState.failedSubtasks || [],
            haltedSubtasks: oldState.haltedSubtasks || [],
            queuedSubtasks: oldState.queuedSubtasks || [],
            retryCount: oldState.retryCount || {},
            errors: oldState.errors || [],
            progress: this.calculateProgress(oldState),
            haltReason: oldState.haltReason,
            batches: this.migrateBatches(oldState.batches),
            subtaskExecutions: this.migrateSubtaskExecutions(oldState.subtaskExecutions),
            timeline: this.generateTimeline(oldState)
        };
    }
    generateBatchGroups(workflow) {
        const batchGroups = [];
        const processedSubtasks = new Set();
        const subtaskMap = new Map(workflow.subtasks.map(s => [s.id, s]));
        for (const subtask of workflow.subtasks) {
            if (processedSubtasks.has(subtask.id))
                continue;
            const batchGroup = {
                groupId: `batch-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
                subtasks: [],
                estimatedExecutionTime: 0
            };
            const parallelSubtasks = workflow.subtasks.filter(s => {
                if (processedSubtasks.has(s.id))
                    return false;
                const hasBlockingDeps = s.dependencies?.some(dep => dep.type === 'BLOCKING' && !processedSubtasks.has(dep.subtaskId));
                return !hasBlockingDeps;
            });
            parallelSubtasks.forEach(subtask => {
                const batchableSubtask = {
                    ...subtask,
                    batchGroupId: batchGroup.groupId,
                    isBatchable: parallelSubtasks.length > 1,
                    injectedContext: subtask.description
                };
                batchGroup.subtasks.push(batchableSubtask);
                processedSubtasks.add(subtask.id);
            });
            if (batchGroup.subtasks.length > 0) {
                batchGroup.estimatedExecutionTime = this.estimateBatchTime(batchGroup.subtasks);
                batchGroups.push(batchGroup);
            }
        }
        return batchGroups;
    }
    inferAgentTags(agent) {
        const tags = [];
        const name = agent.name.toLowerCase();
        const description = agent.description?.toLowerCase() || '';
        if (name.includes('gpt') || name.includes('claude') || name.includes('text')) {
            tags.push('CREATION');
        }
        if (name.includes('research') || name.includes('search')) {
            tags.push('RESEARCH');
        }
        if (name.includes('code') || name.includes('programming')) {
            tags.push('CODEGEN');
        }
        if (name.includes('analysis') || name.includes('analyze')) {
            tags.push('ANALYSIS');
        }
        if (name.includes('translate') || name.includes('language')) {
            tags.push('TRANSLATION');
        }
        if (name.includes('image') || name.includes('dalle') || name.includes('vision')) {
            tags.push('IMAGE_GEN');
        }
        if (name.includes('speech') || name.includes('tts') || name.includes('voice')) {
            tags.push('TTS');
        }
        if (agent.capabilities) {
            agent.capabilities.forEach(capability => {
                const capName = capability.name.toLowerCase();
                if (capName.includes('creation') || capName.includes('generation')) {
                    if (!tags.includes('CREATION'))
                        tags.push('CREATION');
                }
                if (capName.includes('research') || capName.includes('search')) {
                    if (!tags.includes('RESEARCH'))
                        tags.push('RESEARCH');
                }
                if (capName.includes('analysis') || capName.includes('analyze')) {
                    if (!tags.includes('ANALYSIS'))
                        tags.push('ANALYSIS');
                }
                if (capName.includes('code') || capName.includes('programming')) {
                    if (!tags.includes('CODEGEN'))
                        tags.push('CODEGEN');
                }
            });
        }
        if (tags.length === 0) {
            tags.push('CREATION');
        }
        return tags;
    }
    mapLegacyStatus(oldStatus) {
        const statusMap = {
            'DRAFT': 'pending',
            'PLANNING': 'pending',
            'EXECUTING': 'running',
            'RUNNING': 'running',
            'COMPLETED': 'completed',
            'FAILED': 'failed',
            'PAUSED': 'paused',
            'HALTED': 'halted'
        };
        return statusMap[oldStatus] || 'pending';
    }
    calculateProgress(oldState) {
        const total = oldState.totalSubtasks || 0;
        const completed = oldState.completedSubtasks?.length || 0;
        const failed = oldState.failedSubtasks?.length || 0;
        const running = oldState.runningSubtasks?.length || 0;
        const halted = oldState.haltedSubtasks?.length || 0;
        const queued = Math.max(0, total - completed - failed - running - halted);
        return {
            total,
            completed,
            failed,
            inProgress: running,
            queued,
            halted
        };
    }
    migrateBatches(oldBatches = []) {
        return oldBatches.map(batch => ({
            batchId: batch.id || batch.batchId || `migrated-${Date.now()}`,
            subtaskIds: batch.subtasks?.map((s) => s.id) || batch.subtaskIds || [],
            status: this.mapLegacyStatus(batch.status),
            startTime: batch.startTime ? new Date(batch.startTime) : undefined,
            endTime: batch.endTime ? new Date(batch.endTime) : undefined,
            assignedAgents: batch.assignedAgents || [],
            retryCount: batch.retryCount || 0
        }));
    }
    migrateSubtaskExecutions(oldExecutions = {}) {
        const executions = {};
        Object.entries(oldExecutions).forEach(([subtaskId, execution]) => {
            executions[subtaskId] = {
                subtaskId,
                status: this.mapLegacyStatus(execution.status),
                assignedAgentId: execution.agentId || execution.assignedAgentId,
                startTime: execution.startTime ? new Date(execution.startTime) : undefined,
                endTime: execution.endTime ? new Date(execution.endTime) : undefined,
                estimatedDuration: execution.estimatedDuration,
                actualDuration: execution.actualDuration,
                retryCount: execution.retryCount || 0,
                lastError: execution.lastError,
                output: execution.output || execution.result?.content,
                confidence: execution.confidence || execution.result?.confidence
            };
        });
        return executions;
    }
    generateTimeline(oldState) {
        const timeline = [];
        if (oldState.startTime) {
            timeline.push({
                id: `start-${Date.now()}`,
                timestamp: new Date(oldState.startTime),
                type: 'execution-started',
                message: 'Workflow execution started',
                metadata: { migrated: true }
            });
        }
        if (oldState.endTime) {
            const eventType = oldState.status === 'COMPLETED' ? 'execution-completed' : 'execution-failed';
            timeline.push({
                id: `end-${Date.now()}`,
                timestamp: new Date(oldState.endTime),
                type: eventType,
                message: `Workflow execution ${oldState.status.toLowerCase()}`,
                metadata: { migrated: true }
            });
        }
        return timeline;
    }
    estimateBatchTime(subtasks) {
        if (subtasks.length === 0)
            return 0;
        const maxDuration = Math.max(...subtasks.map(s => s.estimatedDuration || 15));
        const overhead = Math.min(5, subtasks.length * 0.5);
        return maxDuration + overhead;
    }
    static createMigrationGuide() {
        return `
# Supercollider Migration Guide

## Overview
This guide helps you migrate from legacy Supercollider installations to the enhanced version with parallel batching, context injection, and improved agent management.

## Features Added
1. **Parallel Prompt Batching System**
   - Automatic identification of parallelizable subtasks
   - Concurrent execution with context isolation
   - Intelligent failure recovery

2. **Enhanced API Key Management**
   - Auto-detection of provider from key patterns
   - Tag-based agent categorization
   - Bulk import/export functionality

3. **Context Rehydration System**
   - Automatic context injection into subtask prompts
   - Configurable context inclusion rules
   - Smart context compression

## Migration Steps

### 1. Backup Existing Data
- Export current workflows
- Backup agent configurations
- Save execution history

### 2. Update Configuration
- Review new configuration options
- Set environment variables for customization
- Choose appropriate presets (development/production)

### 3. Migrate Data
\`\`\`typescript
import { SupercolliderMigration } from './shared/utils/migration';

const migration = new SupercolliderMigration();

// Migrate workflows
const enhancedWorkflows = legacyWorkflows.map(w => 
  migration.convertLegacyWorkflow(w)
);

// Migrate agents
const userAgents = migration.backfillAgentTags(legacyAgents);

// Migrate execution states
const enhancedStates = legacyStates.map(s => 
  migration.migrateExecutionState(s)
);
\`\`\`

### 4. Test Migration
- Verify all workflows are accessible
- Test agent functionality
- Validate execution states

### 5. Enable New Features
- Configure parallel batching settings
- Set up context injection preferences
- Review agent selection criteria

## Configuration Options

### Environment Variables
- \`SUPERCOLLIDER_MAX_CONCURRENT_BATCHES\`: Maximum parallel batches
- \`SUPERCOLLIDER_MAX_CONTEXT_LENGTH\`: Context injection limit  
- \`SUPERCOLLIDER_MAX_RETRIES\`: Retry attempts for failed tasks

### Presets
- \`development\`: Conservative settings for debugging
- \`production\`: Optimized for reliability and performance
- \`highThroughput\`: Maximum parallelization
- \`costOptimized\`: Sequential execution to minimize costs
- \`qualityFocused\`: Enhanced context and validation

## Rollback Plan
If issues occur, you can:
1. Disable new features via configuration
2. Restore from backup
3. Use compatibility mode

## Support
- Check logs for migration warnings
- Review error messages for guidance
- Contact support with specific issues
`;
    }
    static validateMigration(originalWorkflows, migratedWorkflows) {
        const issues = [];
        if (originalWorkflows.length !== migratedWorkflows.length) {
            issues.push('Workflow count mismatch after migration');
        }
        originalWorkflows.forEach((original, index) => {
            const migrated = migratedWorkflows[index];
            if (!migrated) {
                issues.push(`Missing migrated workflow for ${original.id}`);
                return;
            }
            if (original.subtasks.length !== migrated.subtasks.length) {
                issues.push(`Subtask count mismatch for workflow ${original.id}`);
            }
            if (!migrated.batchGroups || migrated.batchGroups.length === 0) {
                issues.push(`No batch groups generated for workflow ${original.id}`);
            }
        });
        return {
            success: issues.length === 0,
            issues
        };
    }
}
exports.SupercolliderMigration = SupercolliderMigration;
//# sourceMappingURL=migration.js.map