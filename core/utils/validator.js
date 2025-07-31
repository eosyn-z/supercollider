"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Validator = void 0;
class Validator {
    constructor() {
        this.embeddings = new Map();
    }
    validateOutput(subtask, output) {
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
        const ruleResults = [];
        const errors = [];
        const warnings = [];
        let totalWeightedScore = 0;
        let totalWeight = 0;
        let hasRequiredFailure = false;
        for (const rule of validationConfig.rules) {
            try {
                const result = this.executeRule(rule, subtask, output);
                ruleResults.push(result);
                if (rule.required && !result.passed) {
                    hasRequiredFailure = true;
                    errors.push(`Required validation rule '${rule.name}' failed: ${result.message}`);
                }
                totalWeightedScore += result.score * rule.weight;
                totalWeight += rule.weight;
                if (!result.passed && !rule.required) {
                    warnings.push(`Validation rule '${rule.name}' failed: ${result.message}`);
                }
            }
            catch (error) {
                const errorResult = {
                    ruleName: rule.name,
                    passed: false,
                    score: 0,
                    message: `Rule execution error: ${error.message}`
                };
                ruleResults.push(errorResult);
                errors.push(`Error executing rule '${rule.name}': ${error.message}`);
            }
        }
        const confidence = totalWeight > 0 ? totalWeightedScore / totalWeight : 0;
        const passed = !hasRequiredFailure &&
            confidence >= validationConfig.confidence.minThreshold;
        const shouldHalt = hasRequiredFailure ||
            confidence < validationConfig.confidence.haltThreshold;
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
    executeRule(rule, subtask, output) {
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
    executeSchemaRule(rule, subtask, output) {
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
            const parsedOutput = JSON.parse(output);
            const isValid = this.validateAgainstSchema(parsedOutput, config.schema);
            return {
                ruleName: rule.name,
                passed: isValid,
                score: isValid ? 1.0 : 0.0,
                message: isValid ? 'Schema validation passed' : 'Output does not match required schema',
                details: { schema: config.schema, parsedOutput }
            };
        }
        catch (error) {
            return {
                ruleName: rule.name,
                passed: false,
                score: 0,
                message: `Failed to parse output as JSON: ${error.message}`
            };
        }
    }
    executeRegexRule(rule, subtask, output) {
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
                    `Pattern matched: found ${matches.length} matches` :
                    'Pattern did not match',
                details: { pattern: config.pattern, matches }
            };
        }
        catch (error) {
            return {
                ruleName: rule.name,
                passed: false,
                score: 0,
                message: `Invalid regex pattern: ${error.message}`
            };
        }
    }
    executeSemanticRule(rule, subtask, output) {
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
            const similarities = config.expectedTopics.map(topic => this.calculateSimpleSimilarity(output, topic));
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
        }
        catch (error) {
            return {
                ruleName: rule.name,
                passed: false,
                score: 0,
                message: `Semantic validation error: ${error.message}`
            };
        }
    }
    executeCustomRule(rule, subtask, output) {
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
            const result = this.executeBuiltinCustomFunction(config.customFunction, output, config.parameters || {}, subtask);
            return {
                ruleName: rule.name,
                passed: result.passed,
                score: result.score,
                message: result.message,
                details: result.details
            };
        }
        catch (error) {
            return {
                ruleName: rule.name,
                passed: false,
                score: 0,
                message: `Custom validation error: ${error.message}`
            };
        }
    }
    executeBuiltinCustomFunction(functionName, output, parameters, subtask) {
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
    validateWordCount(output, params) {
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
    validateKeywords(output, params) {
        const keywords = params.keywords || [];
        const requiredCount = params.requiredCount || keywords.length;
        const caseSensitive = params.caseSensitive || false;
        const text = caseSensitive ? output : output.toLowerCase();
        const foundKeywords = keywords.filter((keyword) => {
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
    validateSentiment(output, expectedSentiment) {
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
    validateCodeBlocks(output, params) {
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
    validateUrls(output, params) {
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
    validateAgainstSchema(data, schema) {
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
        return true;
    }
    calculateSimpleSimilarity(text, topic) {
        const textWords = text.toLowerCase().split(/\W+/).filter(w => w.length > 2);
        const topicWords = topic.toLowerCase().split(/\W+/).filter(w => w.length > 2);
        if (textWords.length === 0 || topicWords.length === 0) {
            return 0;
        }
        const commonWords = textWords.filter(word => topicWords.includes(word));
        const similarity = commonWords.length / Math.max(textWords.length, topicWords.length);
        return Math.min(1.0, similarity * 2);
    }
    getValidationConfig(subtask) {
        const config = subtask.metadata?.validation;
        if (!config) {
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
    static createDefaultValidation(subtaskType) {
        const baseConfig = {
            enabled: true,
            confidence: {
                minThreshold: 0.7,
                haltThreshold: 0.3
            },
            maxRetries: 2,
            retryOnFailure: true,
            rules: []
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
exports.Validator = Validator;
//# sourceMappingURL=validator.js.map