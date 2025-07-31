/**
 * Validator for AI output validation with flexible rules
 */

import { Subtask } from '../types/subtaskSchema';
import { 
  ValidationResult, 
  ValidationConfig, 
  ValidationRule, 
  RuleResult,
  ValidationRuleConfig 
} from '../types/executionTypes';

export class Validator {
  private embeddings: Map<string, number[]> = new Map(); // Simple embedding cache

  /**
   * Validates output against subtask validation configuration
   */
  validateOutput(subtask: Subtask, output: string): ValidationResult {
    const validationConfig = this.getValidationConfig(subtask);
    
    if (!validationConfig.enabled) {
      return {
        passed: true,
        confidence: 1.0,
        ruleResults: [],
        shouldHalt: false,
        shouldRetry: false,
        errors: [],
        warnings: []
      };
    }

    const ruleResults: RuleResult[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    let totalWeightedScore = 0;
    let totalWeight = 0;
    let hasRequiredFailure = false;

    // Execute all validation rules
    for (const rule of validationConfig.rules) {
      try {
        const result = this.executeRule(rule, subtask, output);
        ruleResults.push(result);

        // Check for required rule failures
        if (rule.required && !result.passed) {
          hasRequiredFailure = true;
          errors.push(`Required validation rule '${rule.name}' failed: ${result.message}`);
        }

        // Add to weighted score calculation
        totalWeightedScore += result.score * rule.weight;
        totalWeight += rule.weight;

        // Collect warnings for non-critical failures
        if (!result.passed && !rule.required) {
          warnings.push(`Validation rule '${rule.name}' failed: ${result.message}`);
        }

      } catch (error) {
        const errorResult: RuleResult = {
          ruleName: rule.name,
          passed: false,
          score: 0,
          message: `Rule execution error: ${error.message}`
        };
        ruleResults.push(errorResult);
        errors.push(`Error executing rule '${rule.name}': ${error.message}`);
      }
    }

    // Calculate overall confidence
    const confidence = totalWeight > 0 ? totalWeightedScore / totalWeight : 0;
    
    // Determine if validation passed
    const passed = !hasRequiredFailure && 
                  confidence >= validationConfig.confidence.minThreshold;

    // Determine if execution should halt
    const shouldHalt = hasRequiredFailure || 
                      confidence < validationConfig.confidence.haltThreshold;

    // Determine if retry should occur
    const shouldRetry = validationConfig.retryOnFailure && 
                       !passed && 
                       !shouldHalt;

    return {
      passed,
      confidence,
      ruleResults,
      shouldHalt,
      shouldRetry,
      errors,
      warnings
    };
  }

  /**
   * Executes a single validation rule
   */
  private executeRule(rule: ValidationRule, subtask: Subtask, output: string): RuleResult {
    switch (rule.type) {
      case 'SCHEMA':
        return this.executeSchemaRule(rule, subtask, output);
      case 'REGEX':
        return this.executeRegexRule(rule, subtask, output);
      case 'SEMANTIC':
        return this.executeSemanticRule(rule, subtask, output);
      case 'CUSTOM':
        return this.executeCustomRule(rule, subtask, output);
      default:
        throw new Error(`Unknown validation rule type: ${rule.type}`);
    }
  }

  /**
   * Executes schema validation rule
   */
  private executeSchemaRule(rule: ValidationRule, subtask: Subtask, output: string): RuleResult {
    const config = rule.config;
    
    if (!config.schema) {
      return {
        ruleName: rule.name,
        passed: false,
        score: 0,
        message: 'No schema provided for validation'
      };
    }

    try {
      // Try to parse output as JSON
      const parsedOutput = JSON.parse(output);
      
      // Simple schema validation (in production, use a library like Ajv)
      const isValid = this.validateAgainstSchema(parsedOutput, config.schema);
      
      return {
        ruleName: rule.name,
        passed: isValid,
        score: isValid ? 1.0 : 0.0,
        message: isValid ? 'Schema validation passed' : 'Output does not match required schema',
        details: { schema: config.schema, parsedOutput }
      };

    } catch (error) {
      return {
        ruleName: rule.name,
        passed: false,
        score: 0,
        message: `Failed to parse output as JSON: ${error.message}`
      };
    }
  }

  /**
   * Executes regex validation rule
   */
  private executeRegexRule(rule: ValidationRule, subtask: Subtask, output: string): RuleResult {
    const config = rule.config;
    
    if (!config.pattern) {
      return {
        ruleName: rule.name,
        passed: false,
        score: 0,
        message: 'No pattern provided for regex validation'
      };
    }

    try {
      const regex = new RegExp(config.pattern, config.flags || '');
      const matches = output.match(regex);
      const passed = matches !== null;
      
      return {
        ruleName: rule.name,
        passed,
        score: passed ? 1.0 : 0.0,
        message: passed ? 
          `Pattern matched: found ${matches!.length} matches` : 
          'Pattern did not match',
        details: { pattern: config.pattern, matches }
      };

    } catch (error) {
      return {
        ruleName: rule.name,
        passed: false,
        score: 0,
        message: `Invalid regex pattern: ${error.message}`
      };
    }
  }

  /**
   * Executes semantic similarity validation rule
   */
  private executeSemanticRule(rule: ValidationRule, subtask: Subtask, output: string): RuleResult {
    const config = rule.config;
    
    if (!config.expectedTopics || config.expectedTopics.length === 0) {
      return {
        ruleName: rule.name,
        passed: false,
        score: 0,
        message: 'No expected topics provided for semantic validation'
      };
    }

    try {
      // Calculate semantic similarity using simple keyword matching
      // In production, this would use proper embeddings and cosine similarity
      const similarities = config.expectedTopics.map(topic => 
        this.calculateSimpleSimilarity(output, topic)
      );
      
      const maxSimilarity = Math.max(...similarities);
      const threshold = config.similarityThreshold || 0.5;
      const passed = maxSimilarity >= threshold;
      
      return {
        ruleName: rule.name,
        passed,
        score: maxSimilarity,
        message: passed ? 
          `Semantic similarity passed: ${(maxSimilarity * 100).toFixed(1)}%` :
          `Semantic similarity too low: ${(maxSimilarity * 100).toFixed(1)}% (threshold: ${(threshold * 100).toFixed(1)}%)`,
        details: { 
          similarities: config.expectedTopics.map((topic, i) => ({
            topic,
            similarity: similarities[i]
          })),
          maxSimilarity,
          threshold
        }
      };

    } catch (error) {
      return {
        ruleName: rule.name,
        passed: false,
        score: 0,
        message: `Semantic validation error: ${error.message}`
      };
    }
  }

  /**
   * Executes custom validation rule
   */
  private executeCustomRule(rule: ValidationRule, subtask: Subtask, output: string): RuleResult {
    const config = rule.config;
    
    if (!config.customFunction) {
      return {
        ruleName: rule.name,
        passed: false,
        score: 0,
        message: 'No custom function provided'
      };
    }

    try {
      // In production, this would safely execute user-defined validation functions
      // For now, we'll implement some common custom validations
      const result = this.executeBuiltinCustomFunction(
        config.customFunction, 
        output, 
        config.parameters || {},
        subtask
      );
      
      return {
        ruleName: rule.name,
        passed: result.passed,
        score: result.score,
        message: result.message,
        details: result.details
      };

    } catch (error) {
      return {
        ruleName: rule.name,
        passed: false,
        score: 0,
        message: `Custom validation error: ${error.message}`
      };
    }
  }

  /**
   * Executes built-in custom validation functions
   */
  private executeBuiltinCustomFunction(
    functionName: string, 
    output: string, 
    parameters: Record<string, any>,
    subtask: Subtask
  ): { passed: boolean; score: number; message: string; details?: any } {
    switch (functionName) {
      case 'wordCount':
        return this.validateWordCount(output, parameters);
      case 'hasKeywords':
        return this.validateKeywords(output, parameters);
      case 'sentimentPositive':
        return this.validateSentiment(output, 'positive');
      case 'sentimentNegative':
        return this.validateSentiment(output, 'negative');
      case 'codeBlocks':
        return this.validateCodeBlocks(output, parameters);
      case 'urlsPresent':
        return this.validateUrls(output, parameters);
      default:
        throw new Error(`Unknown custom function: ${functionName}`);
    }
  }

  /**
   * Word count validation
   */
  private validateWordCount(output: string, params: Record<string, any>) {
    const wordCount = output.trim().split(/\s+/).length;
    const min = params.min || 0;
    const max = params.max || Infinity;
    
    const passed = wordCount >= min && wordCount <= max;
    const score = passed ? 1.0 : Math.max(0, 1 - Math.abs(wordCount - (min + max) / 2) / Math.max(min, max - min));
    
    return {
      passed,
      score,
      message: `Word count: ${wordCount} (range: ${min}-${max === Infinity ? '∞' : max})`,
      details: { wordCount, min, max }
    };
  }

  /**
   * Keywords validation
   */
  private validateKeywords(output: string, params: Record<string, any>) {
    const keywords = params.keywords || [];
    const requiredCount = params.requiredCount || keywords.length;
    const caseSensitive = params.caseSensitive || false;
    
    const text = caseSensitive ? output : output.toLowerCase();
    const foundKeywords = keywords.filter((keyword: string) => {
      const searchTerm = caseSensitive ? keyword : keyword.toLowerCase();
      return text.includes(searchTerm);
    });
    
    const passed = foundKeywords.length >= requiredCount;
    const score = foundKeywords.length / keywords.length;
    
    return {
      passed,
      score,
      message: `Found ${foundKeywords.length}/${keywords.length} required keywords`,
      details: { foundKeywords, requiredCount, keywords }
    };
  }

  /**
   * Simple sentiment validation
   */
  private validateSentiment(output: string, expectedSentiment: 'positive' | 'negative') {
    // Very simple sentiment analysis using keyword lists
    const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'positive', 'success'];
    const negativeWords = ['bad', 'terrible', 'awful', 'horrible', 'negative', 'fail', 'error', 'problem'];
    
    const text = output.toLowerCase();
    const positiveCount = positiveWords.filter(word => text.includes(word)).length;
    const negativeCount = negativeWords.filter(word => text.includes(word)).length;
    
    const isPositive = positiveCount > negativeCount;
    const passed = (expectedSentiment === 'positive' && isPositive) || 
                  (expectedSentiment === 'negative' && !isPositive);
    
    const confidence = Math.abs(positiveCount - negativeCount) / (positiveCount + negativeCount + 1);
    
    return {
      passed,
      score: passed ? confidence : 1 - confidence,
      message: `Detected ${isPositive ? 'positive' : 'negative'} sentiment (expected: ${expectedSentiment})`,
      details: { positiveCount, negativeCount, isPositive, expectedSentiment }
    };
  }

  /**
   * Code blocks validation
   */
  private validateCodeBlocks(output: string, params: Record<string, any>) {
    const codeBlockRegex = /```[\s\S]*?```/g;
    const matches = output.match(codeBlockRegex) || [];
    const requiredCount = params.requiredCount || 1;
    const language = params.language;
    
    let validBlocks = matches.length;
    
    if (language) {
      const languageRegex = new RegExp(`\`\`\`${language}[\\s\\S]*?\`\`\``, 'g');
      const languageMatches = output.match(languageRegex) || [];
      validBlocks = languageMatches.length;
    }
    
    const passed = validBlocks >= requiredCount;
    const score = Math.min(1.0, validBlocks / requiredCount);
    
    return {
      passed,
      score,
      message: `Found ${validBlocks} code blocks (required: ${requiredCount})`,
      details: { totalBlocks: matches.length, validBlocks, requiredCount, language }
    };
  }

  /**
   * URLs validation
   */
  private validateUrls(output: string, params: Record<string, any>) {
    const urlRegex = /https?:\/\/[^\s]+/g;
    const matches = output.match(urlRegex) || [];
    const requiredCount = params.requiredCount || 1;
    
    const passed = matches.length >= requiredCount;
    const score = Math.min(1.0, matches.length / requiredCount);
    
    return {
      passed,
      score,
      message: `Found ${matches.length} URLs (required: ${requiredCount})`,
      details: { urls: matches, requiredCount }
    };
  }

  /**
   * Simple schema validation (placeholder - use proper library in production)
   */
  private validateAgainstSchema(data: any, schema: any): boolean {
    // Very basic schema validation - in production use Ajv or similar
    if (schema.type) {
      const dataType = Array.isArray(data) ? 'array' : typeof data;
      if (dataType !== schema.type) {
        return false;
      }
    }
    
    if (schema.required && Array.isArray(schema.required)) {
      if (typeof data !== 'object' || data === null) {
        return false;
      }
      
      for (const field of schema.required) {
        if (!(field in data)) {
          return false;
        }
      }
    }
    
    return true; // Basic validation passed
  }

  /**
   * Simple similarity calculation using keyword overlap
   */
  private calculateSimpleSimilarity(text: string, topic: string): number {
    const textWords = text.toLowerCase().split(/\W+/).filter(w => w.length > 2);
    const topicWords = topic.toLowerCase().split(/\W+/).filter(w => w.length > 2);
    
    if (textWords.length === 0 || topicWords.length === 0) {
      return 0;
    }
    
    const commonWords = textWords.filter(word => topicWords.includes(word));
    const similarity = commonWords.length / Math.max(textWords.length, topicWords.length);
    
    return Math.min(1.0, similarity * 2); // Boost similarity scores
  }

  /**
   * Gets validation configuration from subtask
   */
  private getValidationConfig(subtask: Subtask): ValidationConfig {
    const config = subtask.metadata?.validation as ValidationConfig;
    
    if (!config) {
      // Return default configuration
      return {
        enabled: false,
        rules: [],
        confidence: {
          minThreshold: 0.7,
          haltThreshold: 0.3
        },
        maxRetries: 2,
        retryOnFailure: true
      };
    }
    
    return {
      enabled: config.enabled !== false,
      rules: config.rules || [],
      confidence: {
        minThreshold: config.confidence?.minThreshold || 0.7,
        haltThreshold: config.confidence?.haltThreshold || 0.3
      },
      maxRetries: config.maxRetries || 2,
      retryOnFailure: config.retryOnFailure !== false
    };
  }

  /**
   * Creates a default validation configuration for common subtask types
   */
  public static createDefaultValidation(subtaskType: string): ValidationConfig {
    const baseConfig = {
      enabled: true,
      confidence: {
        minThreshold: 0.7,
        haltThreshold: 0.3
      },
      maxRetries: 2,
      retryOnFailure: true,
      rules: [] as ValidationRule[]
    };

    switch (subtaskType) {
      case 'RESEARCH':
        baseConfig.rules.push({
          type: 'CUSTOM',
          name: 'wordCount',
          config: { customFunction: 'wordCount', parameters: { min: 100, max: 2000 } },
          weight: 0.3,
          required: false
        });
        break;
        
      case 'CREATION':
        baseConfig.rules.push({
          type: 'CUSTOM',
          name: 'minWordCount',
          config: { customFunction: 'wordCount', parameters: { min: 50 } },
          weight: 0.4,
          required: true
        });
        break;
        
      case 'VALIDATION':
        baseConfig.rules.push({
          type: 'CUSTOM',
          name: 'hasKeywords',
          config: { 
            customFunction: 'hasKeywords', 
            parameters: { keywords: ['valid', 'correct', 'verified', 'confirmed'], requiredCount: 1 }
          },
          weight: 0.5,
          required: false
        });
        break;
    }

    return baseConfig;
  }
}