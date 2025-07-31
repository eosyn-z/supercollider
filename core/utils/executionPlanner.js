"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.batchSubtasksAdvanced = batchSubtasksAdvanced;
exports.batchSubtasks = batchSubtasks;
exports.planDispatch = planDispatch;
exports.detectDependencyCycles = detectDependencyCycles;
exports.validateBatching = validateBatching;
exports.optimizeBatches = optimizeBatches;
function batchSubtasksAdvanced(subtasks, config) {
    const cycleResult = detectDependencyCycles(subtasks);
    if (cycleResult.hasCycles) {
        subtasks = resolveDependencyCycles(subtasks, cycleResult);
    }
    const sortedSubtasks = config.respectDependencies ?
        topologicalSort(subtasks) : subtasks;
    const batches = [];
    const oversizedTasks = [];
    let currentBatch = [];
    let currentBatchTokens = 0;
    let totalTokens = 0;
    let dependencyViolations = 0;
    for (const subtask of sortedSubtasks) {
        const subtaskTokens = estimateTokenCount(subtask);
        totalTokens += subtaskTokens;
        if (subtaskTokens > config.maxTokensPerBatch) {
            oversizedTasks.push(subtask);
            continue;
        }
        const wouldExceedSize = currentBatch.length >= config.maxBatchSize;
        const wouldExceedTokens = currentBatchTokens + subtaskTokens > config.maxTokensPerBatch;
        const wouldViolateDependencies = config.respectDependencies &&
            !canSubtaskBeAddedToBatch(subtask, currentBatch, batches);
        if (wouldViolateDependencies) {
            dependencyViolations++;
        }
        if (wouldExceedSize || wouldExceedTokens ||
            (config.respectDependencies && wouldViolateDependencies)) {
            if (currentBatch.length > 0) {
                batches.push([...currentBatch]);
            }
            currentBatch = [subtask];
            currentBatchTokens = subtaskTokens;
        }
        else {
            currentBatch.push(subtask);
            currentBatchTokens += subtaskTokens;
        }
    }
    if (currentBatch.length > 0) {
        batches.push(currentBatch);
    }
    const finalBatches = config.balanceWorkloads ?
        balanceWorkloadAcrossBatches(batches) : batches;
    const batchStatistics = {
        averageBatchSize: finalBatches.length > 0 ?
            finalBatches.reduce((sum, batch) => sum + batch.length, 0) / finalBatches.length : 0,
        averageTokensPerBatch: finalBatches.length > 0 ?
            finalBatches.reduce((sum, batch) => sum + estimateBatchTokens(batch), 0) / finalBatches.length : 0,
        maxTokensInBatch: Math.max(...finalBatches.map(batch => estimateBatchTokens(batch)), 0),
        dependencyViolations
    };
    return {
        batches: finalBatches,
        oversizedTasks,
        totalTokenCount: totalTokens,
        batchStatistics
    };
}
function batchSubtasks(subtasks, range) {
    const sortedSubtasks = topologicalSort(subtasks);
    const batches = [];
    let currentBatch = [];
    for (const subtask of sortedSubtasks) {
        if (currentBatch.length >= range) {
            batches.push([...currentBatch]);
            currentBatch = [subtask];
        }
        else {
            const canAddToBatch = canSubtaskBeAddedToBatch(subtask, currentBatch, batches);
            if (canAddToBatch) {
                currentBatch.push(subtask);
            }
            else {
                if (currentBatch.length > 0) {
                    batches.push([...currentBatch]);
                }
                currentBatch = [subtask];
            }
        }
    }
    if (currentBatch.length > 0) {
        batches.push(currentBatch);
    }
    return batches;
}
function planDispatch(subtaskBatches, strategy, agents) {
    const assignedAgents = {};
    const dependencyTree = buildDependencyTree(subtaskBatches.flat());
    let estimatedTotalDuration = 0;
    if (strategy === 'parallel') {
        subtaskBatches.forEach((batch, index) => {
            const batchId = `batch_${index}`;
            const agentIndex = index % agents.length;
            const assignedAgent = agents[agentIndex];
            if (assignedAgent) {
                assignedAgents[batchId] = assignedAgent.id;
            }
            const batchDuration = calculateBatchDuration(batch);
            estimatedTotalDuration = Math.max(estimatedTotalDuration, batchDuration);
        });
    }
    else {
        const primaryAgent = agents[0];
        subtaskBatches.forEach((batch, index) => {
            const batchId = `batch_${index}`;
            assignedAgents[batchId] = primaryAgent?.id || 'default_agent';
            estimatedTotalDuration += calculateBatchDuration(batch);
        });
    }
    return {
        orderedBatches: subtaskBatches,
        assignedAgents,
        dependencyTree,
        estimatedTotalDuration
    };
}
function detectDependencyCycles(subtasks) {
    const cycles = [];
    const visited = new Set();
    const recursionStack = new Set();
    const subtaskMap = new Map(subtasks.map(task => [task.id, task]));
    const affectedSubtasks = new Set();
    function dfs(subtaskId, path) {
        if (recursionStack.has(subtaskId)) {
            const cycleStart = path.indexOf(subtaskId);
            const cycle = path.slice(cycleStart).concat([subtaskId]);
            cycles.push(cycle);
            cycle.forEach(id => affectedSubtasks.add(id));
            return;
        }
        if (visited.has(subtaskId)) {
            return;
        }
        const subtask = subtaskMap.get(subtaskId);
        if (!subtask) {
            return;
        }
        visited.add(subtaskId);
        recursionStack.add(subtaskId);
        path.push(subtaskId);
        for (const dependency of subtask.dependencies) {
            dfs(dependency.subtaskId, [...path]);
        }
        recursionStack.delete(subtaskId);
        path.pop();
    }
    for (const subtask of subtasks) {
        if (!visited.has(subtask.id)) {
            dfs(subtask.id, []);
        }
    }
    const suggestions = generateCycleResolutionSuggestions(cycles, subtaskMap);
    return {
        hasCycles: cycles.length > 0,
        cycles,
        affectedSubtasks: Array.from(affectedSubtasks),
        suggestions
    };
}
function resolveDependencyCycles(subtasks, cycleResult) {
    const resolvedSubtasks = subtasks.map(task => ({ ...task, dependencies: [...task.dependencies] }));
    const subtaskMap = new Map(resolvedSubtasks.map(task => [task.id, task]));
    for (const cycle of cycleResult.cycles) {
        let minCriticality = Infinity;
        let targetDepToBreak = null;
        for (let i = 0; i < cycle.length - 1; i++) {
            const fromId = cycle[i];
            const toId = cycle[i + 1];
            const fromTask = subtaskMap.get(fromId);
            if (fromTask) {
                const dependency = fromTask.dependencies.find(dep => dep.subtaskId === toId);
                if (dependency) {
                    const criticality = getDependencyCriticality(dependency);
                    if (criticality < minCriticality) {
                        minCriticality = criticality;
                        targetDepToBreak = { from: fromId, to: toId };
                    }
                }
            }
        }
        if (targetDepToBreak) {
            const task = subtaskMap.get(targetDepToBreak.from);
            if (task) {
                task.dependencies = task.dependencies.filter(dep => dep.subtaskId !== targetDepToBreak.to);
            }
        }
    }
    return resolvedSubtasks;
}
function topologicalSort(subtasks) {
    const cycleResult = detectDependencyCycles(subtasks);
    let workingSubtasks = subtasks;
    if (cycleResult.hasCycles) {
        workingSubtasks = resolveDependencyCycles(subtasks, cycleResult);
    }
    const result = [];
    const visited = new Set();
    const subtaskMap = new Map(workingSubtasks.map(task => [task.id, task]));
    function dfs(subtaskId) {
        if (visited.has(subtaskId)) {
            return;
        }
        const subtask = subtaskMap.get(subtaskId);
        if (!subtask) {
            return;
        }
        visited.add(subtaskId);
        for (const dependency of subtask.dependencies) {
            dfs(dependency.subtaskId);
        }
        result.push(subtask);
    }
    for (const subtask of workingSubtasks) {
        if (!visited.has(subtask.id)) {
            dfs(subtask.id);
        }
    }
    return result;
}
function canSubtaskBeAddedToBatch(subtask, currentBatch, completedBatches) {
    const processedSubtasks = new Set();
    for (const batch of completedBatches) {
        for (const task of batch) {
            processedSubtasks.add(task.id);
        }
    }
    for (const task of currentBatch) {
        processedSubtasks.add(task.id);
    }
    for (const dependency of subtask.dependencies) {
        if (dependency.type === 'BLOCKING' && !processedSubtasks.has(dependency.subtaskId)) {
            return false;
        }
    }
    return true;
}
function buildDependencyTree(subtasks) {
    const nodes = [];
    const nodeMap = new Map();
    for (const subtask of subtasks) {
        const node = {
            subtaskId: subtask.id,
            dependencies: subtask.dependencies.map(dep => dep.subtaskId),
            dependents: [],
            level: 0
        };
        nodes.push(node);
        nodeMap.set(subtask.id, node);
    }
    for (const node of nodes) {
        for (const depId of node.dependencies) {
            const depNode = nodeMap.get(depId);
            if (depNode) {
                depNode.dependents.push(node.subtaskId);
            }
        }
    }
    const visited = new Set();
    function calculateLevel(nodeId) {
        if (visited.has(nodeId)) {
            return nodeMap.get(nodeId)?.level || 0;
        }
        const node = nodeMap.get(nodeId);
        if (!node) {
            return 0;
        }
        visited.add(nodeId);
        let maxDepLevel = -1;
        for (const depId of node.dependencies) {
            maxDepLevel = Math.max(maxDepLevel, calculateLevel(depId));
        }
        node.level = maxDepLevel + 1;
        return node.level;
    }
    for (const node of nodes) {
        if (!visited.has(node.subtaskId)) {
            calculateLevel(node.subtaskId);
        }
    }
    return nodes;
}
function calculateBatchDuration(batch) {
    return batch.reduce((total, subtask) => {
        return total + (subtask.estimatedDuration || 20);
    }, 0);
}
function validateBatching(batches) {
    const processedSubtasks = new Set();
    for (const batch of batches) {
        for (const subtask of batch) {
            for (const dependency of subtask.dependencies) {
                if (dependency.type === 'BLOCKING' && !processedSubtasks.has(dependency.subtaskId)) {
                    return false;
                }
            }
        }
        for (const subtask of batch) {
            processedSubtasks.add(subtask.id);
        }
    }
    return true;
}
function estimateTokenCount(subtask) {
    const titleTokens = Math.ceil(subtask.title.length / 4);
    const descriptionTokens = Math.ceil(subtask.description.length / 4);
    const metadataTokens = subtask.metadata ?
        Math.ceil(JSON.stringify(subtask.metadata).length / 4) : 0;
    return titleTokens + descriptionTokens + metadataTokens + 50;
}
function estimateBatchTokens(batch) {
    return batch.reduce((total, subtask) => total + estimateTokenCount(subtask), 0);
}
function balanceWorkloadAcrossBatches(batches) {
    if (batches.length <= 1) {
        return batches;
    }
    const batchWorkloads = batches.map(batch => ({
        batch,
        duration: calculateBatchDuration(batch),
        tokens: estimateBatchTokens(batch)
    }));
    batchWorkloads.sort((a, b) => {
        const aLoad = a.duration + (a.tokens * 0.1);
        const bLoad = b.duration + (b.tokens * 0.1);
        return bLoad - aLoad;
    });
    const maxIterations = 10;
    for (let iteration = 0; iteration < maxIterations; iteration++) {
        const heaviest = batchWorkloads[0];
        const lightest = batchWorkloads[batchWorkloads.length - 1];
        const heavyLoad = heaviest.duration + (heaviest.tokens * 0.1);
        const lightLoad = lightest.duration + (lightest.tokens * 0.1);
        if (heavyLoad - lightLoad < heavyLoad * 0.2) {
            break;
        }
        if (heaviest.batch.length > 1) {
            const taskToMove = heaviest.batch.pop();
            if (taskToMove) {
                lightest.batch.push(taskToMove);
                heaviest.duration = calculateBatchDuration(heaviest.batch);
                heaviest.tokens = estimateBatchTokens(heaviest.batch);
                lightest.duration = calculateBatchDuration(lightest.batch);
                lightest.tokens = estimateBatchTokens(lightest.batch);
                batchWorkloads.sort((a, b) => {
                    const aLoad = a.duration + (a.tokens * 0.1);
                    const bLoad = b.duration + (b.tokens * 0.1);
                    return bLoad - aLoad;
                });
            }
        }
        else {
            break;
        }
    }
    return batchWorkloads.map(item => item.batch).filter(batch => batch.length > 0);
}
function getDependencyCriticality(dependency) {
    let score = 0;
    switch (dependency.type) {
        case 'BLOCKING':
            score += 10;
            break;
        case 'SOFT':
            score += 3;
            break;
        case 'REFERENCE':
            score += 1;
            break;
        default:
            score += 5;
    }
    switch (dependency.priority) {
        case 'HIGH':
            score += 5;
            break;
        case 'MEDIUM':
            score += 3;
            break;
        case 'LOW':
            score += 1;
            break;
    }
    return score;
}
function generateCycleResolutionSuggestions(cycles, subtaskMap) {
    const suggestions = [];
    for (let i = 0; i < cycles.length; i++) {
        const cycle = cycles[i];
        suggestions.push(`Cycle ${i + 1}: ${cycle.join(' → ')}`);
        let minCriticality = Infinity;
        let suggestedBreak = null;
        for (let j = 0; j < cycle.length - 1; j++) {
            const fromId = cycle[j];
            const toId = cycle[j + 1];
            const fromTask = subtaskMap.get(fromId);
            if (fromTask) {
                const dependency = fromTask.dependencies.find(dep => dep.subtaskId === toId);
                if (dependency) {
                    const criticality = getDependencyCriticality(dependency);
                    if (criticality < minCriticality) {
                        minCriticality = criticality;
                        suggestedBreak = { from: fromId, to: toId };
                    }
                }
            }
        }
        if (suggestedBreak) {
            suggestions.push(`  → Suggest breaking dependency: ${suggestedBreak.from} → ${suggestedBreak.to}`);
        }
    }
    return suggestions;
}
function optimizeBatches(batches, agents, strategy) {
    if (strategy === 'serial' || agents.length <= 1) {
        return batches;
    }
    const optimizedBatches = [];
    const agentWorkloads = new Array(agents.length).fill(0);
    for (const batch of batches) {
        const batchDuration = calculateBatchDuration(batch);
        const batchTokens = estimateBatchTokens(batch);
        const batchLoad = batchDuration + (batchTokens * 0.1);
        let minWorkloadIndex = 0;
        for (let i = 1; i < agentWorkloads.length; i++) {
            if (agentWorkloads[i] < agentWorkloads[minWorkloadIndex]) {
                minWorkloadIndex = i;
            }
        }
        agentWorkloads[minWorkloadIndex] += batchLoad;
        while (optimizedBatches.length <= minWorkloadIndex) {
            optimizedBatches.push([]);
        }
        optimizedBatches[minWorkloadIndex].push(...batch);
    }
    const nonEmptyBatches = optimizedBatches.filter(batch => batch.length > 0);
    return balanceWorkloadAcrossBatches(nonEmptyBatches);
}
//# sourceMappingURL=executionPlanner.js.map