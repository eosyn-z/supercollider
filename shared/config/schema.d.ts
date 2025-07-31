import { DispatchConfig, InjectionConfig, AgentSelectionCriteria, WorkflowExecutionConfig, ConfigurationSchema } from '../types/enhanced';
export declare const DEFAULT_DISPATCH_CONFIG: DispatchConfig;
export declare const DEFAULT_INJECTION_CONFIG: InjectionConfig;
export declare const DEFAULT_AGENT_SELECTION_CRITERIA: AgentSelectionCriteria;
export declare const DEFAULT_WORKFLOW_EXECUTION_CONFIG: WorkflowExecutionConfig;
export declare const SUPERCOLLIDER_CONFIG_SCHEMA: ConfigurationSchema;
export declare const CONFIGURATION_PRESETS: {
    readonly development: {
        readonly parallelBatching: {
            readonly enabled: false;
            readonly maxConcurrentBatches: 1;
            readonly batchSizeLimit: number;
            readonly timeoutMs: number;
        };
        readonly errorHandling: {
            readonly maxRetries: 1;
            readonly haltOnCriticalFailure: true;
            readonly fallbackToSequential: boolean;
        };
        readonly contextInjection: {
            enabled: boolean;
            config: InjectionConfig;
        };
        readonly agentSelection: {
            autoSelect: boolean;
            criteria: AgentSelectionCriteria;
            fallbacks: string[];
        };
    };
    readonly production: {
        readonly parallelBatching: {
            readonly enabled: true;
            readonly maxConcurrentBatches: 5;
            readonly batchSizeLimit: 8;
            readonly timeoutMs: number;
        };
        readonly errorHandling: {
            readonly maxRetries: 5;
            readonly fallbackToSequential: true;
            readonly haltOnCriticalFailure: false;
        };
        readonly contextInjection: {
            enabled: boolean;
            config: InjectionConfig;
        };
        readonly agentSelection: {
            autoSelect: boolean;
            criteria: AgentSelectionCriteria;
            fallbacks: string[];
        };
    };
    readonly highThroughput: {
        readonly parallelBatching: {
            readonly enabled: true;
            readonly maxConcurrentBatches: 10;
            readonly batchSizeLimit: 10;
            readonly timeoutMs: 3600000;
        };
        readonly contextInjection: {
            readonly enabled: true;
            readonly config: {
                readonly maxContextLength: 2000;
                readonly includeTone: boolean;
                readonly includeFormat: boolean;
                readonly includeOriginalPrompt: boolean;
                readonly includeStyleGuide: boolean;
                readonly customPrefix?: string;
                readonly customSuffix?: string;
            };
        };
        readonly agentSelection: {
            autoSelect: boolean;
            criteria: AgentSelectionCriteria;
            fallbacks: string[];
        };
        readonly errorHandling: {
            maxRetries: number;
            fallbackToSequential: boolean;
            haltOnCriticalFailure: boolean;
        };
    };
    readonly costOptimized: {
        readonly parallelBatching: {
            readonly enabled: false;
            readonly maxConcurrentBatches: 1;
            readonly batchSizeLimit: 3;
            readonly timeoutMs: 7200000;
        };
        readonly agentSelection: {
            readonly autoSelect: true;
            readonly criteria: {
                readonly maxCost: 0.05;
                readonly taskType?: import("../../core/types/subtaskSchema").SubtaskType;
                readonly requiredTags?: import("../types/enhanced").AgentTag[];
                readonly preferredProviders?: string[];
                readonly minSuccessRate?: number;
                readonly minQualityScore?: number;
                readonly excludeAgents?: string[];
            };
            readonly fallbacks: readonly [];
        };
        readonly contextInjection: {
            enabled: boolean;
            config: InjectionConfig;
        };
        readonly errorHandling: {
            maxRetries: number;
            fallbackToSequential: boolean;
            haltOnCriticalFailure: boolean;
        };
    };
    readonly qualityFocused: {
        readonly agentSelection: {
            readonly autoSelect: true;
            readonly criteria: {
                readonly minSuccessRate: 90;
                readonly minQualityScore: 85;
                readonly taskType?: import("../../core/types/subtaskSchema").SubtaskType;
                readonly requiredTags?: import("../types/enhanced").AgentTag[];
                readonly preferredProviders?: string[];
                readonly maxCost?: number;
                readonly excludeAgents?: string[];
            };
            readonly fallbacks: readonly [];
        };
        readonly contextInjection: {
            readonly enabled: true;
            readonly config: {
                readonly maxContextLength: 8000;
                readonly includeStyleGuide: true;
                readonly includeTone: boolean;
                readonly includeFormat: boolean;
                readonly includeOriginalPrompt: boolean;
                readonly customPrefix?: string;
                readonly customSuffix?: string;
            };
        };
        readonly errorHandling: {
            readonly maxRetries: 5;
            readonly fallbackToSequential: boolean;
            readonly haltOnCriticalFailure: boolean;
        };
        readonly parallelBatching: {
            enabled: boolean;
            maxConcurrentBatches: number;
            batchSizeLimit: number;
            timeoutMs: number;
        };
    };
};
export declare function validateDispatchConfig(config: Partial<DispatchConfig>): string[];
export declare function validateInjectionConfig(config: Partial<InjectionConfig>): string[];
export declare function validateWorkflowExecutionConfig(config: Partial<WorkflowExecutionConfig>): string[];
export declare class ConfigurationBuilder {
    private config;
    withParallelBatching(enabled: boolean, maxBatches?: number, batchSize?: number): this;
    withContextInjection(enabled: boolean, config?: Partial<InjectionConfig>): this;
    withAgentSelection(autoSelect: boolean, criteria?: Partial<AgentSelectionCriteria>): this;
    withErrorHandling(maxRetries: number, fallbackToSequential?: boolean): this;
    build(): WorkflowExecutionConfig;
    static fromPreset(presetName: keyof typeof CONFIGURATION_PRESETS): ConfigurationBuilder;
}
export declare function loadConfiguration(environment?: string): WorkflowExecutionConfig;
//# sourceMappingURL=schema.d.ts.map