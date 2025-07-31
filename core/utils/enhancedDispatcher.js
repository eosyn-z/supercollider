"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnhancedDispatcher = void 0;
const executionTypes_1 = require("../types/executionTypes");
const apiKeyManager_1 = require("./apiKeyManager");
const resultStore_1 = require("./resultStore");
class EnhancedDispatcher {
    constructor(config = {}, apiKeyManager, resultStore) {
        this.runningSubtasks = new Map();
        this.semaphore = new Map();
        this.executionOrderCounter = 0;
        this.config = {
            concurrency: {
                maxConcurrentSubtasks: 5,
                maxConcurrentBatches: 2,
                ...config.concurrency
            },
            retry: {
                maxRetries: 3,
                backoffMultiplier: 2,
                initialDelayMs: 1000,
                ...config.retry
            },
            timeout: {
                subtaskTimeoutMs: 300000,
                batchTimeoutMs: 1800000,
                ...config.timeout
            },
            multipass: {
                enabled: true,
                maxPasses: 3,
                improvementThreshold: 0.1,
                ...config.multipass
            },
            fallback: {
                enabled: true,
                fallbackAgents: [],
                ...config.fallback
            }
        };
        this.apiKeyManager = apiKeyManager || new apiKeyManager_1.SecureApiKeyManager();
        this.resultStore = resultStore || new resultStore_1.InMemoryResultStore();
    }
    async validateAgentKeys(agents) {
        const validationResults = new Map();
        for (const agent of agents) {
            try {
                const apiKey = await this.apiKeyManager.getApiKey(agent.id);
                validationResults.set(agent.id, !!apiKey);
            }
            catch (error) {
                validationResults.set(agent.id, false);
            }
        }
        return validationResults;
    }
    async dispatchBatch(batch, agent, workflowId, batchIndex = 0) {
        const batchId = this.generateId();
        const startTime = Date.now();
        const subtaskResults = [];
        const errors = [];
        await this.resultStore.saveBatchMetadata({
            batchId,
            workflowId,
            batchIndex,
            strategy: 'parallel',
            startTime: new Date(),
            subtaskIds: batch.map(s => s.id),
            assignedAgentId: agent.id,
            status: 'running'
        });
        await this.waitForBatchSlot();
        try {
            const concurrentTasks = Math.min(batch.length, this.config.concurrency.maxConcurrentSubtasks);
            const chunks = this.chunkArray(batch, concurrentTasks);
            for (const chunk of chunks) {
                const chunkPromises = chunk.map(subtask => this.dispatchSubtask(subtask, agent, workflowId, batchId, batchIndex)
                    .then(result => ({ subtask, result }))
                    .catch(error => ({ subtask, error })));
                const chunkResults = await Promise.all(chunkPromises);
                for (const { subtask, result, error } of chunkResults) {
                    if (error) {
                        const executionError = {
                            type: 'API_ERROR',
                            message: error.message,
                            subtaskId: subtask.id,
                            agentId: agent.id,
                            timestamp: new Date(),
                            retryable: true
                        };
                        errors.push(executionError);
                        subtaskResults.push({
                            subtaskId: subtask.id,
                            agentId: agent.id,
                            validationResult: {
                                passed: false,
                                confidence: 0,
                                ruleResults: [],
                                shouldHalt: false,
                                shouldRetry: true,
                                errors: [error.message],
                                warnings: []
                            },
                            retryCount: 0,
                            executionTime: 0,
                            status: executionTypes_1.ExecutionStatus.FAILED
                        });
                    }
                    else {
                        subtaskResults.push(result);
                    }
                }
            }
            const executionTime = Date.now() - startTime;
            const overallSuccess = subtaskResults.every(result => result.status === executionTypes_1.ExecutionStatus.COMPLETED);
            await this.resultStore.updateBatchStatus(batchId, overallSuccess ? 'completed' : 'failed');
            return {
                batchId,
                subtaskResults,
                overallSuccess,
                executionTime,
                errors
            };
        }
        catch (error) {
            await this.resultStore.updateBatchStatus(batchId, 'failed');
            const executionError = {
                type: 'SYSTEM_ERROR',
                message: `Batch execution failed: ${error.message}`,
                agentId: agent.id,
                timestamp: new Date(),
                retryable: false
            };
            return {
                batchId,
                subtaskResults,
                overallSuccess: false,
                executionTime: Date.now() - startTime,
                errors: [executionError]
            };
        }
    }
    async dispatchSubtask(subtask, agent, workflowId, batchId, batchIndex) {
        const startTime = Date.now();
        let retryCount = 0;
        let bestResult = null;
        const isMultipass = this.config.multipass.enabled &&
            subtask.metadata?.multipass === true;
        const maxAttempts = isMultipass ?
            this.config.multipass.maxPasses :
            this.config.retry.maxRetries + 1;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                if (attempt > 0) {
                    const delay = this.config.retry.initialDelayMs *
                        Math.pow(this.config.retry.backoffMultiplier, attempt - 1);
                    await this.sleep(delay);
                }
                const result = await this.executeSingleAttempt(subtask, agent, attempt);
                await this.saveSubtaskResult(result, workflowId, batchId, batchIndex, subtask);
                if (isMultipass) {
                    const shouldContinue = this.shouldContinueMultipass(result, bestResult, attempt);
                    if (!bestResult || result.validationResult.confidence > bestResult.validationResult.confidence) {
                        bestResult = result;
                    }
                    if (!shouldContinue || result.validationResult.passed) {
                        break;
                    }
                }
                else {
                    if (result.status === executionTypes_1.ExecutionStatus.COMPLETED) {
                        return result;
                    }
                    if (!result.validationResult.shouldRetry ||
                        attempt >= this.config.retry.maxRetries) {
                        return result;
                    }
                }
                retryCount = attempt + 1;
            }
            catch (error) {
                retryCount = attempt + 1;
                if (attempt >= maxAttempts - 1) {
                    const failedResult = {
                        subtaskId: subtask.id,
                        agentId: agent.id,
                        validationResult: {
                            passed: false,
                            confidence: 0,
                            ruleResults: [],
                            shouldHalt: false,
                            shouldRetry: false,
                            errors: [`Final attempt failed: ${error.message}`],
                            warnings: []
                        },
                        retryCount,
                        executionTime: Date.now() - startTime,
                        status: executionTypes_1.ExecutionStatus.FAILED
                    };
                    await this.saveSubtaskResult(failedResult, workflowId, batchId, batchIndex, subtask);
                    return failedResult;
                }
            }
        }
        const finalResult = bestResult || {
            subtaskId: subtask.id,
            agentId: agent.id,
            validationResult: {
                passed: false,
                confidence: 0,
                ruleResults: [],
                shouldHalt: false,
                shouldRetry: false,
                errors: ['No valid result obtained'],
                warnings: []
            },
            retryCount,
            executionTime: Date.now() - startTime,
            status: executionTypes_1.ExecutionStatus.FAILED
        };
        await this.saveSubtaskResult(finalResult, workflowId, batchId, batchIndex, subtask);
        return finalResult;
    }
    async executeSingleAttempt(subtask, agent, attemptNumber) {
        const startTime = Date.now();
        const abortController = new AbortController();
        this.runningSubtasks.set(subtask.id, abortController);
        try {
            const timeoutId = setTimeout(() => {
                abortController.abort();
            }, this.config.timeout.subtaskTimeoutMs);
            await this.waitForAgentSlot(agent.id);
            try {
                const apiResponse = await this.callAgentApi(subtask, agent, abortController.signal);
                clearTimeout(timeoutId);
                if (!apiResponse.success || !apiResponse.content) {
                    throw new Error(apiResponse.error?.message || 'Empty response from agent');
                }
                const subtaskResult = {
                    content: apiResponse.content,
                    metadata: {
                        ...apiResponse.metadata,
                        usage: apiResponse.usage,
                        attempt: attemptNumber + 1,
                        processingTime: Date.now() - startTime
                    },
                    generatedAt: new Date(),
                    agentId: agent.id,
                    confidence: 1.0
                };
                return {
                    subtaskId: subtask.id,
                    agentId: agent.id,
                    result: subtaskResult,
                    validationResult: {
                        passed: true,
                        confidence: 1.0,
                        ruleResults: [],
                        shouldHalt: false,
                        shouldRetry: false,
                        errors: [],
                        warnings: []
                    },
                    retryCount: attemptNumber,
                    executionTime: Date.now() - startTime,
                    status: executionTypes_1.ExecutionStatus.COMPLETED
                };
            }
            finally {
                this.releaseAgentSlot(agent.id);
                clearTimeout(timeoutId);
            }
        }
        catch (error) {
            const isTimeout = error.name === 'AbortError';
            return {
                subtaskId: subtask.id,
                agentId: agent.id,
                validationResult: {
                    passed: false,
                    confidence: 0,
                    ruleResults: [],
                    shouldHalt: isTimeout,
                    shouldRetry: !isTimeout,
                    errors: [error.message],
                    warnings: []
                },
                retryCount: attemptNumber,
                executionTime: Date.now() - startTime,
                status: executionTypes_1.ExecutionStatus.FAILED
            };
        }
        finally {
            this.runningSubtasks.delete(subtask.id);
        }
    }
    async callAgentApi(subtask, agent, signal) {
        const apiKey = await this.apiKeyManager.getApiKey(agent.id);
        if (!apiKey) {
            throw new Error(`No API key found for agent ${agent.id}`);
        }
        const endpointConfig = this.apiKeyManager.getEndpointConfig(agent);
        const request = this.buildApiRequest(subtask, endpointConfig);
        const headers = this.buildHeaders(apiKey, endpointConfig);
        const url = `${endpointConfig.baseUrl}${endpointConfig.completionsPath}`;
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify(request),
                signal
            });
            if (!response.ok) {
                throw new Error(`Agent API error: ${response.status} ${response.statusText}`);
            }
            const data = await response.json();
            return this.parseApiResponse(data, endpointConfig);
        }
        catch (error) {
            if (error.name === 'AbortError') {
                throw error;
            }
            if (process.env.NODE_ENV === 'development') {
                await this.sleep(Math.random() * 2000 + 1000);
                return this.generateMockResponse(subtask);
            }
            return {
                success: false,
                error: {
                    code: 'API_ERROR',
                    message: error.message
                }
            };
        }
    }
    buildApiRequest(subtask, config) {
        const prompt = this.buildPrompt(subtask);
        switch (config.requestFormat) {
            case 'openai':
                return {
                    model: subtask.metadata?.model || 'gpt-3.5-turbo',
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: subtask.metadata?.maxTokens || 4000,
                    temperature: subtask.metadata?.temperature || 0.7
                };
            case 'anthropic':
                return {
                    model: subtask.metadata?.model || 'claude-3-haiku-20240307',
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: subtask.metadata?.maxTokens || 4000
                };
            case 'google':
                return {
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        maxOutputTokens: subtask.metadata?.maxTokens || 4000,
                        temperature: subtask.metadata?.temperature || 0.7
                    }
                };
            default:
                return {
                    prompt,
                    max_tokens: subtask.metadata?.maxTokens || 4000,
                    temperature: subtask.metadata?.temperature || 0.7
                };
        }
    }
    buildHeaders(apiKey, config) {
        const headers = { ...config.headers };
        if (config.authHeader === 'Authorization') {
            headers[config.authHeader] = `Bearer ${apiKey}`;
        }
        else {
            headers[config.authHeader] = apiKey;
        }
        return headers;
    }
    parseApiResponse(data, config) {
        let content;
        let usage;
        switch (config.requestFormat) {
            case 'openai':
                content = data.choices?.[0]?.message?.content || '';
                usage = data.usage;
                break;
            case 'anthropic':
                content = data.content?.[0]?.text || '';
                usage = data.usage;
                break;
            case 'google':
                content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
                usage = data.usageMetadata;
                break;
            default:
                content = data.content || data.message || data.text || data.output || '';
                usage = data.usage;
                break;
        }
        return {
            success: true,
            content,
            usage,
            metadata: data.metadata
        };
    }
    async saveSubtaskResult(result, workflowId, batchId, batchIndex, subtask) {
        const dependencyChain = subtask.dependencies.map(dep => dep.subtaskId);
        const storedResult = {
            ...result,
            workflowId,
            batchId,
            batchIndex,
            executionOrder: ++this.executionOrderCounter,
            dependencyChain,
            parentSubtaskIds: dependencyChain,
            childSubtaskIds: [],
            executionLevel: this.calculateExecutionLevel(subtask),
            storageTimestamp: new Date(),
            checksum: ''
        };
        await this.resultStore.saveSubtaskResult(storedResult);
    }
    calculateExecutionLevel(subtask) {
        return subtask.dependencies.length > 0 ?
            Math.max(...subtask.dependencies.map(() => 1)) + 1 : 0;
    }
    buildPrompt(subtask) {
        let prompt = `Task: ${subtask.title}\n\n`;
        prompt += `Description: ${subtask.description}\n\n`;
        if (subtask.type) {
            prompt += `Type: ${subtask.type}\n\n`;
        }
        if (subtask.dependencies.length > 0) {
            prompt += `Dependencies: This task depends on completion of ${subtask.dependencies.length} other subtask(s).\n\n`;
        }
        prompt += 'Please provide a comprehensive response to complete this task.';
        return prompt;
    }
    generateMockResponse(subtask) {
        return {
            success: true,
            content: `Mock response for subtask: ${subtask.title}\n\nThis is a simulated response for ${subtask.description}`,
            usage: {
                promptTokens: 100,
                completionTokens: 50,
                totalTokens: 150
            },
            metadata: {
                mock: true,
                generatedAt: new Date().toISOString()
            }
        };
    }
    shouldContinueMultipass(currentResult, bestResult, attemptNumber) {
        if (currentResult.validationResult.passed) {
            return false;
        }
        if (attemptNumber >= this.config.multipass.maxPasses - 1) {
            return false;
        }
        if (!bestResult) {
            return true;
        }
        const improvement = currentResult.validationResult.confidence -
            bestResult.validationResult.confidence;
        return improvement >= this.config.multipass.improvementThreshold;
    }
    async waitForBatchSlot() {
        while (this.runningSubtasks.size >= this.config.concurrency.maxConcurrentBatches) {
            await this.sleep(100);
        }
    }
    async waitForAgentSlot(agentId) {
        const currentCount = this.semaphore.get(agentId) || 0;
        while (currentCount >= this.config.concurrency.maxConcurrentSubtasks) {
            await this.sleep(100);
        }
        this.semaphore.set(agentId, currentCount + 1);
    }
    releaseAgentSlot(agentId) {
        const currentCount = this.semaphore.get(agentId) || 0;
        this.semaphore.set(agentId, Math.max(0, currentCount - 1));
    }
    cancelSubtask(subtaskId) {
        const controller = this.runningSubtasks.get(subtaskId);
        if (controller) {
            controller.abort();
            this.runningSubtasks.delete(subtaskId);
            return true;
        }
        return false;
    }
    cancelAll() {
        for (const [subtaskId, controller] of this.runningSubtasks) {
            controller.abort();
        }
        this.runningSubtasks.clear();
        this.semaphore.clear();
    }
    getStats() {
        const agentLoad = {};
        for (const [agentId, count] of this.semaphore) {
            agentLoad[agentId] = count;
        }
        return {
            runningCount: this.runningSubtasks.size,
            agentLoad
        };
    }
    generateId() {
        return Math.random().toString(36).substring(2, 15);
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    chunkArray(array, chunkSize) {
        const chunks = [];
        for (let i = 0; i < array.length; i += chunkSize) {
            chunks.push(array.slice(i, i + chunkSize));
        }
        return chunks;
    }
}
exports.EnhancedDispatcher = EnhancedDispatcher;
//# sourceMappingURL=enhancedDispatcher.js.map