/**
 * Configuration Schema for Supercollider Enhanced Features
 * Provides default configurations and validation schemas
 */

import { 
  DispatchConfig, 
  InjectionConfig, 
  AgentSelectionCriteria, 
  WorkflowExecutionConfig,
  ConfigurationSchema
} from '../types/enhanced';

export const DEFAULT_DISPATCH_CONFIG: DispatchConfig = {
  maxConcurrentRequests: 10,
  preferBatching: true,
  autoFallbackToSequential: true,
  timeoutMs: 300000, // 5 minutes
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
    subtaskTimeoutMs: 300000, // 5 minutes
    batchTimeoutMs: 1800000   // 30 minutes
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

export const DEFAULT_INJECTION_CONFIG: InjectionConfig = {
  includeTone: true,
  includeFormat: true,
  includeOriginalPrompt: true,
  includeStyleGuide: true,
  maxContextLength: 4000
};

export const DEFAULT_AGENT_SELECTION_CRITERIA: AgentSelectionCriteria = {
  minSuccessRate: 70,
  minQualityScore: 60,
  excludeAgents: []
};

export const DEFAULT_WORKFLOW_EXECUTION_CONFIG: WorkflowExecutionConfig = {
  parallelBatching: {
    enabled: true,
    maxConcurrentBatches: 3,
    batchSizeLimit: 5,
    timeoutMs: 1800000 // 30 minutes
  },
  contextInjection: {
    enabled: true,
    config: DEFAULT_INJECTION_CONFIG
  },
  agentSelection: {
    autoSelect: true,
    criteria: DEFAULT_AGENT_SELECTION_CRITERIA,
    fallbacks: []
  },
  errorHandling: {
    maxRetries: 3,
    fallbackToSequential: true,
    haltOnCriticalFailure: false
  }
};

export const SUPERCOLLIDER_CONFIG_SCHEMA: ConfigurationSchema = {
  version: '1.0.0',
  features: {
    parallelBatching: true,
    contextInjection: true,
    enhancedAgentSelection: true
  },
  defaults: {
    dispatchConfig: DEFAULT_DISPATCH_CONFIG,
    injectionConfig: DEFAULT_INJECTION_CONFIG,
    agentSelectionCriteria: DEFAULT_AGENT_SELECTION_CRITERIA
  }
};

// Configuration presets for different use cases
export const CONFIGURATION_PRESETS = {
  development: {
    ...DEFAULT_WORKFLOW_EXECUTION_CONFIG,
    parallelBatching: {
      ...DEFAULT_WORKFLOW_EXECUTION_CONFIG.parallelBatching,
      enabled: false, // Disable for easier debugging
      maxConcurrentBatches: 1
    },
    errorHandling: {
      ...DEFAULT_WORKFLOW_EXECUTION_CONFIG.errorHandling,
      maxRetries: 1,
      haltOnCriticalFailure: true // Fail fast in development
    }
  },
  
  production: {
    ...DEFAULT_WORKFLOW_EXECUTION_CONFIG,
    parallelBatching: {
      ...DEFAULT_WORKFLOW_EXECUTION_CONFIG.parallelBatching,
      enabled: true,
      maxConcurrentBatches: 5,
      batchSizeLimit: 8
    },
    errorHandling: {
      ...DEFAULT_WORKFLOW_EXECUTION_CONFIG.errorHandling,
      maxRetries: 5,
      fallbackToSequential: true,
      haltOnCriticalFailure: false
    }
  },
  
  highThroughput: {
    ...DEFAULT_WORKFLOW_EXECUTION_CONFIG,
    parallelBatching: {
      enabled: true,
      maxConcurrentBatches: 10,
      batchSizeLimit: 10,
      timeoutMs: 3600000 // 1 hour
    },
    contextInjection: {
      enabled: true,
      config: {
        ...DEFAULT_INJECTION_CONFIG,
        maxContextLength: 2000 // Shorter context for speed
      }
    }
  },
  
  costOptimized: {
    ...DEFAULT_WORKFLOW_EXECUTION_CONFIG,
    parallelBatching: {
      enabled: false, // Sequential execution to avoid concurrent costs
      maxConcurrentBatches: 1,
      batchSizeLimit: 3,
      timeoutMs: 7200000 // 2 hours - longer timeout for cost efficiency
    },
    agentSelection: {
      autoSelect: true,
      criteria: {
        ...DEFAULT_AGENT_SELECTION_CRITERIA,
        maxCost: 0.05 // Prefer cheaper agents
      },
      fallbacks: []
    }
  },
  
  qualityFocused: {
    ...DEFAULT_WORKFLOW_EXECUTION_CONFIG,
    agentSelection: {
      autoSelect: true,
      criteria: {
        ...DEFAULT_AGENT_SELECTION_CRITERIA,
        minSuccessRate: 90,
        minQualityScore: 85
      },
      fallbacks: []
    },
    contextInjection: {
      enabled: true,
      config: {
        ...DEFAULT_INJECTION_CONFIG,
        maxContextLength: 8000, // More context for quality
        includeStyleGuide: true
      }
    },
    errorHandling: {
      ...DEFAULT_WORKFLOW_EXECUTION_CONFIG.errorHandling,
      maxRetries: 5
    }
  }
} as const;

// Validation functions
export function validateDispatchConfig(config: Partial<DispatchConfig>): string[] {
  const errors: string[] = [];
  
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

export function validateInjectionConfig(config: Partial<InjectionConfig>): string[] {
  const errors: string[] = [];
  
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

export function validateWorkflowExecutionConfig(config: Partial<WorkflowExecutionConfig>): string[] {
  const errors: string[] = [];
  
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
  
  // Validate nested configs
  if (config.contextInjection?.config) {
    errors.push(...validateInjectionConfig(config.contextInjection.config));
  }
  
  return errors;
}

// Configuration builder utility
export class ConfigurationBuilder {
  private config: Partial<WorkflowExecutionConfig> = {};
  
  withParallelBatching(enabled: boolean, maxBatches = 3, batchSize = 5): this {
    this.config.parallelBatching = {
      enabled,
      maxConcurrentBatches: maxBatches,
      batchSizeLimit: batchSize,
      timeoutMs: 1800000
    };
    return this;
  }
  
  withContextInjection(enabled: boolean, config?: Partial<InjectionConfig>): this {
    this.config.contextInjection = {
      enabled,
      config: { ...DEFAULT_INJECTION_CONFIG, ...config }
    };
    return this;
  }
  
  withAgentSelection(autoSelect: boolean, criteria?: Partial<AgentSelectionCriteria>): this {
    this.config.agentSelection = {
      autoSelect,
      criteria: { ...DEFAULT_AGENT_SELECTION_CRITERIA, ...criteria },
      fallbacks: []
    };
    return this;
  }
  
  withErrorHandling(maxRetries: number, fallbackToSequential = true): this {
    this.config.errorHandling = {
      maxRetries,
      fallbackToSequential,
      haltOnCriticalFailure: false
    };
    return this;
  }
  
  build(): WorkflowExecutionConfig {
    const finalConfig = { ...DEFAULT_WORKFLOW_EXECUTION_CONFIG, ...this.config };
    
    // Validate the final configuration
    const errors = validateWorkflowExecutionConfig(finalConfig);
    if (errors.length > 0) {
      throw new Error(`Invalid configuration: ${errors.join(', ')}`);
    }
    
    return finalConfig;
  }
  
  static fromPreset(presetName: keyof typeof CONFIGURATION_PRESETS): ConfigurationBuilder {
    const builder = new ConfigurationBuilder();
    builder.config = { ...CONFIGURATION_PRESETS[presetName] };
    return builder;
  }
}

// Environment-specific configuration loader
export function loadConfiguration(environment = 'development'): WorkflowExecutionConfig {
  const baseConfig = environment in CONFIGURATION_PRESETS 
    ? CONFIGURATION_PRESETS[environment as keyof typeof CONFIGURATION_PRESETS]
    : DEFAULT_WORKFLOW_EXECUTION_CONFIG;
  
  // Override with environment variables if available
  const envOverrides: Partial<WorkflowExecutionConfig> = {};
  
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