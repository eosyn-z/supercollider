"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuntimeWorkflowGenerator = void 0;
const events_1 = require("events");
const atomicDecomposer_1 = require("./atomicDecomposer");
class RuntimeWorkflowGenerator extends events_1.EventEmitter {
    constructor() {
        super();
        this.availableResources = new Map();
        this.workflowCache = new Map();
        this.optimizationCache = new Map();
        this.decomposer = new atomicDecomposer_1.AtomicDecomposer();
        this.initializeDefaultResources();
    }
    async generateWorkflowFromIntent(intent, availableFiles) {
        const startTime = Date.now();
        try {
            const cacheKey = this.generateCacheKey(intent, availableFiles);
            if (this.workflowCache.has(cacheKey)) {
                const cachedWorkflow = this.workflowCache.get(cacheKey);
                this.emit('workflow-cache-hit', { cacheKey, workflowId: cachedWorkflow.id });
                return this.cloneWorkflow(cachedWorkflow);
            }
            const compatibleResources = this.findCompatibleResources(intent);
            const baseWorkflow = await this.decomposer.decomposeWorkflow(intent.primaryGoal, availableFiles, this.createWorkflowContext(intent));
            const optimizedWorkflow = await this.optimizeWorkflowExecution(baseWorkflow, compatibleResources, intent);
            const validation = await this.validateWorkflowFeasibility(optimizedWorkflow, compatibleResources);
            if (!validation.isValid) {
                throw new Error(`Workflow generation failed: ${validation.errors.map(e => e.message).join(', ')}`);
            }
            this.workflowCache.set(cacheKey, optimizedWorkflow);
            this.emit('workflow-generated', {
                workflowId: optimizedWorkflow.id,
                taskCount: optimizedWorkflow.atomicTasks.length,
                estimatedDuration: optimizedWorkflow.estimatedDuration,
                processingTime: Date.now() - startTime
            });
            return optimizedWorkflow;
        }
        catch (error) {
            this.emit('workflow-generation-error', { error, intent, processingTime: Date.now() - startTime });
            throw error;
        }
    }
    async decomposeComplexTask(taskDescription, context) {
        const intent = await this.createIntentFromDescription(taskDescription, context);
        const atomicTasks = await this.decomposer.generateRuntimeDecomposition(intent, Array.from(this.availableResources.values()));
        const customizedTasks = this.applyContextCustomizations(atomicTasks, context);
        const optimizedTasks = this.optimizeTaskDependencies(customizedTasks);
        return optimizedTasks;
    }
    async optimizeWorkflowExecution(workflow, availableResources, intent) {
        const resources = availableResources || Array.from(this.availableResources.values());
        const optimizedWorkflow = {
            ...workflow,
            id: `opt_${workflow.id}`,
            atomicTasks: [...workflow.atomicTasks],
            executionGraph: { ...workflow.executionGraph }
        };
        optimizedWorkflow.atomicTasks = await this.optimizeTaskAssignment(optimizedWorkflow.atomicTasks, resources);
        optimizedWorkflow.executionGraph = this.optimizeParallelization(optimizedWorkflow.executionGraph, optimizedWorkflow.atomicTasks);
        if (intent?.constraints) {
            optimizedWorkflow.atomicTasks = this.applyConstraintOptimizations(optimizedWorkflow.atomicTasks, intent.constraints);
        }
        optimizedWorkflow.estimatedDuration = this.calculateOptimizedDuration(optimizedWorkflow.atomicTasks, optimizedWorkflow.executionGraph);
        optimizedWorkflow.metadata = {
            ...optimizedWorkflow.metadata,
            optimizations: this.generateOptimizationReport(workflow, optimizedWorkflow),
            resourceAssignments: this.generateResourceAssignments(optimizedWorkflow.atomicTasks, resources)
        };
        return optimizedWorkflow;
    }
    registerResource(resource) {
        this.availableResources.set(resource.id, resource);
        this.emit('resource-registered', { resourceId: resource.id, type: resource.type });
        this.optimizationCache.clear();
    }
    updateResourceAvailability(resourceId, availability) {
        const resource = this.availableResources.get(resourceId);
        if (resource) {
            resource.availability = availability;
            this.emit('resource-availability-changed', { resourceId, availability });
            this.clearAffectedCaches(resourceId);
        }
    }
    async getRuntimeMetrics(workflowId) {
        const cacheKey = `metrics_${workflowId}`;
        if (this.optimizationCache.has(cacheKey)) {
            return this.optimizationCache.get(cacheKey);
        }
        const workflow = this.workflowCache.get(workflowId);
        if (!workflow) {
            throw new Error(`Workflow not found: ${workflowId}`);
        }
        const metrics = this.calculateWorkflowMetrics(workflow);
        this.optimizationCache.set(cacheKey, metrics);
        return metrics;
    }
    initializeDefaultResources() {
        this.registerResource({
            id: 'text_generator_01',
            type: 'service',
            name: 'Advanced Text Generator',
            availability: 'available',
            capabilities: ['text_generation', 'creative_writing', 'script_formatting'],
            performance: { speed: 8, quality: 9, reliability: 9 },
            cost: 0.05,
            metadata: { model: 'gpt-4', provider: 'openai' }
        });
        this.registerResource({
            id: 'image_generator_01',
            type: 'service',
            name: 'AI Image Generator',
            availability: 'available',
            capabilities: ['image_generation', 'style_transfer', 'ai_models'],
            performance: { speed: 6, quality: 9, reliability: 8 },
            cost: 0.10,
            metadata: { model: 'dall-e-3', provider: 'openai' }
        });
        this.registerResource({
            id: 'video_processor_01',
            type: 'service',
            name: 'Video Processing Service',
            availability: 'available',
            capabilities: ['video_editing', 'ffmpeg', 'compositing', 'rendering'],
            performance: { speed: 7, quality: 8, reliability: 9 },
            cost: 0.15,
            metadata: { gpu_enabled: true, max_resolution: '4k' }
        });
        this.registerResource({
            id: 'audio_processor_01',
            type: 'service',
            name: 'Audio Processing Service',
            availability: 'available',
            capabilities: ['text_to_speech', 'audio_generation', 'audio_enhancement'],
            performance: { speed: 8, quality: 8, reliability: 9 },
            cost: 0.08,
            metadata: { voices_available: 50, languages: 25 }
        });
        this.registerResource({
            id: 'analysis_service_01',
            type: 'service',
            name: 'Content Analysis Service',
            availability: 'available',
            capabilities: ['nlp', 'content_analysis', 'computer_vision', 'object_detection'],
            performance: { speed: 9, quality: 8, reliability: 9 },
            cost: 0.06,
            metadata: { supports_multimodal: true }
        });
    }
    findCompatibleResources(intent) {
        const requiredCapabilities = this.extractRequiredCapabilities(intent);
        return Array.from(this.availableResources.values()).filter(resource => {
            if (resource.availability !== 'available')
                return false;
            return requiredCapabilities.some(cap => resource.capabilities.includes(cap));
        });
    }
    createWorkflowContext(intent) {
        return {
            userId: intent.context?.userId || 'anonymous',
            sessionId: `session_${Date.now()}`,
            preferences: intent.context?.preferences || this.getDefaultPreferences(),
            constraints: intent.constraints || []
        };
    }
    async createIntentFromDescription(description, context) {
        const outputType = this.detectOutputTypeFromDescription(description);
        const complexity = this.assessDescriptionComplexity(description);
        return {
            primaryGoal: description,
            outputType,
            complexity,
            requirements: this.extractRequirementsFromDescription(description),
            constraints: context.constraints || [],
            userFiles: [],
            context: context.userPreferences ? {
                userId: 'runtime_user',
                preferences: context.userPreferences
            } : undefined,
            confidence: 0.8
        };
    }
    applyContextCustomizations(tasks, context) {
        return tasks.map(task => {
            const customizedTask = { ...task };
            if (context.userPreferences.speedPriority > 7) {
                customizedTask.complexity = 'simple';
                customizedTask.estimatedDuration *= 0.7;
            }
            if (context.userPreferences.qualityLevel === 'premium') {
                customizedTask.complexity = 'complex';
                customizedTask.estimatedDuration *= 1.3;
            }
            for (const constraint of context.constraints) {
                if (constraint.type === 'time' && constraint.priority === 'critical') {
                    customizedTask.estimatedDuration *= 0.6;
                    customizedTask.priority += 2;
                }
            }
            return customizedTask;
        });
    }
    optimizeTaskDependencies(tasks) {
        const optimizedTasks = tasks.map(task => ({ ...task }));
        for (const task of optimizedTasks) {
            const directDeps = new Set(task.dependencies);
            const transitiveDeps = new Set();
            for (const depId of task.dependencies) {
                const depTask = optimizedTasks.find(t => t.id === depId);
                if (depTask) {
                    for (const transitiveDep of depTask.dependencies) {
                        transitiveDeps.add(transitiveDep);
                    }
                }
            }
            task.dependencies = Array.from(directDeps).filter(dep => !transitiveDeps.has(dep));
        }
        return optimizedTasks;
    }
    async optimizeTaskAssignment(tasks, resources) {
        return tasks.map(task => {
            const compatibleResources = resources.filter(resource => task.requiredCapabilities.some(cap => resource.capabilities.includes(cap)));
            if (compatibleResources.length > 0) {
                const bestResource = compatibleResources.reduce((best, current) => {
                    const bestScore = this.calculateResourceScore(best, task);
                    const currentScore = this.calculateResourceScore(current, task);
                    return currentScore > bestScore ? current : best;
                });
                task.metadata = {
                    ...task.metadata,
                    assignedResource: bestResource.id,
                    performanceMultiplier: bestResource.performance.speed / 10,
                    qualityMultiplier: bestResource.performance.quality / 10,
                    estimatedCost: bestResource.cost * (task.estimatedDuration / 1000)
                };
                task.estimatedDuration = Math.round(task.estimatedDuration * (10 / bestResource.performance.speed));
            }
            return task;
        });
    }
    optimizeParallelization(executionGraph, tasks) {
        const optimizedGraph = { ...executionGraph };
        const taskMap = new Map(tasks.map(t => [t.id, t]));
        const newBatches = [];
        const processedTasks = new Set();
        for (const task of tasks) {
            if (processedTasks.has(task.id) || !task.canRunInParallel)
                continue;
            const batch = [task.id];
            processedTasks.add(task.id);
            for (const otherTask of tasks) {
                if (processedTasks.has(otherTask.id) || !otherTask.canRunInParallel)
                    continue;
                if (!this.hasTaskDependency(task.id, otherTask.id, tasks) &&
                    !this.hasTaskDependency(otherTask.id, task.id, tasks)) {
                    batch.push(otherTask.id);
                    processedTasks.add(otherTask.id);
                }
            }
            if (batch.length > 1) {
                newBatches.push(batch);
            }
        }
        optimizedGraph.parallelBatches = newBatches;
        return optimizedGraph;
    }
    applyConstraintOptimizations(tasks, constraints) {
        return tasks.map(task => {
            const optimizedTask = { ...task };
            for (const constraint of constraints) {
                switch (constraint.type) {
                    case 'time':
                        if (constraint.priority === 'critical') {
                            optimizedTask.complexity = 'simple';
                            optimizedTask.estimatedDuration *= 0.5;
                        }
                        break;
                    case 'quality':
                        if (constraint.priority === 'critical') {
                            optimizedTask.complexity = 'complex';
                            optimizedTask.estimatedDuration *= 1.5;
                        }
                        break;
                    case 'resource':
                        optimizedTask.canRunInParallel = false;
                        break;
                    case 'budget':
                        if (optimizedTask.complexity === 'complex') {
                            optimizedTask.complexity = 'moderate';
                            optimizedTask.estimatedDuration *= 0.8;
                        }
                        break;
                }
            }
            return optimizedTask;
        });
    }
    calculateOptimizedDuration(tasks, executionGraph) {
        let totalDuration = 0;
        for (const batch of executionGraph.parallelBatches) {
            const batchTasks = tasks.filter(t => batch.includes(t.id));
            const batchDuration = Math.max(...batchTasks.map(t => t.estimatedDuration));
            totalDuration += batchDuration;
        }
        const parallelTaskIds = new Set(executionGraph.parallelBatches.flat());
        const sequentialTasks = tasks.filter(t => !parallelTaskIds.has(t.id));
        const sequentialDuration = sequentialTasks.reduce((sum, t) => sum + t.estimatedDuration, 0);
        return totalDuration + sequentialDuration;
    }
    calculateResourceScore(resource, task) {
        const capabilityMatch = task.requiredCapabilities.filter(cap => resource.capabilities.includes(cap)).length / task.requiredCapabilities.length;
        const performanceScore = (resource.performance.speed + resource.performance.quality + resource.performance.reliability) / 3;
        const costScore = Math.max(0, 10 - resource.cost * 10);
        return (capabilityMatch * 0.5 + performanceScore * 0.3 + costScore * 0.2) * 10;
    }
    hasTaskDependency(taskId1, taskId2, tasks) {
        const task1 = tasks.find(t => t.id === taskId1);
        return task1 ? task1.dependencies.includes(taskId2) : false;
    }
    async validateWorkflowFeasibility(workflow, resources) {
        const errors = [];
        const warnings = [];
        for (const task of workflow.atomicTasks) {
            const requiredCapabilities = task.requiredCapabilities;
            const availableCapabilities = resources.flatMap(r => r.capabilities);
            const missingCapabilities = requiredCapabilities.filter(cap => !availableCapabilities.includes(cap));
            if (missingCapabilities.length > 0) {
                errors.push({
                    code: 'MISSING_CAPABILITIES',
                    message: `Task ${task.id} requires capabilities: ${missingCapabilities.join(', ')}`,
                    taskId: task.id,
                    severity: 'error'
                });
            }
        }
        const visited = new Set();
        const recursionStack = new Set();
        const hasCycle = (taskId) => {
            if (recursionStack.has(taskId))
                return true;
            if (visited.has(taskId))
                return false;
            visited.add(taskId);
            recursionStack.add(taskId);
            const task = workflow.atomicTasks.find(t => t.id === taskId);
            if (task) {
                for (const depId of task.dependencies) {
                    if (hasCycle(depId))
                        return true;
                }
            }
            recursionStack.delete(taskId);
            return false;
        };
        for (const task of workflow.atomicTasks) {
            if (hasCycle(task.id)) {
                errors.push({
                    code: 'CIRCULAR_DEPENDENCY',
                    message: `Circular dependency detected involving task: ${task.id}`,
                    taskId: task.id,
                    severity: 'critical'
                });
            }
        }
        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            suggestions: [],
            score: Math.max(0, 100 - (errors.length * 20) - (warnings.length * 5))
        };
    }
    calculateWorkflowMetrics(workflow) {
        const parallelTaskCount = workflow.executionGraph.parallelBatches.flat().length;
        const totalTaskCount = workflow.atomicTasks.length;
        const parallelization = totalTaskCount > 0 ? parallelTaskCount / totalTaskCount : 0;
        const assignedTasks = workflow.atomicTasks.filter(t => t.metadata?.assignedResource);
        const resourceUtilization = assignedTasks.length / totalTaskCount;
        const estimatedCost = workflow.atomicTasks.reduce((cost, task) => cost + (task.metadata?.estimatedCost || 0.05), 0);
        const avgComplexityScore = workflow.atomicTasks.reduce((sum, task) => {
            const complexityScores = { trivial: 1, simple: 2, moderate: 3, complex: 4 };
            return sum + (complexityScores[task.complexity] || 2);
        }, 0) / totalTaskCount;
        const qualityScore = Math.min(10, avgComplexityScore * 2.5);
        const feasibilityScore = Math.min(10, (resourceUtilization * 5) +
            (parallelization * 3) +
            ((workflow.metadata?.successRate || 0.8) * 2));
        return {
            parallelization: Math.round(parallelization * 100) / 100,
            resourceUtilization: Math.round(resourceUtilization * 100) / 100,
            estimatedTime: workflow.estimatedDuration,
            estimatedCost: Math.round(estimatedCost * 100) / 100,
            qualityScore: Math.round(qualityScore * 100) / 100,
            feasibilityScore: Math.round(feasibilityScore * 100) / 100
        };
    }
    generateOptimizationReport(original, optimized) {
        return {
            timeImprovement: Math.round(((original.estimatedDuration - optimized.estimatedDuration) / original.estimatedDuration) * 100),
            parallelizationIncrease: optimized.executionGraph.parallelBatches.length -
                original.executionGraph.parallelBatches.length,
            resourceAssignments: optimized.atomicTasks.filter(t => t.metadata?.assignedResource).length,
            optimizationStrategies: ['task_assignment', 'parallelization', 'dependency_optimization']
        };
    }
    generateResourceAssignments(tasks, resources) {
        const assignments = {};
        for (const resource of resources) {
            assignments[resource.id] = tasks
                .filter(t => t.metadata?.assignedResource === resource.id)
                .map(t => t.id);
        }
        return assignments;
    }
    generateCacheKey(intent, files) {
        const intentHash = this.hashString(JSON.stringify({
            goal: intent.primaryGoal,
            outputType: intent.outputType,
            complexity: intent.complexity,
            constraints: intent.constraints
        }));
        const filesInfo = files.map(f => `${f.mimeType}:${f.size}`).join(',');
        const filesHash = this.hashString(filesInfo);
        return `wf_${intentHash}_${filesHash}`;
    }
    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36);
    }
    cloneWorkflow(workflow) {
        return JSON.parse(JSON.stringify(workflow));
    }
    clearAffectedCaches(resourceId) {
        for (const [key, workflow] of this.workflowCache.entries()) {
            const usesResource = workflow.atomicTasks.some(task => task.metadata?.assignedResource === resourceId);
            if (usesResource) {
                this.workflowCache.delete(key);
            }
        }
    }
    extractRequiredCapabilities(intent) {
        const capabilities = [];
        switch (intent.outputType) {
            case 'video':
                capabilities.push('video_editing', 'text_generation', 'image_generation', 'audio_generation');
                break;
            case 'audio':
                capabilities.push('audio_generation', 'text_to_speech');
                break;
            case 'image':
                capabilities.push('image_generation', 'image_processing');
                break;
            case 'text':
                capabilities.push('text_generation', 'content_analysis');
                break;
            case 'document':
                capabilities.push('document_processing', 'text_generation');
                break;
        }
        if (intent.userFiles.length > 0) {
            capabilities.push('content_analysis', 'data_extraction');
        }
        return capabilities;
    }
    detectOutputTypeFromDescription(description) {
        const lowerDesc = description.toLowerCase();
        if (/video|movie|clip|animation/.test(lowerDesc))
            return 'video';
        if (/audio|sound|music|speech/.test(lowerDesc))
            return 'audio';
        if (/image|picture|photo|graphic/.test(lowerDesc))
            return 'image';
        if (/document|report|paper|analysis/.test(lowerDesc))
            return 'document';
        if (/data|chart|graph|visualization/.test(lowerDesc))
            return 'data';
        return 'text';
    }
    assessDescriptionComplexity(description) {
        let complexity = 1;
        complexity += Math.min(5, description.length / 100);
        const complexKeywords = ['comprehensive', 'detailed', 'advanced', 'professional', 'high-quality'];
        const simpleKeywords = ['simple', 'basic', 'quick', 'draft'];
        for (const keyword of complexKeywords) {
            if (description.toLowerCase().includes(keyword))
                complexity += 1;
        }
        for (const keyword of simpleKeywords) {
            if (description.toLowerCase().includes(keyword))
                complexity -= 1;
        }
        return Math.max(1, Math.min(10, Math.round(complexity)));
    }
    extractRequirementsFromDescription(description) {
        const requirements = [];
        const lowerDesc = description.toLowerCase();
        if (/high.quality|professional|premium/.test(lowerDesc)) {
            requirements.push('high_quality');
        }
        if (/fast|quick|urgent|immediately/.test(lowerDesc)) {
            requirements.push('fast_processing');
        }
        if (/accurate|precise|detailed/.test(lowerDesc)) {
            requirements.push('high_accuracy');
        }
        if (/custom|specific|tailored/.test(lowerDesc)) {
            requirements.push('customization');
        }
        return requirements;
    }
    getDefaultPreferences() {
        return {
            qualityLevel: 'standard',
            speedPriority: 5,
            costSensitivity: 5,
            preferredFormats: [],
            autoOptimize: true
        };
    }
}
exports.RuntimeWorkflowGenerator = RuntimeWorkflowGenerator;
exports.default = RuntimeWorkflowGenerator;
//# sourceMappingURL=runtimeWorkflowGenerator.js.map