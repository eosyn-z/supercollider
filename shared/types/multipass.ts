export type MediaType = 'text' | 'image' | 'video' | 'audio' | 'document' | 'code' | 'data' | 'url' | 'mixed';
export type ProcessingCapability = 'analyze' | 'generate' | 'transform' | 'extract' | 'synthesize' | 'caption' | 'transcribe';
export type ContextLevel = 'minimal' | 'standard' | 'detailed' | 'exhaustive';
export type WorkflowStepType = 'process' | 'generate' | 'analyze' | 'transform' | 'validate';
export type CompilationStatus = 'generating' | 'complete' | 'error';
export type WorkflowStatus = 'success' | 'partial' | 'failed';
export type MergeApproach = 'sequential' | 'parallel' | 'hierarchical' | 'weighted';
export type ConflictResolution = 'voting' | 'confidence' | 'user_select' | 'merge_all';
export type ConflictType = 'format' | 'content' | 'style' | 'accuracy';
export type RefinementImpact = 'low' | 'medium' | 'high';

export interface MediaInput {
  id: string;
  type: MediaType;
  source: string | Buffer | File;
  metadata: {
    format: string;
    size: number;
    duration?: number;
    dimensions?: { width: number; height: number };
  };
  capabilities: ProcessingCapability[];
}

export interface MediaOutput {
  id: string;
  type: MediaType;
  content: any;
  metadata: {
    format: string;
    size: number;
    processingTime: number;
    quality: number;
  };
  sourceInputId: string;
}

export interface ContextVariation {
  id: string;
  name: string;
  contextLevel: ContextLevel;
  promptLength: number;
  estimatedAccuracy: number;
  estimatedSpeed: number;
  generatedPrompt: string;
  metadata: {
    focusAreas: string[];
    omittedDetails: string[];
    enhancedAspects: string[];
  };
}

export interface UserPreferences {
  preferredSpeed: number; // 1-10 scale
  preferredAccuracy: number; // 1-10 scale
  budgetConstraints?: {
    maxCostPerRequest: number;
    maxTotalCost: number;
  };
  outputFormats: MediaType[];
  processingPriorities: ProcessingCapability[];
}

export interface PromptComplexityAnalysis {
  complexity: number; // 1-10 scale
  ambiguityScore: number; // 1-10 scale
  requiredCapabilities: ProcessingCapability[];
  detectedIntents: string[];
  missingDetails: string[];
  suggestedRefinements: string[];
}

export interface VariationStrategy {
  id: string;
  name: string;
  description: string;
  targetContextLevel: ContextLevel;
  focusAreas: string[];
  compressionRatio: number;
  enhancementAreas: string[];
}

export interface CompilationProgress {
  variationId: string;
  status: CompilationStatus;
  progress: number; // 0-100
  estimatedCompletion: number; // milliseconds
  currentStep: string;
  results?: any;
}

export interface CompiledOutput {
  id: string;
  status: CompilationStatus;
  results: Record<string, any>;
  progressPercentage: number;
  estimatedCompletion: number;
  activeVariations: string[];
}

export interface WorkflowPlan {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  estimatedDuration: number;
  requiredCapabilities: ProcessingCapability[];
  inputTypes: MediaType[];
  outputTypes: MediaType[];
  parallelizable: boolean;
  successProbability: number;
}

export interface WorkflowStep {
  id: string;
  name: string;
  type: WorkflowStepType;
  processor: string; // Agent ID or API endpoint
  inputSchema: any;
  outputSchema: any;
  errorHandling: ErrorHandlingStrategy;
  fallbackOptions: string[];
  dependencies: string[];
  canBatch: boolean;
}

export interface ErrorHandlingStrategy {
  retryCount: number;
  retryDelay: number;
  fallbackAgents: string[];
  escalationThreshold: number;
  gracefulDegradation: boolean;
}

export interface ProcessingStep {
  id: string;
  name: string;
  inputType: MediaType;
  outputType: MediaType;
  apiEndpoint?: string;
  localProcessor?: string;
  dependencies: string[];
  canBatch: boolean;
}

export interface ProcessingPipeline {
  id: string;
  inputTypes: MediaType[];
  outputTypes: MediaType[];
  steps: ProcessingStep[];
  parallelizable: boolean;
  estimatedDuration: number;
}

export interface MultipassResult {
  originalPrompt: string;
  variations: ContextVariation[];
  recommendedVariation: string;
  realTimeCompilation: CompiledOutput;
  executionPlan: WorkflowPlan;
}

export interface IntentAnalysis {
  primaryIntent: string;
  secondaryIntents: string[];
  confidence: number;
  requiredInputs: MediaType[];
  expectedOutputs: MediaType[];
  complexity: number;
}

export interface RefinementRequest {
  id: string;
  category: string;
  question: string;
  suggestions: string[];
  required: boolean;
  impact: RefinementImpact;
}

export interface SmartShredderResult {
  needsRefinement: boolean;
  missingDetails: RefinementRequest[];
  proposedWorkflow: WorkflowPlan;
  confidenceScore: number;
  alternativeApproaches: WorkflowPlan[];
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  inputPattern: RegExp;
  mediaTypes: MediaType[];
  steps: WorkflowStep[];
  successRate: number;
  averageDuration: number;
}

export interface CompilationStrategy {
  id: string;
  name: string;
  description: string;
  mergeApproach: MergeApproach;
  conflictResolution: ConflictResolution;
  qualityThreshold: number;
}

export interface CompilationResult {
  strategy: CompilationStrategy;
  mergedOutput: any;
  sourceVariations: string[];
  qualityScore: number;
  processingTime: number;
  conflicts: ConflictReport[];
}

export interface ConflictReport {
  variationIds: string[];
  conflictType: ConflictType;
  description: string;
  resolutionSuggestion: string;
  userActionRequired: boolean;
}

export interface UniversalAgent {
  id: string;
  name: string;
  capabilities: ProcessingCapability[];
  supportedInputTypes: MediaType[];
  supportedOutputTypes: MediaType[];
  apiEndpoint?: string;
  costPerRequest: number;
  averageLatency: number;
  reliabilityScore: number;
  batchingSupported: boolean;
}

export interface AgentConstraints {
  maxCostPerRequest?: number;
  maxLatency?: number;
  minReliability?: number;
  preferredAgents?: string[];
  excludedAgents?: string[];
}

export interface AgentSelection {
  agentId: string;
  taskId: string;
  inputType: MediaType;
  outputType: MediaType;
  confidence: number;
  fallbackAgents: string[];
}

export interface ProcessingPlan {
  id: string;
  steps: ProcessingStep[];
  estimatedCost: number;
  estimatedDuration: number;
  selectedAgents: AgentSelection[];
}

export interface ExecutionContext {
  workflowId: string;
  userId?: string;
  sessionId: string;
  startTime: number;
  preferences: UserPreferences;
  availableAgents: UniversalAgent[];
}

export interface WorkflowError {
  id: string;
  type: 'agent_failure' | 'timeout' | 'invalid_input' | 'processing_error' | 'resource_limit';
  message: string;
  stepId: string;
  agentId?: string;
  timestamp: number;
  retryable: boolean;
}

export interface ErrorResolution {
  action: 'retry' | 'fallback' | 'skip' | 'abort';
  fallbackAgentId?: string;
  delay?: number;
  message: string;
}

export interface ExecutionMetrics {
  totalDuration: number;
  successfulSteps: number;
  failedSteps: number;
  totalCost: number;
  averageLatency: number;
  qualityScore: number;
  userSatisfaction?: number;
}

export interface UserActionRequired {
  id: string;
  type: 'input_required' | 'conflict_resolution' | 'approval_needed' | 'refinement_suggestion';
  message: string;
  options: string[];
  timeout?: number;
  blocking: boolean;
}

export interface WorkflowResult {
  id: string;
  status: WorkflowStatus;
  outputs: MediaOutput[];
  compiledResult: CompilationResult;
  executionMetrics: ExecutionMetrics;
  userActions: UserActionRequired[];
}

export interface RefinementResponse {
  requestId: string;
  response: string;
  confidence: number;
  skipReason?: string;
}