"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigurationBuilder = exports.CONFIGURATION_PRESETS = exports.SUPERCOLLIDER_CONFIG_SCHEMA = exports.DEFAULT_WORKFLOW_EXECUTION_CONFIG = exports.DEFAULT_AGENT_SELECTION_CRITERIA = exports.DEFAULT_INJECTION_CONFIG = exports.DEFAULT_DISPATCH_CONFIG = void 0;
exports.validateDispatchConfig = validateDispatchConfig;
exports.validateInjectionConfig = validateInjectionConfig;
exports.validateWorkflowExecutionConfig = validateWorkflowExecutionConfig;
exports.loadConfiguration = loadConfiguration;
exports.DEFAULT_DISPATCH_CONFIG = {
    maxConcurrentRequests: 10,
    preferBatching: true,
    autoFallbackToSequential: true,
    timeoutMs: 300000,
    concurrency: {
        maxConcurrentSubtasks: 5,
        maxConcurrentBatches: 2
    },
    retry: {
        maxRetries: 3,
        backoffMultiplier: 2,
        initialDelayMs: 1000
    },
    timeout: {
        subtaskTimeoutMs: 300000,
        batchTimeoutMs: 1800000
    },
    multipass: {
        enabled: true,
        maxPasses: 3,
        improvementThreshold: 0.1
    },
    fallback: {
        enabled: true,
        fallbackAgents: []
    }
};
exports.DEFAULT_INJECTION_CONFIG = {
    includeTone: true,
    includeFormat: true,
    includeOriginalPrompt: true,
    includeStyleGuide: true,
    maxContextLength: 4000
};
exports.DEFAULT_AGENT_SELECTION_CRITERIA = {
    minSuccessRate: 70,
    minQualityScore: 60,
    excludeAgents: []
};
exports.DEFAULT_WORKFLOW_EXECUTION_CONFIG = {
    parallelBatching: {
        enabled: true,
        maxConcurrentBatches: 3,
        batchSizeLimit: 5,
        timeoutMs: 1800000
    },
    contextInjection: {
        enabled: true,
        config: exports.DEFAULT_INJECTION_CONFIG
    },
    agentSelection: {
        autoSelect: true,
        criteria: exports.DEFAULT_AGENT_SELECTION_CRITERIA,
        fallbacks: []
    },
    errorHandling: {
        maxRetries: 3,
        fallbackToSequential: true,
        haltOnCriticalFailure: false
    }
};
exports.SUPERCOLLIDER_CONFIG_SCHEMA = {
    version: '1.0.0',
    features: {
        parallelBatching: true,
        contextInjection: true,
        enhancedAgentSelection: true
    },
    defaults: {
        dispatchConfig: exports.DEFAULT_DISPATCH_CONFIG,
        injectionConfig: exports.DEFAULT_INJECTION_CONFIG,
        agentSelectionCriteria: exports.DEFAULT_AGENT_SELECTION_CRITERIA
    }
};
exports.CONFIGURATION_PRESETS = {
    development: {
        ...exports.DEFAULT_WORKFLOW_EXECUTION_CONFIG,
        parallelBatching: {
            ...exports.DEFAULT_WORKFLOW_EXECUTION_CONFIG.parallelBatching,
            enabled: false,
            maxConcurrentBatches: 1
        },
        errorHandling: {
            ...exports.DEFAULT_WORKFLOW_EXECUTION_CONFIG.errorHandling,
            maxRetries: 1,
            haltOnCriticalFailure: true
        }
    },
    production: {
        ...exports.DEFAULT_WORKFLOW_EXECUTION_CONFIG,
        parallelBatching: {
            ...exports.DEFAULT_WORKFLOW_EXECUTION_CONFIG.parallelBatching,
            enabled: true,
            maxConcurrentBatches: 5,
            batchSizeLimit: 8
        },
        errorHandling: {
            ...exports.DEFAULT_WORKFLOW_EXECUTION_CONFIG.errorHandling,
            maxRetries: 5,
            fallbackToSequential: true,
            haltOnCriticalFailure: false
        }
    },
    highThroughput: {
        ...exports.DEFAULT_WORKFLOW_EXECUTION_CONFIG,
        parallelBatching: {
            enabled: true,
            maxConcurrentBatches: 10,
            batchSizeLimit: 10,
            timeoutMs: 3600000
        },
        contextInjection: {
            enabled: true,
            config: {
                ...exports.DEFAULT_INJECTION_CONFIG,
                maxContextLength: 2000
            }
        }
    },
    costOptimized: {
        ...exports.DEFAULT_WORKFLOW_EXECUTION_CONFIG,
        parallelBatching: {
            enabled: false,
            maxConcurrentBatches: 1,
            batchSizeLimit: 3,
            timeoutMs: 7200000
        },
        agentSelection: {
            autoSelect: true,
            criteria: {
                ...exports.DEFAULT_AGENT_SELECTION_CRITERIA,
                maxCost: 0.05
            },
            fallbacks: []
        }
    },
    qualityFocused: {
        ...exports.DEFAULT_WORKFLOW_EXECUTION_CONFIG,
        agentSelection: {
            autoSelect: true,
            criteria: {
                ...exports.DEFAULT_AGENT_SELECTION_CRITERIA,
                minSuccessRate: 90,
                minQualityScore: 85
            },
            fallbacks: []
        },
        contextInjection: {
            enabled: true,
            config: {
                ...exports.DEFAULT_INJECTION_CONFIG,
                maxContextLength: 8000,
                includeStyleGuide: true
            }
        },
        errorHandling: {
            ...exports.DEFAULT_WORKFLOW_EXECUTION_CONFIG.errorHandling,
            maxRetries: 5
        }
    }
};
function validateDispatchConfig(config) {
    const errors = [];
    if (config.maxConcurrentRequests !== undefined && config.maxConcurrentRequests < 1) {
        errors.push('maxConcurrentRequests must be at least 1');
    }
    if (config.timeoutMs !== undefined && config.timeoutMs < 1000) {
        errors.push('timeoutMs must be at least 1000ms');
    }
    if (config.concurrency?.maxConcurrentSubtasks !== undefined &&
        config.concurrency.maxConcurrentSubtasks < 1) {
        errors.push('maxConcurrentSubtasks must be at least 1');
    }
    if (config.retry?.maxRetries !== undefined && config.retry.maxRetries < 0) {
        errors.push('maxRetries cannot be negative');
    }
    return errors;
}
function validateInjectionConfig(config) {
    const errors = [];
    if (config.maxContextLength !== undefined && config.maxContextLength < 100) {
        errors.push('maxContextLength must be at least 100 characters');
    }
    if (config.customPrefix !== undefined && config.customPrefix.length > 1000) {
        errors.push('customPrefix cannot exceed 1000 characters');
    }
    if (config.customSuffix !== undefined && config.customSuffix.length > 1000) {
        errors.push('customSuffix cannot exceed 1000 characters');
    }
    return errors;
}
function validateWorkflowExecutionConfig(config) {
    const errors = [];
    if (config.parallelBatching?.maxConcurrentBatches !== undefined &&
        config.parallelBatching.maxConcurrentBatches < 1) {
        errors.push('maxConcurrentBatches must be at least 1');
    }
    if (config.parallelBatching?.batchSizeLimit !== undefined &&
        config.parallelBatching.batchSizeLimit < 1) {
        errors.push('batchSizeLimit must be at least 1');
    }
    if (config.errorHandling?.maxRetries !== undefined &&
        config.errorHandling.maxRetries < 0) {
        errors.push('maxRetries cannot be negative');
    }
    if (config.contextInjection?.config) {
        errors.push(...validateInjectionConfig(config.contextInjection.config));
    }
    return errors;
}
class ConfigurationBuilder {
    constructor() {
        this.config = {};
    }
    withParallelBatching(enabled, maxBatches = 3, batchSize = 5) {
        this.config.parallelBatching = {
            enabled,
            maxConcurrentBatches: maxBatches,
            batchSizeLimit: batchSize,
            timeoutMs: 1800000
        };
        return this;
    }
    withContextInjection(enabled, config) {
        this.config.contextInjection = {
            enabled,
            config: { ...exports.DEFAULT_INJECTION_CONFIG, ...config }
        };
        return this;
    }
    withAgentSelection(autoSelect, criteria) {
        this.config.agentSelection = {
            autoSelect,
            criteria: { ...exports.DEFAULT_AGENT_SELECTION_CRITERIA, ...criteria },
            fallbacks: []
        };
        return this;
    }
    withErrorHandling(maxRetries, fallbackToSequential = true) {
        this.config.errorHandling = {
            maxRetries,
            fallbackToSequential,
            haltOnCriticalFailure: false
        };
        return this;
    }
    build() {
        const finalConfig = { ...exports.DEFAULT_WORKFLOW_EXECUTION_CONFIG, ...this.config };
        const errors = validateWorkflowExecutionConfig(finalConfig);
        if (errors.length > 0) {
            throw new Error(`Invalid configuration: ${errors.join(', ')}`);
        }
        return finalConfig;
    }
    static fromPreset(presetName) {
        const builder = new ConfigurationBuilder();
        builder.config = { ...exports.CONFIGURATION_PRESETS[presetName] };
        return builder;
    }
}
exports.ConfigurationBuilder = ConfigurationBuilder;
function loadConfiguration(environment = 'development') {
    const baseConfig = environment in exports.CONFIGURATION_PRESETS
        ? exports.CONFIGURATION_PRESETS[environment]
        : exports.DEFAULT_WORKFLOW_EXECUTION_CONFIG;
    const envOverrides = {};
    if (process.env.SUPERCOLLIDER_MAX_CONCURRENT_BATCHES) {
        envOverrides.parallelBatching = {
            ...baseConfig.parallelBatching,
            maxConcurrentBatches: parseInt(process.env.SUPERCOLLIDER_MAX_CONCURRENT_BATCHES, 10)
        };
    }
    if (process.env.SUPERCOLLIDER_MAX_CONTEXT_LENGTH) {
        envOverrides.contextInjection = {
            ...baseConfig.contextInjection,
            config: {
                ...baseConfig.contextInjection.config,
                maxContextLength: parseInt(process.env.SUPERCOLLIDER_MAX_CONTEXT_LENGTH, 10)
            }
        };
    }
    if (process.env.SUPERCOLLIDER_MAX_RETRIES) {
        envOverrides.errorHandling = {
            ...baseConfig.errorHandling,
            maxRetries: parseInt(process.env.SUPERCOLLIDER_MAX_RETRIES, 10)
        };
    }
    return { ...baseConfig, ...envOverrides };
}
//# sourceMappingURL=schema.js.map