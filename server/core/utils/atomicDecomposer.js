"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.atomicDecomposer = exports.AtomicDecomposer = void 0;
const uuid_1 = require("uuid");
class AtomicDecomposer {
    constructor() {
        this.decompositionRules = [];
        this.taskLibrary = new Map();
        this.initializeDecompositionRules();
        this.initializeTaskLibrary();
    }
    async decomposeWorkflow(userPrompt, uploadedFiles, context = {}) {
        console.log('🔍 Analyzing user intent:', userPrompt);
        const intent = this.analyzeUserIntent(userPrompt, uploadedFiles);
        console.log('📋 Intent analysis:', intent);
        const rule = this.matchDecompositionPattern(intent);
        let atomicTasks;
        if (rule) {
            atomicTasks = this.applyDecompositionRule(rule, intent);
        }
        else {
            atomicTasks = this.createCustomDecomposition(intent);
        }
        atomicTasks = this.optimizeDependencyGraph(atomicTasks);
        const batchedTasks = this.batchTasksForEfficiency(atomicTasks);
        const executionGraph = this.buildExecutionGraph(atomicTasks);
        const workflow = {
            id: `workflow-${(0, uuid_1.v4)()}`,
            name: this.generateWorkflowName(intent),
            description: intent.primaryGoal,
            atomicTasks,
            executionGraph,
            estimatedDuration: this.calculateTotalDuration(atomicTasks),
            requiredResources: this.extractRequiredResources(atomicTasks),
            outputFiles: this.defineExpectedOutputs(atomicTasks),
            totalTokens: this.calculateTotalTokens(atomicTasks),
            batchedTasks
        };
        console.log('✅ Workflow decomposed:', {
            taskCount: atomicTasks.length,
            totalTokens: workflow.totalTokens,
            estimatedDuration: workflow.estimatedDuration
        });
        return workflow;
    }
    analyzeUserIntent(prompt, files) {
        const promptLower = prompt.toLowerCase();
        const complexity = this.calculateComplexity(prompt);
        const outputType = this.determineOutputType(promptLower, files);
        const requirements = this.extractRequirements(promptLower);
        const estimatedTokens = this.estimateTokenUsage(prompt, files);
        return {
            primaryGoal: prompt,
            outputType,
            complexity,
            requirements,
            constraints: [],
            userFiles: files,
            estimatedTokens
        };
    }
    calculateComplexity(prompt) {
        const wordCount = prompt.split(' ').length;
        const hasComplexKeywords = /create|generate|build|develop|analyze|research|comprehensive|detailed/i.test(prompt);
        const hasMultipleSteps = /first|then|next|finally|step|stage/i.test(prompt);
        let complexity = 1;
        if (wordCount > 50)
            complexity += 1;
        if (hasComplexKeywords)
            complexity += 1;
        if (hasMultipleSteps)
            complexity += 1;
        return Math.min(complexity, 5);
    }
    determineOutputType(prompt, files) {
        if (prompt.includes('video') || files.some(f => f.mimeType.startsWith('video/')))
            return 'video';
        if (prompt.includes('audio') || files.some(f => f.mimeType.startsWith('audio/')))
            return 'audio';
        if (prompt.includes('image') || files.some(f => f.mimeType.startsWith('image/')))
            return 'image';
        if (prompt.includes('document') || files.some(f => f.mimeType.includes('document')))
            return 'document';
        if (prompt.includes('data') || prompt.includes('analysis'))
            return 'data';
        if (prompt.includes('mixed') || prompt.includes('multimedia'))
            return 'mixed';
        return 'text';
    }
    extractRequirements(prompt) {
        const requirements = [];
        if (prompt.includes('research') || prompt.includes('analyze'))
            requirements.push('research');
        if (prompt.includes('create') || prompt.includes('generate'))
            requirements.push('creation');
        if (prompt.includes('edit') || prompt.includes('modify'))
            requirements.push('editing');
        if (prompt.includes('review') || prompt.includes('validate'))
            requirements.push('validation');
        if (prompt.includes('format') || prompt.includes('style'))
            requirements.push('formatting');
        return requirements;
    }
    estimateTokenUsage(prompt, files) {
        let tokens = prompt.length * 0.75;
        files.forEach(file => {
            if (file.mimeType.startsWith('text/'))
                tokens += file.size * 0.1;
            else if (file.mimeType.startsWith('image/'))
                tokens += 1000;
            else if (file.mimeType.startsWith('audio/'))
                tokens += 2000;
            else if (file.mimeType.startsWith('video/'))
                tokens += 5000;
        });
        return Math.ceil(tokens);
    }
    matchDecompositionPattern(intent) {
        for (const rule of this.decompositionRules) {
            if (rule.pattern.test(intent.primaryGoal)) {
                return rule;
            }
        }
        return null;
    }
    applyDecompositionRule(rule, intent) {
        const tasks = [];
        rule.decomposition.forEach((taskTemplate, index) => {
            const task = {
                ...taskTemplate,
                id: `${taskTemplate.id}-${(0, uuid_1.v4)()}`,
                microprompt: this.generateMicroprompt(taskTemplate, intent, index),
                dependencies: taskTemplate.dependencies.map(dep => tasks.find(t => t.type === dep)?.id || dep)
            };
            tasks.push(task);
        });
        return tasks;
    }
    createCustomDecomposition(intent) {
        const tasks = [];
        if (intent.requirements.includes('research')) {
            tasks.push(this.createResearchTask(intent));
        }
        if (intent.requirements.includes('analysis')) {
            tasks.push(this.createAnalysisTask(intent, tasks));
        }
        if (intent.requirements.includes('creation')) {
            tasks.push(this.createCreationTask(intent, tasks));
        }
        if (intent.requirements.includes('validation')) {
            tasks.push(this.createValidationTask(intent, tasks));
        }
        if (tasks.length === 0) {
            tasks.push(this.createGeneralProcessingTask(intent));
        }
        return tasks;
    }
    createResearchTask(intent) {
        return {
            id: `research-${(0, uuid_1.v4)()}`,
            type: 'research_topic',
            name: 'Research Topic',
            description: 'Conduct research on the specified topic',
            microprompt: `Research the following topic thoroughly: ${intent.primaryGoal}. Provide comprehensive information, key points, and relevant details.`,
            inputs: [
                { id: 'topic', name: 'Topic', type: 'text', required: true }
            ],
            outputs: [
                { id: 'research_data', name: 'Research Data', type: 'data', format: 'json', destinationType: 'next_task' }
            ],
            dependencies: [],
            estimatedDuration: 120000,
            complexity: 'moderate',
            canRunInParallel: false,
            requiredCapabilities: ['research'],
            tokenLimit: 2000
        };
    }
    createAnalysisTask(intent, previousTasks) {
        return {
            id: `analyze-${(0, uuid_1.v4)()}`,
            type: 'analyze_content',
            name: 'Analyze Content',
            description: 'Analyze the research data and content',
            microprompt: `Analyze the following content and research data: ${intent.primaryGoal}. Identify key insights, patterns, and actionable information.`,
            inputs: [
                { id: 'research_data', name: 'Research Data', type: 'data', required: true, source: 'previous_task' },
                { id: 'requirements', name: 'Requirements', type: 'text', required: true }
            ],
            outputs: [
                { id: 'analysis_result', name: 'Analysis Result', type: 'data', format: 'json', destinationType: 'next_task' }
            ],
            dependencies: previousTasks.map(t => t.id),
            estimatedDuration: 90000,
            complexity: 'moderate',
            canRunInParallel: false,
            requiredCapabilities: ['analysis'],
            tokenLimit: 2500
        };
    }
    createCreationTask(intent, previousTasks) {
        return {
            id: `create-${(0, uuid_1.v4)()}`,
            type: 'generate_text',
            name: 'Create Content',
            description: 'Create the main content based on analysis',
            microprompt: `Create ${intent.outputType} content based on the analysis: ${intent.primaryGoal}. Ensure high quality and relevance.`,
            inputs: [
                { id: 'analysis_result', name: 'Analysis Result', type: 'data', required: true, source: 'previous_task' },
                { id: 'requirements', name: 'Requirements', type: 'text', required: true }
            ],
            outputs: [
                { id: 'content', name: 'Generated Content', type: 'text', format: 'markdown', destinationType: 'next_task' }
            ],
            dependencies: previousTasks.map(t => t.id),
            estimatedDuration: 180000,
            complexity: 'complex',
            canRunInParallel: false,
            requiredCapabilities: ['text_generation'],
            tokenLimit: 3000
        };
    }
    createValidationTask(intent, previousTasks) {
        return {
            id: `validate-${(0, uuid_1.v4)()}`,
            type: 'validate_output',
            name: 'Validate Output',
            description: 'Review and validate the created content',
            microprompt: `Review and validate the following content for quality, accuracy, and completeness: ${intent.primaryGoal}. Provide feedback and suggestions for improvement.`,
            inputs: [
                { id: 'content', name: 'Content to Validate', type: 'text', required: true, source: 'previous_task' },
                { id: 'requirements', name: 'Requirements', type: 'text', required: true }
            ],
            outputs: [
                { id: 'validation_result', name: 'Validation Result', type: 'data', format: 'json', destinationType: 'next_task' },
                { id: 'final_content', name: 'Final Content', type: 'text', format: 'markdown', destinationType: 'display' }
            ],
            dependencies: previousTasks.map(t => t.id),
            estimatedDuration: 60000,
            complexity: 'simple',
            canRunInParallel: false,
            requiredCapabilities: ['validation'],
            tokenLimit: 1500
        };
    }
    createGeneralProcessingTask(intent) {
        return {
            id: `process-${(0, uuid_1.v4)()}`,
            type: 'generate_text',
            name: 'Process Request',
            description: 'Process the general request',
            microprompt: `Process the following request: ${intent.primaryGoal}. Provide a comprehensive response that addresses all aspects of the request.`,
            inputs: [
                { id: 'request', name: 'Request', type: 'text', required: true }
            ],
            outputs: [
                { id: 'result', name: 'Result', type: 'text', format: 'markdown', destinationType: 'display' }
            ],
            dependencies: [],
            estimatedDuration: 120000,
            complexity: 'moderate',
            canRunInParallel: false,
            requiredCapabilities: ['text_generation'],
            tokenLimit: 2500
        };
    }
    generateMicroprompt(taskTemplate, intent, index) {
        const context = `Context: ${intent.primaryGoal}`;
        const requirements = intent.requirements.join(', ');
        switch (taskTemplate.type) {
            case 'research_topic':
                return `${context}\n\nResearch Task: Conduct thorough research on this topic. Requirements: ${requirements}. Provide comprehensive findings.`;
            case 'analyze_content':
                return `${context}\n\nAnalysis Task: Analyze the provided research data. Requirements: ${requirements}. Identify key insights and patterns.`;
            case 'generate_text':
                return `${context}\n\nCreation Task: Generate high-quality ${intent.outputType} content. Requirements: ${requirements}. Ensure relevance and completeness.`;
            case 'validate_output':
                return `${context}\n\nValidation Task: Review the generated content for quality and accuracy. Requirements: ${requirements}. Provide feedback and final version.`;
            default:
                return `${context}\n\nTask ${index + 1}: ${taskTemplate.description}. Requirements: ${requirements}.`;
        }
    }
    batchTasksForEfficiency(tasks) {
        const batches = [];
        const maxTokensPerBatch = 4000;
        const maxTasksPerBatch = 3;
        let currentBatch = [];
        let currentTokens = 0;
        tasks.forEach(task => {
            if (currentTokens + task.tokenLimit <= maxTokensPerBatch &&
                currentBatch.length < maxTasksPerBatch &&
                task.canRunInParallel) {
                currentBatch.push(task);
                currentTokens += task.tokenLimit;
            }
            else {
                if (currentBatch.length > 0) {
                    batches.push({
                        batchId: `batch-${(0, uuid_1.v4)()}`,
                        tasks: currentBatch,
                        totalTokens: currentTokens,
                        canExecuteInParallel: true,
                        contextInjector: this.createContextInjector(currentBatch)
                    });
                }
                currentBatch = [task];
                currentTokens = task.tokenLimit;
            }
        });
        if (currentBatch.length > 0) {
            batches.push({
                batchId: `batch-${(0, uuid_1.v4)()}`,
                tasks: currentBatch,
                totalTokens: currentTokens,
                canExecuteInParallel: true,
                contextInjector: this.createContextInjector(currentBatch)
            });
        }
        return batches;
    }
    createContextInjector(tasks) {
        const taskSummaries = tasks.map(t => `${t.name}: ${t.description}`).join('; ');
        return {
            type: 'summary',
            content: `Context for batch execution: ${taskSummaries}`,
            tokenLimit: 500
        };
    }
    optimizeDependencyGraph(tasks) {
        const optimizedTasks = [...tasks];
        optimizedTasks.forEach(task => {
            task.dependencies = task.dependencies.filter(dep => optimizedTasks.some(t => t.id === dep));
        });
        return optimizedTasks;
    }
    buildExecutionGraph(tasks) {
        const nodes = tasks.map(task => ({
            taskId: task.id,
            position: { x: 0, y: 0 },
            status: 'pending',
            inputs: [],
            outputs: []
        }));
        const edges = [];
        tasks.forEach(task => {
            task.dependencies.forEach(depId => {
                edges.push({
                    source: depId,
                    target: task.id,
                    dependencyType: 'hard'
                });
            });
        });
        const parallelBatches = this.calculateParallelBatches(tasks);
        const criticalPath = this.calculateCriticalPath(tasks);
        return {
            nodes,
            edges,
            parallelBatches,
            criticalPath
        };
    }
    calculateParallelBatches(tasks) {
        const batches = [];
        const visited = new Set();
        tasks.forEach(task => {
            if (visited.has(task.id))
                return;
            const batch = [task.id];
            visited.add(task.id);
            tasks.forEach(otherTask => {
                if (!visited.has(otherTask.id) &&
                    otherTask.canRunInParallel &&
                    !this.hasDependencyConflict(task, otherTask, tasks)) {
                    batch.push(otherTask.id);
                    visited.add(otherTask.id);
                }
            });
            batches.push(batch);
        });
        return batches;
    }
    hasDependencyConflict(task1, task2, allTasks) {
        const task1Deps = this.getAllDependencies(task1, allTasks);
        const task2Deps = this.getAllDependencies(task2, allTasks);
        return task1Deps.includes(task2.id) || task2Deps.includes(task1.id);
    }
    getAllDependencies(task, allTasks) {
        const deps = new Set();
        const queue = [...task.dependencies];
        while (queue.length > 0) {
            const depId = queue.shift();
            if (deps.has(depId))
                continue;
            deps.add(depId);
            const depTask = allTasks.find(t => t.id === depId);
            if (depTask) {
                queue.push(...depTask.dependencies);
            }
        }
        return Array.from(deps);
    }
    calculateCriticalPath(tasks) {
        const criticalPath = [];
        const taskMap = new Map(tasks.map(t => [t.id, t]));
        const startTasks = tasks.filter(t => t.dependencies.length === 0);
        if (startTasks.length > 0) {
            let currentTask = startTasks[0];
            criticalPath.push(currentTask.id);
            while (currentTask) {
                const nextTasks = tasks.filter(t => t.dependencies.includes(currentTask.id));
                if (nextTasks.length > 0) {
                    currentTask = nextTasks.reduce((longest, current) => current.estimatedDuration > longest.estimatedDuration ? current : longest);
                    criticalPath.push(currentTask.id);
                }
                else {
                    currentTask = null;
                }
            }
        }
        return criticalPath;
    }
    calculateTotalDuration(tasks) {
        const criticalPath = this.calculateCriticalPath(tasks);
        return criticalPath.reduce((total, taskId) => {
            const task = tasks.find(t => t.id === taskId);
            return total + (task?.estimatedDuration || 0);
        }, 0);
    }
    extractRequiredResources(tasks) {
        const resources = new Set();
        tasks.forEach(task => {
            task.requiredCapabilities.forEach(cap => resources.add(cap));
        });
        return Array.from(resources);
    }
    defineExpectedOutputs(tasks) {
        return tasks
            .filter(task => task.outputs.some(output => output.destinationType === 'display'))
            .map(task => ({
            name: task.name,
            type: task.type,
            format: task.outputs[0]?.format || 'text',
            sourceTaskId: task.id
        }));
    }
    calculateTotalTokens(tasks) {
        return tasks.reduce((total, task) => total + task.tokenLimit, 0);
    }
    generateWorkflowName(intent) {
        const goal = intent.primaryGoal.substring(0, 50);
        return `${intent.outputType.charAt(0).toUpperCase() + intent.outputType.slice(1)} Generation: ${goal}`;
    }
    initializeDecompositionRules() {
        this.decompositionRules = [
            {
                trigger: 'video generation',
                pattern: /create.*video|generate.*video|make.*video/i,
                decomposition: [
                    {
                        id: 'script-generation',
                        type: 'generate_script',
                        name: 'Generate Video Script',
                        description: 'Create a detailed script for the video',
                        microprompt: '',
                        inputs: [],
                        outputs: [],
                        dependencies: [],
                        estimatedDuration: 120000,
                        complexity: 'moderate',
                        canRunInParallel: false,
                        requiredCapabilities: ['script_generation'],
                        tokenLimit: 2000
                    },
                    {
                        id: 'audio-generation',
                        type: 'generate_audio',
                        name: 'Generate Audio Narration',
                        description: 'Convert script to audio narration',
                        microprompt: '',
                        inputs: [],
                        outputs: [],
                        dependencies: ['script-generation'],
                        estimatedDuration: 180000,
                        complexity: 'simple',
                        canRunInParallel: false,
                        requiredCapabilities: ['text_to_speech'],
                        tokenLimit: 1500
                    },
                    {
                        id: 'video-composition',
                        type: 'edit_video',
                        name: 'Compose Final Video',
                        description: 'Combine all elements into final video',
                        microprompt: '',
                        inputs: [],
                        outputs: [],
                        dependencies: ['audio-generation'],
                        estimatedDuration: 300000,
                        complexity: 'complex',
                        canRunInParallel: false,
                        requiredCapabilities: ['video_editing'],
                        tokenLimit: 2500
                    }
                ],
                dependencies: [],
                parallelizationStrategy: 'sequential'
            }
        ];
    }
    initializeTaskLibrary() {
        const commonTasks = [
            {
                id: 'research-topic',
                type: 'research_topic',
                name: 'Research Topic',
                description: 'Conduct thorough research on a topic',
                microprompt: '',
                inputs: [{ id: 'topic', name: 'Topic', type: 'text', required: true }],
                outputs: [{ id: 'research_data', name: 'Research Data', type: 'data', format: 'json', destinationType: 'next_task' }],
                dependencies: [],
                estimatedDuration: 120000,
                complexity: 'moderate',
                canRunInParallel: false,
                requiredCapabilities: ['research'],
                tokenLimit: 2000
            },
            {
                id: 'analyze-content',
                type: 'analyze_content',
                name: 'Analyze Content',
                description: 'Analyze content and extract insights',
                microprompt: '',
                inputs: [{ id: 'content', name: 'Content', type: 'text', required: true }],
                outputs: [{ id: 'analysis_result', name: 'Analysis Result', type: 'data', format: 'json', destinationType: 'next_task' }],
                dependencies: [],
                estimatedDuration: 90000,
                complexity: 'moderate',
                canRunInParallel: false,
                requiredCapabilities: ['analysis'],
                tokenLimit: 2000
            }
        ];
        commonTasks.forEach(task => {
            this.taskLibrary.set(task.id, task);
        });
    }
}
exports.AtomicDecomposer = AtomicDecomposer;
exports.atomicDecomposer = new AtomicDecomposer();
//# sourceMappingURL=atomicDecomposer.js.map