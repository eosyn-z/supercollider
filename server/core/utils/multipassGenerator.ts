/**
 * Multipass Universal AI Workflow System - Core Generator
 * Generates multiple context variations and manages real-time compilation
 */

import { EventEmitter } from 'events';
import { MediaInput, MediaType, ProcessingCapability } from './mediaClassifier';
import { WorkflowPlan, WorkflowStep } from '../../../shared/types/enhanced';

export interface ContextVariation {
  id: string;
  name: string;
  contextLevel: 'minimal' | 'standard' | 'detailed' | 'exhaustive';
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

export interface MultipassResult {
  originalPrompt: string;
  variations: ContextVariation[];
  recommendedVariation: string;
  realTimeCompilation: CompiledOutput;
  executionPlan: WorkflowPlan;
}

export interface CompiledOutput {
  id: string;
  status: 'generating' | 'complete' | 'error';
  results: Record<string, any>;
  progressPercentage: number;
  estimatedCompletion: number;
  activeVariations: string[];
}

export interface UserPreferences {
  prioritizeSpeed: boolean;
  prioritizeAccuracy: boolean;
  maxPromptLength: number;
  preferredContextLevel: ContextVariation['contextLevel'];
  includeExamples: boolean;
  focusAreas: string[];
  excludeAreas: string[];
}

export interface PromptComplexityAnalysis {
  wordCount: number;
  sentenceCount: number;
  complexityScore: number;
  detectedIntents: string[];
  ambiguityScore: number;
  specificityScore: number;
  mediaRequirements: MediaType[];
  estimatedProcessingTime: number;
  requiredCapabilities: ProcessingCapability[];
}

export interface VariationStrategy {
  id: string;
  name: string;
  contextLevel: ContextVariation['contextLevel'];
  transformations: PromptTransformation[];
  targetAccuracy: number;
  targetSpeed: number;
  maxLength: number;
}

export interface PromptTransformation {
  type: 'expand' | 'condense' | 'clarify' | 'specialize' | 'generalize' | 'reframe';
  target: string;
  description: string;
  weight: number;
}

export class MultipassGenerator extends EventEmitter {
  private variationStrategies: Map<string, VariationStrategy> = new Map();
  private activeCompilations: Map<string, CompiledOutput> = new Map();
  
  constructor() {
    super();
    this.initializeDefaultStrategies();
  }

  /**
   * Generate multiple context variations for a given prompt and media inputs
   */
  async generateContextVariations(
    basePrompt: string,
    mediaInputs: MediaInput[] = [],
    userPreferences: UserPreferences = this.getDefaultPreferences()
  ): Promise<MultipassResult> {
    try {
      // Analyze prompt complexity
      const analysis = this.analyzePromptComplexity(basePrompt);
      
      // Generate variation strategies
      const strategies = this.generateVariationStrategies(analysis, userPreferences);
      
      // Create context variations
      const variations = await Promise.all(
        strategies.map(strategy => this.createContextVariation(strategy, basePrompt, analysis))
      );

      // Select recommended variation
      const recommendedVariation = this.selectRecommendedVariation(variations, userPreferences);

      // Start real-time compilation
      const compilation = await this.initializeRealTimeCompilation(variations);

      // Generate execution plan
      const executionPlan = await this.generateExecutionPlan(basePrompt, mediaInputs, variations);

      const result: MultipassResult = {
        originalPrompt: basePrompt,
        variations,
        recommendedVariation: recommendedVariation.id,
        realTimeCompilation: compilation,
        executionPlan
      };

      this.emit('multipass-generated', result);
      return result;

    } catch (error) {
      this.emit('multipass-error', error);
      throw new Error(`Failed to generate multipass result: ${error.message}`);
    }
  }

  /**
   * Analyze prompt complexity and characteristics
   */
  private analyzePromptComplexity(prompt: string): PromptComplexityAnalysis {
    const words = prompt.trim().split(/\s+/);
    const sentences = prompt.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    // Calculate complexity metrics
    const wordCount = words.length;
    const sentenceCount = sentences.length;
    const avgWordsPerSentence = wordCount / Math.max(sentenceCount, 1);
    const uniqueWords = new Set(words.map(w => w.toLowerCase())).size;
    const vocabularyRichness = uniqueWords / wordCount;

    // Calculate complexity score (0-100)
    const complexityScore = Math.min(100, Math.round(
      (avgWordsPerSentence * 2) +
      (vocabularyRichness * 30) +
      (wordCount / 10) +
      (this.detectTechnicalTerms(words).length * 5)
    ));

    // Detect intents
    const detectedIntents = this.detectIntents(prompt);
    
    // Calculate ambiguity score
    const ambiguityScore = this.calculateAmbiguityScore(prompt);
    
    // Calculate specificity score
    const specificityScore = this.calculateSpecificityScore(prompt);
    
    // Detect media requirements
    const mediaRequirements = this.detectMediaRequirements(prompt);
    
    // Estimate processing time
    const estimatedProcessingTime = this.estimateProcessingTime(complexityScore, mediaRequirements);
    
    // Identify required capabilities
    const requiredCapabilities = this.identifyRequiredCapabilities(prompt, mediaRequirements);

    return {
      wordCount,
      sentenceCount,
      complexityScore,
      detectedIntents,
      ambiguityScore,
      specificityScore,
      mediaRequirements,
      estimatedProcessingTime,
      requiredCapabilities
    };
  }

  /**
   * Generate appropriate variation strategies based on analysis
   */
  private generateVariationStrategies(
    analysis: PromptComplexityAnalysis,
    preferences: UserPreferences
  ): VariationStrategy[] {
    const strategies: VariationStrategy[] = [];
    const baseStrategies = Array.from(this.variationStrategies.values());

    // Filter strategies based on preferences and analysis
    const filteredStrategies = baseStrategies.filter(strategy => {
      if (preferences.preferredContextLevel && strategy.contextLevel !== preferences.preferredContextLevel) {
        return preferences.prioritizeAccuracy || preferences.prioritizeSpeed;
      }
      return true;
    });

    // Customize strategies based on complexity
    filteredStrategies.forEach(strategy => {
      const customizedStrategy = this.customizeStrategy(strategy, analysis, preferences);
      strategies.push(customizedStrategy);
    });

    // Ensure we have at least minimal and standard variations
    if (!strategies.some(s => s.contextLevel === 'minimal')) {
      strategies.push(this.createMinimalStrategy(analysis));
    }
    if (!strategies.some(s => s.contextLevel === 'standard')) {
      strategies.push(this.createStandardStrategy(analysis));
    }

    return strategies.slice(0, 4); // Limit to 4 variations max
  }

  /**
   * Create a context variation from a strategy
   */
  private async createContextVariation(
    strategy: VariationStrategy,
    basePrompt: string,
    analysis: PromptComplexityAnalysis
  ): Promise<ContextVariation> {
    const variationId = `var-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    
    // Apply transformations
    let generatedPrompt = basePrompt;
    const focusAreas: string[] = [];
    const omittedDetails: string[] = [];
    const enhancedAspects: string[] = [];

    for (const transformation of strategy.transformations) {
      const result = await this.applyTransformation(generatedPrompt, transformation, analysis);
      generatedPrompt = result.prompt;
      
      if (transformation.type === 'expand' || transformation.type === 'clarify') {
        enhancedAspects.push(transformation.target);
      } else if (transformation.type === 'condense') {
        omittedDetails.push(transformation.target);
      }
      
      focusAreas.push(transformation.target);
    }

    // Calculate metrics
    const promptLength = generatedPrompt.length;
    const estimatedAccuracy = this.calculateEstimatedAccuracy(strategy, analysis);
    const estimatedSpeed = this.calculateEstimatedSpeed(strategy, promptLength);

    return {
      id: variationId,
      name: strategy.name,
      contextLevel: strategy.contextLevel,
      promptLength,
      estimatedAccuracy,
      estimatedSpeed,
      generatedPrompt,
      metadata: {
        focusAreas: [...new Set(focusAreas)],
        omittedDetails: [...new Set(omittedDetails)],
        enhancedAspects: [...new Set(enhancedAspects)]
      }
    };
  }

  /**
   * Initialize real-time compilation
   */
  private async initializeRealTimeCompilation(variations: ContextVariation[]): Promise<CompiledOutput> {
    const compilationId = `comp-${Date.now()}`;
    
    const compilation: CompiledOutput = {
      id: compilationId,
      status: 'generating',
      results: {},
      progressPercentage: 0,
      estimatedCompletion: Date.now() + (variations.length * 30000), // 30s per variation
      activeVariations: variations.map(v => v.id)
    };

    this.activeCompilations.set(compilationId, compilation);
    
    // Start background compilation process
    setImmediate(() => this.processCompilation(compilationId, variations));
    
    return compilation;
  }

  /**
   * Process compilation in background
   */
  private async processCompilation(compilationId: string, variations: ContextVariation[]): Promise<void> {
    const compilation = this.activeCompilations.get(compilationId);
    if (!compilation) return;

    try {
      for (let i = 0; i < variations.length; i++) {
        const variation = variations[i];
        
        // Simulate processing (in real implementation, this would call agents)
        const result = await this.simulateVariationProcessing(variation);
        
        compilation.results[variation.id] = result;
        compilation.progressPercentage = Math.round(((i + 1) / variations.length) * 100);
        
        this.emit('compilation-progress', {
          compilationId,
          variationId: variation.id,
          progress: compilation.progressPercentage,
          result
        });
      }
      
      compilation.status = 'complete';
      compilation.progressPercentage = 100;
      
      this.emit('compilation-complete', {
        compilationId,
        results: compilation.results
      });

    } catch (error) {
      compilation.status = 'error';
      this.emit('compilation-error', {
        compilationId,
        error: error.message
      });
    }
  }

  /**
   * Generate execution plan for the workflow
   */
  private async generateExecutionPlan(
    basePrompt: string,
    mediaInputs: MediaInput[],
    variations: ContextVariation[]
  ): Promise<WorkflowPlan> {
    // This would integrate with WorkflowIntelligence
    return {
      id: `plan-${Date.now()}`,
      name: 'Multipass Execution Plan',
      description: 'Generated execution plan for multipass workflow',
      steps: variations.map((variation, index) => ({
        id: `step-${index}`,
        name: `Execute ${variation.name}`,
        description: `Process using ${variation.contextLevel} context level`,
        type: 'process',
        dependencies: index > 0 ? [`step-${index - 1}`] : [],
        estimatedDuration: 30000,
        metadata: {
          variationId: variation.id,
          contextLevel: variation.contextLevel
        }
      })),
      estimatedDuration: variations.length * 30000,
      parallelizable: true,
      metadata: {
        originalPrompt: basePrompt,
        mediaInputCount: mediaInputs.length,
        variationCount: variations.length
      }
    };
  }

  /**
   * Helper methods
   */
  private initializeDefaultStrategies(): void {
    this.variationStrategies.set('minimal', {
      id: 'minimal',
      name: 'Minimal Context',
      contextLevel: 'minimal',
      transformations: [
        { type: 'condense', target: 'verbosity', description: 'Remove unnecessary details', weight: 0.8 },
        { type: 'clarify', target: 'core_intent', description: 'Focus on main objective', weight: 1.0 }
      ],
      targetAccuracy: 70,
      targetSpeed: 95,
      maxLength: 500
    });

    this.variationStrategies.set('standard', {
      id: 'standard',
      name: 'Standard Context',
      contextLevel: 'standard',
      transformations: [
        { type: 'clarify', target: 'requirements', description: 'Clarify requirements', weight: 0.7 },
        { type: 'specialize', target: 'domain', description: 'Add domain-specific context', weight: 0.6 }
      ],
      targetAccuracy: 85,
      targetSpeed: 75,
      maxLength: 1000
    });

    this.variationStrategies.set('detailed', {
      id: 'detailed',
      name: 'Detailed Context',
      contextLevel: 'detailed',
      transformations: [
        { type: 'expand', target: 'context', description: 'Add comprehensive context', weight: 0.8 },
        { type: 'clarify', target: 'edge_cases', description: 'Address edge cases', weight: 0.6 },
        { type: 'specialize', target: 'methodology', description: 'Specify methodology', weight: 0.7 }
      ],
      targetAccuracy: 92,
      targetSpeed: 60,
      maxLength: 2000
    });

    this.variationStrategies.set('exhaustive', {
      id: 'exhaustive',
      name: 'Exhaustive Context',
      contextLevel: 'exhaustive',
      transformations: [
        { type: 'expand', target: 'comprehensive', description: 'Maximum context expansion', weight: 1.0 },
        { type: 'clarify', target: 'all_aspects', description: 'Clarify all aspects', weight: 0.9 },
        { type: 'specialize', target: 'expert_level', description: 'Expert-level specialization', weight: 0.8 }
      ],
      targetAccuracy: 96,
      targetSpeed: 40,
      maxLength: 4000
    });
  }

  private detectIntents(prompt: string): string[] {
    const intents: string[] = [];
    const lowerPrompt = prompt.toLowerCase();

    const intentPatterns = {
      'analyze': /\b(analyz|examin|evaluat|assess|review)\w*/g,
      'create': /\b(creat|generat|build|develop|design|make)\w*/g,
      'summarize': /\b(summar|abstract|brief|overview|synopsis)\w*/g,
      'compare': /\b(compar|contrast|differ|similar|versus)\w*/g,
      'explain': /\b(explain|describ|clarify|interpret|elaborate)\w*/g,
      'research': /\b(research|investigat|find|discover|explore)\w*/g,
      'translate': /\b(translat|convert|transform|adapt)\w*/g,
      'optimize': /\b(optim|improv|enhanc|refin|better)\w*/g
    };

    Object.entries(intentPatterns).forEach(([intent, pattern]) => {
      if (pattern.test(lowerPrompt)) {
        intents.push(intent);
      }
    });

    return intents;
  }

  private detectTechnicalTerms(words: string[]): string[] {
    const technicalTerms = [
      'algorithm', 'api', 'database', 'framework', 'architecture', 'optimization',
      'analytics', 'regression', 'classification', 'neural', 'machine learning',
      'statistics', 'probability', 'methodology', 'implementation', 'protocol'
    ];

    return words.filter(word => 
      technicalTerms.some(term => 
        word.toLowerCase().includes(term) || term.includes(word.toLowerCase())
      )
    );
  }

  private calculateAmbiguityScore(prompt: string): number {
    const ambiguousWords = ['maybe', 'perhaps', 'possibly', 'might', 'could', 'some', 'various', 'several'];
    const questionMarks = (prompt.match(/\?/g) || []).length;
    const ambiguousMatches = ambiguousWords.filter(word => 
      prompt.toLowerCase().includes(word)
    ).length;

    return Math.min(100, (ambiguousMatches * 15) + (questionMarks * 10));
  }

  private calculateSpecificityScore(prompt: string): number {
    const specificIndicators = /\b(\d+|specific|exact|precise|particular|detailed|explicit)\b/gi;
    const matches = (prompt.match(specificIndicators) || []).length;
    const promptLength = prompt.split(/\s+/).length;
    
    return Math.min(100, (matches / promptLength) * 200);
  }

  private detectMediaRequirements(prompt: string): MediaType[] {
    const mediaKeywords = {
      'image': ['image', 'picture', 'photo', 'visual', 'graphic', 'chart', 'diagram'],
      'video': ['video', 'movie', 'clip', 'recording', 'footage'],
      'audio': ['audio', 'sound', 'music', 'voice', 'speech', 'recording'],
      'document': ['document', 'pdf', 'file', 'report', 'paper', 'text'],
      'data': ['data', 'dataset', 'csv', 'json', 'database', 'table']
    };

    const requirements: MediaType[] = [];
    const lowerPrompt = prompt.toLowerCase();

    Object.entries(mediaKeywords).forEach(([mediaType, keywords]) => {
      if (keywords.some(keyword => lowerPrompt.includes(keyword))) {
        requirements.push(mediaType as MediaType);
      }
    });

    return requirements.length > 0 ? requirements : ['text'];
  }

  private estimateProcessingTime(complexityScore: number, mediaRequirements: MediaType[]): number {
    const baseTime = 30000; // 30 seconds
    const complexityMultiplier = complexityScore / 100;
    const mediaMultiplier = mediaRequirements.length * 0.5;
    
    return Math.round(baseTime * (1 + complexityMultiplier + mediaMultiplier));
  }

  private identifyRequiredCapabilities(prompt: string, mediaTypes: MediaType[]): ProcessingCapability[] {
    const capabilities: ProcessingCapability[] = [];
    const lowerPrompt = prompt.toLowerCase();

    const capabilityKeywords = {
      'analyze': ['analyze', 'examine', 'evaluate', 'assess'],
      'generate': ['create', 'generate', 'produce', 'make'],
      'transform': ['convert', 'transform', 'change', 'modify'],
      'extract': ['extract', 'pull', 'get', 'retrieve'],
      'synthesize': ['combine', 'merge', 'synthesize', 'integrate'],
      'caption': ['caption', 'describe', 'label'],
      'transcribe': ['transcribe', 'convert speech', 'speech to text']
    };

    Object.entries(capabilityKeywords).forEach(([capability, keywords]) => {
      if (keywords.some(keyword => lowerPrompt.includes(keyword))) {
        capabilities.push(capability as ProcessingCapability);
      }
    });

    // Add media-specific capabilities
    if (mediaTypes.includes('image') && !capabilities.includes('caption')) {
      capabilities.push('caption');
    }
    if (mediaTypes.includes('audio') && !capabilities.includes('transcribe')) {
      capabilities.push('transcribe');
    }

    return capabilities.length > 0 ? capabilities : ['analyze'];
  }

  private customizeStrategy(
    strategy: VariationStrategy,
    analysis: PromptComplexityAnalysis,
    preferences: UserPreferences
  ): VariationStrategy {
    const customized = { ...strategy };
    
    // Adjust based on complexity
    if (analysis.complexityScore > 70) {
      customized.transformations = customized.transformations.map(t => ({
        ...t,
        weight: t.weight * 1.2
      }));
    }

    // Adjust based on preferences
    if (preferences.prioritizeSpeed) {
      customized.maxLength = Math.min(customized.maxLength, preferences.maxPromptLength);
    }

    if (preferences.focusAreas.length > 0) {
      customized.transformations.push({
        type: 'specialize',
        target: preferences.focusAreas.join(', '),
        description: 'Focus on user-specified areas',
        weight: 0.9
      });
    }

    return customized;
  }

  private async applyTransformation(
    prompt: string,
    transformation: PromptTransformation,
    analysis: PromptComplexityAnalysis
  ): Promise<{ prompt: string; metadata: any }> {
    // Simplified transformation logic - in production this would be more sophisticated
    let transformedPrompt = prompt;
    
    switch (transformation.type) {
      case 'expand':
        transformedPrompt = this.expandPrompt(prompt, transformation.target);
        break;
      case 'condense':
        transformedPrompt = this.condensePrompt(prompt, transformation.target);
        break;
      case 'clarify':
        transformedPrompt = this.clarifyPrompt(prompt, transformation.target);
        break;
      case 'specialize':
        transformedPrompt = this.specializePrompt(prompt, transformation.target);
        break;
      case 'generalize':
        transformedPrompt = this.generalizePrompt(prompt, transformation.target);
        break;
      case 'reframe':
        transformedPrompt = this.reframePrompt(prompt, transformation.target);
        break;
    }

    return { prompt: transformedPrompt, metadata: { transformation: transformation.type } };
  }

  private expandPrompt(prompt: string, target: string): string {
    const expansions = {
      'context': '\n\nAdditional Context:\n- Consider all relevant background information\n- Include related concepts and dependencies\n- Account for edge cases and exceptions',
      'comprehensive': '\n\nComprehensive Requirements:\n- Provide detailed step-by-step approach\n- Include examples and illustrations\n- Consider multiple perspectives and alternatives',
      'methodology': '\n\nMethodology:\n- Use systematic approach\n- Document assumptions and limitations\n- Provide validation criteria'
    };
    
    return prompt + (expansions[target] || `\n\nAdditional focus on: ${target}`);
  }

  private condensePrompt(prompt: string, target: string): string {
    // Remove redundant phrases and verbose explanations
    return prompt
      .replace(/\b(please|kindly|if you would|if possible)\b/gi, '')
      .replace(/\s+/g, ' ')
      .replace(/\.\s*\./g, '.')
      .trim();
  }

  private clarifyPrompt(prompt: string, target: string): string {
    const clarifications = {
      'core_intent': '\n\nCore Objective: Focus on the primary goal and desired outcome.',
      'requirements': '\n\nSpecific Requirements: Define clear success criteria and constraints.',
      'edge_cases': '\n\nEdge Cases: Consider unusual scenarios and error conditions.',
      'all_aspects': '\n\nComprehensive Clarification: Address all ambiguities and assumptions.'
    };
    
    return prompt + (clarifications[target] || `\n\nClarification needed for: ${target}`);
  }

  private specializePrompt(prompt: string, target: string): string {
    const specializations = {
      'domain': '\n\nDomain Expertise: Apply industry-specific knowledge and best practices.',
      'methodology': '\n\nSpecialized Methodology: Use proven techniques and frameworks.',
      'expert_level': '\n\nExpert Analysis: Provide professional-grade insights and recommendations.'
    };
    
    return prompt + (specializations[target] || `\n\nSpecialize for: ${target}`);
  }

  private generalizePrompt(prompt: string, target: string): string {
    return prompt + `\n\nGeneral Approach: Consider broader applications and universal principles for ${target}.`;
  }

  private reframePrompt(prompt: string, target: string): string {
    return `Reframed perspective on ${target}: ` + prompt + '\n\nConsider alternative viewpoints and approaches.';
  }

  private selectRecommendedVariation(
    variations: ContextVariation[],
    preferences: UserPreferences
  ): ContextVariation {
    // Score each variation based on preferences
    const scoredVariations = variations.map(variation => {
      let score = 0;
      
      if (preferences.prioritizeAccuracy) {
        score += variation.estimatedAccuracy * 0.6;
      }
      
      if (preferences.prioritizeSpeed) {
        score += variation.estimatedSpeed * 0.6;
      }
      
      if (preferences.preferredContextLevel === variation.contextLevel) {
        score += 20;
      }
      
      // Penalize if too long
      if (variation.promptLength > preferences.maxPromptLength) {
        score -= 10;
      }
      
      return { variation, score };
    });

    return scoredVariations.sort((a, b) => b.score - a.score)[0].variation;
  }

  private calculateEstimatedAccuracy(strategy: VariationStrategy, analysis: PromptComplexityAnalysis): number {
    let accuracy = strategy.targetAccuracy;
    
    // Adjust based on prompt complexity
    if (analysis.complexityScore > 80) {
      accuracy -= 5;
    } else if (analysis.complexityScore < 30) {
      accuracy += 5;
    }
    
    // Adjust based on ambiguity
    accuracy -= analysis.ambiguityScore * 0.1;
    
    return Math.min(99, Math.max(60, Math.round(accuracy)));
  }

  private calculateEstimatedSpeed(strategy: VariationStrategy, promptLength: number): number {
    let speed = strategy.targetSpeed;
    
    // Adjust based on prompt length
    const lengthPenalty = Math.max(0, (promptLength - 500) / 100);
    speed -= lengthPenalty;
    
    return Math.min(99, Math.max(30, Math.round(speed)));
  }

  private createMinimalStrategy(analysis: PromptComplexityAnalysis): VariationStrategy {
    return {
      id: 'minimal-custom',
      name: 'Quick & Minimal',
      contextLevel: 'minimal',
      transformations: [
        { type: 'condense', target: 'verbosity', description: 'Minimize verbosity', weight: 1.0 }
      ],
      targetAccuracy: 70,
      targetSpeed: 95,
      maxLength: 300
    };
  }

  private createStandardStrategy(analysis: PromptComplexityAnalysis): VariationStrategy {
    return {
      id: 'standard-custom',
      name: 'Balanced Standard',
      contextLevel: 'standard',
      transformations: [
        { type: 'clarify', target: 'requirements', description: 'Clarify key requirements', weight: 0.8 }
      ],
      targetAccuracy: 85,
      targetSpeed: 75,
      maxLength: 1000
    };
  }

  private async simulateVariationProcessing(variation: ContextVariation): Promise<any> {
    // Simulate processing time based on variation characteristics
    const processingTime = Math.random() * 2000 + 1000; // 1-3 seconds
    
    await new Promise(resolve => setTimeout(resolve, processingTime));
    
    return {
      variationId: variation.id,
      result: `Processed result for ${variation.name}`,
      quality: variation.estimatedAccuracy,
      processingTime,
      metadata: variation.metadata
    };
  }

  private getDefaultPreferences(): UserPreferences {
    return {
      prioritizeSpeed: false,
      prioritizeAccuracy: true,
      maxPromptLength: 2000,
      preferredContextLevel: 'standard',
      includeExamples: true,
      focusAreas: [],
      excludeAreas: []
    };
  }

  /**
   * Get active compilation status
   */
  getCompilationStatus(compilationId: string): CompiledOutput | null {
    return this.activeCompilations.get(compilationId) || null;
  }

  /**
   * Cancel active compilation
   */
  cancelCompilation(compilationId: string): boolean {
    const compilation = this.activeCompilations.get(compilationId);
    if (compilation && compilation.status === 'generating') {
      compilation.status = 'error';
      this.activeCompilations.delete(compilationId);
      this.emit('compilation-cancelled', { compilationId });
      return true;
    }
    return false;
  }
}