"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseResultStore = exports.InMemoryResultStore = void 0;
const executionTypes_1 = require("../types/executionTypes");
class InMemoryResultStore {
    constructor() {
        this.subtaskResults = new Map();
        this.executionStates = new Map();
        this.batchMetadata = new Map();
        this.workflowIndex = new Map();
        this.executionOrderCounter = 0;
    }
    async saveSubtaskResult(result) {
        result.storageTimestamp = new Date();
        result.checksum = this.calculateChecksum(result);
        this.subtaskResults.set(result.subtaskId, result);
        const workflowSubtasks = this.workflowIndex.get(result.workflowId) || [];
        if (!workflowSubtasks.includes(result.subtaskId)) {
            workflowSubtasks.push(result.subtaskId);
            this.workflowIndex.set(result.workflowId, workflowSubtasks);
        }
    }
    async updateSubtaskStatus(subtaskId, status) {
        const result = this.subtaskResults.get(subtaskId);
        if (result) {
            result.status = status;
            result.storageTimestamp = new Date();
            result.checksum = this.calculateChecksum(result);
            this.subtaskResults.set(subtaskId, result);
        }
    }
    async getSubtaskResult(subtaskId) {
        return this.subtaskResults.get(subtaskId) || null;
    }
    async saveExecutionState(state) {
        this.executionStates.set(state.workflowId, { ...state });
    }
    async loadExecutionState(workflowId) {
        return this.executionStates.get(workflowId) || null;
    }
    async getWorkflowResults(workflowId) {
        const subtaskIds = this.workflowIndex.get(workflowId) || [];
        const subtaskResults = subtaskIds
            .map(id => this.subtaskResults.get(id))
            .filter((result) => result !== undefined)
            .sort((a, b) => a.executionOrder - b.executionOrder);
        const batchIds = [...new Set(subtaskResults.map(r => r.batchId))];
        const batchMetadata = batchIds
            .map(id => this.batchMetadata.get(id))
            .filter((batch) => batch !== undefined);
        const executionOrder = subtaskResults.map(r => r.executionOrder);
        const totalDuration = subtaskResults.reduce((sum, r) => sum + r.executionTime, 0);
        const completedAt = subtaskResults.length > 0 ?
            new Date(Math.max(...subtaskResults.map(r => r.storageTimestamp.getTime()))) :
            undefined;
        return {
            workflowId,
            subtaskResults,
            batchMetadata,
            executionOrder,
            totalDuration,
            completedAt
        };
    }
    async saveBatchMetadata(metadata) {
        this.batchMetadata.set(metadata.batchId, { ...metadata });
    }
    async updateBatchStatus(batchId, status) {
        const metadata = this.batchMetadata.get(batchId);
        if (metadata) {
            metadata.status = status;
            if (status === 'completed' || status === 'failed') {
                metadata.endTime = new Date();
            }
            this.batchMetadata.set(batchId, metadata);
        }
    }
    async getBatchResults(batchId) {
        return Array.from(this.subtaskResults.values())
            .filter(result => result.batchId === batchId)
            .sort((a, b) => a.executionOrder - b.executionOrder);
    }
    async queryResults(query) {
        let results = Array.from(this.subtaskResults.values());
        if (query.workflowId) {
            results = results.filter(r => r.workflowId === query.workflowId);
        }
        if (query.subtaskId) {
            results = results.filter(r => r.subtaskId === query.subtaskId);
        }
        if (query.batchId) {
            results = results.filter(r => r.batchId === query.batchId);
        }
        if (query.status) {
            results = results.filter(r => r.status === query.status);
        }
        if (query.agentId) {
            results = results.filter(r => r.agentId === query.agentId);
        }
        if (query.dateRange) {
            results = results.filter(r => r.storageTimestamp >= query.dateRange.start &&
                r.storageTimestamp <= query.dateRange.end);
        }
        results.sort((a, b) => a.executionOrder - b.executionOrder);
        if (query.offset) {
            results = results.slice(query.offset);
        }
        if (query.limit) {
            results = results.slice(0, query.limit);
        }
        return results;
    }
    async getReintegrationData(workflowId) {
        const workflowResults = await this.getWorkflowResults(workflowId);
        const dependencyGraph = this.buildDependencyGraph(workflowResults.subtaskResults);
        const completed = workflowResults.subtaskResults.filter(r => r.status === executionTypes_1.ExecutionStatus.COMPLETED).length;
        const failed = workflowResults.subtaskResults.filter(r => r.status === executionTypes_1.ExecutionStatus.FAILED).length;
        const averageExecutionTime = workflowResults.subtaskResults.length > 0 ?
            workflowResults.totalDuration / workflowResults.subtaskResults.length : 0;
        const executionSummary = {
            totalSubtasks: workflowResults.subtaskResults.length,
            completed,
            failed,
            totalDuration: workflowResults.totalDuration,
            averageExecutionTime
        };
        return {
            workflowId,
            subtaskResults: workflowResults.subtaskResults,
            executionOrder: workflowResults.executionOrder,
            dependencyGraph,
            batchMetadata: workflowResults.batchMetadata,
            executionSummary
        };
    }
    async cleanup(olderThan) {
        let cleaned = 0;
        for (const [id, result] of this.subtaskResults.entries()) {
            if (result.storageTimestamp < olderThan) {
                this.subtaskResults.delete(id);
                cleaned++;
            }
        }
        for (const [id, state] of this.executionStates.entries()) {
            if (state.startTime < olderThan) {
                this.executionStates.delete(id);
                cleaned++;
            }
        }
        for (const [id, metadata] of this.batchMetadata.entries()) {
            if (metadata.startTime < olderThan) {
                this.batchMetadata.delete(id);
                cleaned++;
            }
        }
        this.rebuildWorkflowIndex();
        return cleaned;
    }
    async validateIntegrity(workflowId) {
        const subtaskIds = this.workflowIndex.get(workflowId) || [];
        for (const subtaskId of subtaskIds) {
            const result = this.subtaskResults.get(subtaskId);
            if (!result) {
                return false;
            }
            const expectedChecksum = this.calculateChecksum(result);
            if (result.checksum !== expectedChecksum) {
                return false;
            }
            for (const depId of result.dependencyChain) {
                if (!this.subtaskResults.has(depId)) {
                    return false;
                }
            }
        }
        return true;
    }
    createStoredResult(result, workflowId, batchId, batchIndex, dependencyChain = [], parentSubtaskIds = [], childSubtaskIds = [], executionLevel = 0) {
        const executionOrder = ++this.executionOrderCounter;
        return {
            ...result,
            workflowId,
            batchId,
            batchIndex,
            executionOrder,
            dependencyChain,
            parentSubtaskIds,
            childSubtaskIds,
            executionLevel,
            storageTimestamp: new Date(),
            checksum: ''
        };
    }
    buildDependencyGraph(results) {
        const nodes = [];
        const resultMap = new Map(results.map(r => [r.subtaskId, r]));
        for (const result of results) {
            const node = {
                subtaskId: result.subtaskId,
                dependencies: result.parentSubtaskIds,
                dependents: result.childSubtaskIds,
                level: result.executionLevel
            };
            nodes.push(node);
        }
        return nodes;
    }
    calculateChecksum(result) {
        const data = JSON.stringify({
            subtaskId: result.subtaskId,
            agentId: result.agentId,
            status: result.status,
            executionTime: result.executionTime,
            retryCount: result.retryCount,
            content: result.result?.content
        });
        let hash = 0;
        for (let i = 0; i < data.length; i++) {
            const char = data.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(36);
    }
    rebuildWorkflowIndex() {
        this.workflowIndex.clear();
        for (const result of this.subtaskResults.values()) {
            const workflowSubtasks = this.workflowIndex.get(result.workflowId) || [];
            if (!workflowSubtasks.includes(result.subtaskId)) {
                workflowSubtasks.push(result.subtaskId);
                this.workflowIndex.set(result.workflowId, workflowSubtasks);
            }
        }
    }
}
exports.InMemoryResultStore = InMemoryResultStore;
class DatabaseResultStore {
    constructor(dbConnection) {
        this.dbConnection = dbConnection;
    }
    async saveSubtaskResult(result) {
        throw new Error('DatabaseResultStore not implemented - use InMemoryResultStore for now');
    }
    async updateSubtaskStatus(subtaskId, status) {
        throw new Error('DatabaseResultStore not implemented');
    }
    async getSubtaskResult(subtaskId) {
        throw new Error('DatabaseResultStore not implemented');
    }
    async saveExecutionState(state) {
        throw new Error('DatabaseResultStore not implemented');
    }
    async loadExecutionState(workflowId) {
        throw new Error('DatabaseResultStore not implemented');
    }
    async getWorkflowResults(workflowId) {
        throw new Error('DatabaseResultStore not implemented');
    }
    async saveBatchMetadata(metadata) {
        throw new Error('DatabaseResultStore not implemented');
    }
    async updateBatchStatus(batchId, status) {
        throw new Error('DatabaseResultStore not implemented');
    }
    async getBatchResults(batchId) {
        throw new Error('DatabaseResultStore not implemented');
    }
    async queryResults(query) {
        throw new Error('DatabaseResultStore not implemented');
    }
    async getReintegrationData(workflowId) {
        throw new Error('DatabaseResultStore not implemented');
    }
    async cleanup(olderThan) {
        throw new Error('DatabaseResultStore not implemented');
    }
    async validateIntegrity(workflowId) {
        throw new Error('DatabaseResultStore not implemented');
    }
}
exports.DatabaseResultStore = DatabaseResultStore;
//# sourceMappingURL=resultStore.js.map