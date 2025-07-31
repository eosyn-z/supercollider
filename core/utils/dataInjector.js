"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataInjector = void 0;
const subtaskSchema_1 = require("../types/subtaskSchema");
const TASK_PATTERNS = {
    'CREATION': {
        operations: ['understand_brief', 'brainstorm_concepts', 'select_approach', 'create_draft', 'refine_content', 'final_review'],
        avgDurationPerOp: 150000,
        dependencies: {
            'create_draft': ['understand_brief', 'select_approach'],
            'refine_content': ['create_draft'],
            'final_review': ['refine_content']
        }
    },
    'RESEARCH': {
        operations: ['define_scope', 'identify_sources', 'gather_data', 'analyze_findings', 'synthesize_results', 'format_output'],
        avgDurationPerOp: 180000,
        dependencies: {
            'gather_data': ['define_scope', 'identify_sources'],
            'analyze_findings': ['gather_data'],
            'synthesize_results': ['analyze_findings'],
            'format_output': ['synthesize_results']
        }
    },
    'ANALYSIS': {
        operations: ['examine_input', 'identify_patterns', 'compare_elements', 'draw_conclusions', 'validate_findings', 'present_results'],
        avgDurationPerOp: 120000,
        dependencies: {
            'identify_patterns': ['examine_input'],
            'compare_elements': ['identify_patterns'],
            'draw_conclusions': ['compare_elements'],
            'validate_findings': ['draw_conclusions'],
            'present_results': ['validate_findings']
        }
    },
    'VALIDATION': {
        operations: ['review_requirements', 'check_accuracy', 'test_functionality', 'verify_compliance', 'document_results', 'recommend_improvements'],
        avgDurationPerOp: 100000,
        dependencies: {
            'check_accuracy': ['review_requirements'],
            'test_functionality': ['check_accuracy'],
            'verify_compliance': ['test_functionality'],
            'document_results': ['verify_compliance'],
            'recommend_improvements': ['document_results']
        }
    }
};
const PROGRESS_TEMPLATE = `
PROGRESS TRACKING REQUIRED:
Mark completion of each step with: [CHECKPOINT:{todoId}:COMPLETED]
Report progress updates with: [PROGRESS:{todoId}:{percentage}]
Flag issues with: [ISSUE:{todoId}:{errorDescription}]
Request assistance with: [HELP:{todoId}:{question}]

TODO CHECKLIST:
{generatedTodoItems}

Complete each item sequentially. Report progress after each step.
`;
class DataInjector {
    constructor() {
        this.defaultConfig = {
            includeTone: true,
            includeFormat: true,
            includeOriginalPrompt: true,
            includeStyleGuide: true,
            maxContextLength: 4000
        };
    }
    injectContextToSubtaskPrompt(subtask, scaffold, originalUserPrompt, config) {
        const finalConfig = { ...this.defaultConfig, ...config };
        const contextualData = this.extractContextualData(originalUserPrompt, scaffold);
        const relevantContext = this.extractRelevantContext(originalUserPrompt, subtask.type);
        const injectedPrompt = this.buildContextualPrompt(subtask, relevantContext, contextualData, finalConfig);
        const finalPrompt = injectedPrompt.length > finalConfig.maxContextLength
            ? this.compressContext(injectedPrompt, finalConfig.maxContextLength)
            : injectedPrompt;
        const taskComplexity = this.analyzeTaskComplexity(finalPrompt, subtask.type);
        const todoList = this.generateTodoList(subtask, finalPrompt, taskComplexity);
        const progressInstructions = this.generateProgressInstructions(todoList.todos);
        const checkpointMarkers = this.createCheckpointMarkers(todoList.todos);
        const enhancedPrompt = this.embedProgressTracking(finalPrompt, progressInstructions, todoList.todos);
        return {
            agentId: subtask.assignedAgentId || 'unassigned',
            subtaskId: subtask.id,
            injectedPrompt: enhancedPrompt,
            contextMetadata: {
                originalLength: subtask.description.length,
                injectedLength: enhancedPrompt.length,
                compressionRatio: enhancedPrompt.length / subtask.description.length
            },
            todoList,
            progressTrackingInstructions: progressInstructions,
            checkpointMarkers
        };
    }
    extractContextualData(originalPrompt, scaffold) {
        const contextualData = {};
        contextualData.tone = this.extractTone(originalPrompt);
        contextualData.format = this.extractFormat(originalPrompt);
        contextualData.styleGuide = this.extractStyleGuide(originalPrompt);
        contextualData.domain = this.extractDomain(originalPrompt);
        contextualData.audience = this.extractAudience(originalPrompt);
        contextualData.constraints = this.extractConstraints(originalPrompt);
        contextualData.examples = this.extractExamples(originalPrompt);
        return contextualData;
    }
    extractRelevantContext(original, taskType) {
        const sentences = this.splitIntoSentences(original);
        const relevantSentences = [];
        const taskKeywords = {
            [subtaskSchema_1.SubtaskType.RESEARCH]: [
                'research', 'find', 'investigate', 'explore', 'discover', 'study', 'examine',
                'source', 'data', 'information', 'evidence', 'facts', 'statistics'
            ],
            [subtaskSchema_1.SubtaskType.ANALYSIS]: [
                'analyze', 'evaluate', 'compare', 'assess', 'review', 'critique', 'interpret',
                'examine', 'breakdown', 'dissect', 'understand', 'explain', 'reasoning'
            ],
            [subtaskSchema_1.SubtaskType.CREATION]: [
                'create', 'build', 'write', 'generate', 'develop', 'design', 'implement',
                'construct', 'produce', 'compose', 'craft', 'make', 'draft'
            ],
            [subtaskSchema_1.SubtaskType.VALIDATION]: [
                'test', 'validate', 'verify', 'check', 'confirm', 'ensure', 'review',
                'quality', 'accuracy', 'correctness', 'compliance', 'standards'
            ]
        };
        const keywords = taskKeywords[taskType] || [];
        const scoredSentences = sentences.map(sentence => ({
            sentence,
            score: this.calculateRelevanceScore(sentence, keywords)
        }));
        scoredSentences
            .sort((a, b) => b.score - a.score)
            .slice(0, Math.ceil(sentences.length * 0.6))
            .forEach(item => {
            if (item.score > 0) {
                relevantSentences.push(item.sentence);
            }
        });
        return relevantSentences.join(' ');
    }
    buildContextualPrompt(subtask, relevantContext, contextualData, config) {
        let prompt = '';
        if (config.customPrefix) {
            prompt += `${config.customPrefix}\n\n`;
        }
        if (config.includeOriginalPrompt && relevantContext) {
            prompt += `# Original Context\n${relevantContext}\n\n`;
        }
        if (config.includeTone && contextualData.tone) {
            prompt += `# Tone & Style\n${contextualData.tone}\n\n`;
        }
        if (config.includeFormat && contextualData.format) {
            prompt += `# Format Requirements\n${contextualData.format}\n\n`;
        }
        if (config.includeStyleGuide && contextualData.styleGuide) {
            prompt += `# Style Guidelines\n${contextualData.styleGuide}\n\n`;
        }
        if (contextualData.domain) {
            prompt += `# Domain Context\n${contextualData.domain}\n\n`;
        }
        if (contextualData.audience) {
            prompt += `# Target Audience\n${contextualData.audience}\n\n`;
        }
        if (contextualData.constraints && contextualData.constraints.length > 0) {
            prompt += `# Constraints\n${contextualData.constraints.map(c => `- ${c}`).join('\n')}\n\n`;
        }
        if (contextualData.examples && contextualData.examples.length > 0) {
            prompt += `# Examples\n${contextualData.examples.join('\n\n')}\n\n`;
        }
        prompt += `# Your Specific Task (${subtask.type})\n`;
        prompt += `**Title:** ${subtask.title}\n\n`;
        prompt += `**Description:** ${subtask.description}\n\n`;
        if (subtask.priority) {
            prompt += `**Priority:** ${subtask.priority}\n\n`;
        }
        if (subtask.dependencies.length > 0) {
            prompt += `**Dependencies:** This task depends on: ${subtask.dependencies.map(d => d.subtaskId).join(', ')}\n\n`;
        }
        prompt += this.getTaskSpecificInstructions(subtask.type);
        if (config.customSuffix) {
            prompt += `\n\n${config.customSuffix}`;
        }
        return prompt.trim();
    }
    getTaskSpecificInstructions(taskType) {
        const instructions = {
            [subtaskSchema_1.SubtaskType.RESEARCH]: `
# Research Instructions
- Provide comprehensive information with credible sources
- Include relevant data, statistics, and evidence
- Organize findings logically
- Cite sources when possible
- Flag any uncertainties or conflicting information`,
            [subtaskSchema_1.SubtaskType.ANALYSIS]: `
# Analysis Instructions
- Break down complex information into digestible parts
- Identify patterns, trends, and relationships
- Provide clear reasoning for conclusions
- Consider multiple perspectives
- Support findings with evidence from the context`,
            [subtaskSchema_1.SubtaskType.CREATION]: `
# Creation Instructions
- Follow the specified format and style requirements
- Ensure content aligns with the tone and audience
- Be creative while staying within constraints
- Provide well-structured, coherent output
- Include relevant details from the context`,
            [subtaskSchema_1.SubtaskType.VALIDATION]: `
# Validation Instructions  
- Check for accuracy and completeness
- Verify alignment with requirements and constraints
- Identify any inconsistencies or errors
- Provide specific feedback and recommendations
- Ensure quality standards are met`
        };
        return instructions[taskType] || '';
    }
    compressContext(context, maxLength) {
        if (context.length <= maxLength) {
            return context;
        }
        let compressed = context.replace(/# Examples\n[\s\S]*?\n\n/g, '');
        if (compressed.length <= maxLength) {
            return compressed;
        }
        compressed = this.compressVerboseSections(compressed);
        if (compressed.length <= maxLength) {
            return compressed;
        }
        return this.intelligentTruncate(compressed, maxLength);
    }
    compressVerboseSections(text) {
        text = text.replace(/\n{3,}/g, '\n\n');
        text = text.replace(/^(- .+\n){4,}/gm, (match) => {
            const items = match.trim().split('\n');
            const firstThree = items.slice(0, 3).join('\n');
            const remaining = items.length - 3;
            return `${firstThree}\n- (and ${remaining} more items)\n`;
        });
        return text;
    }
    intelligentTruncate(text, maxLength) {
        const sections = text.split(/\n# /);
        const importantSections = ['Your Specific Task', 'Original Context'];
        let result = sections[0];
        for (const section of sections.slice(1)) {
            const sectionTitle = section.split('\n')[0];
            if (importantSections.some(important => sectionTitle.includes(important))) {
                const candidate = result + '\n# ' + section;
                if (candidate.length <= maxLength * 0.8) {
                    result = candidate;
                }
            }
        }
        for (const section of sections.slice(1)) {
            const sectionTitle = section.split('\n')[0];
            if (!importantSections.some(important => sectionTitle.includes(important))) {
                const candidate = result + '\n# ' + section;
                if (candidate.length <= maxLength) {
                    result = candidate;
                }
                else {
                    break;
                }
            }
        }
        if (result.length > maxLength) {
            result = result.substring(0, maxLength - 3) + '...';
        }
        return result;
    }
    extractTone(text) {
        const tonePatterns = [
            /tone[:\s]+([\w\s,]+)/i,
            /(formal|informal|professional|casual|friendly|authoritative|conversational)/i,
            /style[:\s]+([\w\s,]+)/i
        ];
        for (const pattern of tonePatterns) {
            const match = text.match(pattern);
            if (match) {
                return match[1] || match[0];
            }
        }
        return undefined;
    }
    extractFormat(text) {
        const formatPatterns = [
            /format[:\s]+([\w\s,.-]+)/i,
            /(markdown|html|json|csv|pdf|docx|plain text|bullet points|numbered list)/i,
            /structure[:\s]+([\w\s,.-]+)/i
        ];
        for (const pattern of formatPatterns) {
            const match = text.match(pattern);
            if (match) {
                return match[1] || match[0];
            }
        }
        return undefined;
    }
    extractStyleGuide(text) {
        const stylePatterns = [
            /style guide[:\s]+([\w\s,.-]+)/i,
            /guidelines?[:\s]+([\w\s,.-]+)/i,
            /standards?[:\s]+([\w\s,.-]+)/i
        ];
        for (const pattern of stylePatterns) {
            const match = text.match(pattern);
            if (match) {
                return match[1] || match[0];
            }
        }
        return undefined;
    }
    extractDomain(text) {
        const domainPatterns = [
            /domain[:\s]+([\w\s,.-]+)/i,
            /subject[:\s]+([\w\s,.-]+)/i,
            /field[:\s]+([\w\s,.-]+)/i,
            /(technology|healthcare|finance|education|marketing|legal|scientific)/i
        ];
        for (const pattern of domainPatterns) {
            const match = text.match(pattern);
            if (match) {
                return match[1] || match[0];
            }
        }
        return undefined;
    }
    extractAudience(text) {
        const audiencePatterns = [
            /audience[:\s]+([\w\s,.-]+)/i,
            /target[:\s]+([\w\s,.-]+)/i,
            /for\s+([\w\s,.-]*(?:users?|customers?|clients?|students?|professionals?)[\w\s,.-]*)/i
        ];
        for (const pattern of audiencePatterns) {
            const match = text.match(pattern);
            if (match) {
                return match[1] || match[0];
            }
        }
        return undefined;
    }
    extractConstraints(text) {
        const constraints = [];
        const constraintPatterns = [
            /constraint[s]?[:\s]+(.*?)(?:\n|$)/gi,
            /limitation[s]?[:\s]+(.*?)(?:\n|$)/gi,
            /requirement[s]?[:\s]+(.*?)(?:\n|$)/gi,
            /must not[:\s]+(.*?)(?:\n|$)/gi,
            /avoid[:\s]+(.*?)(?:\n|$)/gi
        ];
        constraintPatterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(text)) !== null) {
                constraints.push(match[1].trim());
            }
        });
        return constraints;
    }
    extractExamples(text) {
        const examples = [];
        const examplePatterns = [
            /example[s]?[:\s]+([\s\S]*?)(?=\n\n|\n[A-Z]|$)/gi,
            /for instance[:\s]+(.*?)(?:\n|$)/gi,
            /such as[:\s]+(.*?)(?:\n|$)/gi
        ];
        examplePatterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(text)) !== null) {
                const example = match[1].trim();
                if (example.length > 10) {
                    examples.push(example);
                }
            }
        });
        return examples;
    }
    splitIntoSentences(text) {
        return text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    }
    calculateRelevanceScore(sentence, keywords) {
        const lowerSentence = sentence.toLowerCase();
        let score = 0;
        keywords.forEach(keyword => {
            const regex = new RegExp(`\\b${keyword}\\b`, 'g');
            const matches = lowerSentence.match(regex);
            if (matches) {
                score += matches.length;
            }
        });
        return score;
    }
    generateTodoList(subtask, injectedPrompt, taskComplexity) {
        const atomicOperations = this.extractAtomicOperations(injectedPrompt, subtask.type);
        const todosWithDependencies = this.identifyDependencies(atomicOperations);
        const now = Date.now();
        const todoList = {
            subtaskId: subtask.id,
            agentId: subtask.assignedAgentId || 'unassigned',
            totalItems: todosWithDependencies.length,
            completedItems: 0,
            estimatedTotalDuration: todosWithDependencies.reduce((sum, todo) => sum + todo.estimatedDurationMs, 0),
            todos: todosWithDependencies,
            createdAt: now,
            lastUpdated: now
        };
        return todoList;
    }
    analyzeTaskComplexity(prompt, taskType) {
        const wordCount = prompt.split(/\s+/).length;
        const technicalKeywords = ['implement', 'analyze', 'integrate', 'optimize', 'validate', 'test'];
        const complexityIndicators = technicalKeywords.filter(keyword => prompt.toLowerCase().includes(keyword)).length;
        let level = 'simple';
        let estimatedDuration = 300000;
        if (wordCount > 500 || complexityIndicators > 3) {
            level = 'expert';
            estimatedDuration = 1200000;
        }
        else if (wordCount > 300 || complexityIndicators > 2) {
            level = 'complex';
            estimatedDuration = 900000;
        }
        else if (wordCount > 150 || complexityIndicators > 1) {
            level = 'moderate';
            estimatedDuration = 600000;
        }
        const riskFactors = [];
        if (prompt.toLowerCase().includes('external'))
            riskFactors.push('external_dependencies');
        if (prompt.toLowerCase().includes('integrate'))
            riskFactors.push('integration_complexity');
        if (prompt.toLowerCase().includes('performance'))
            riskFactors.push('performance_requirements');
        return {
            level,
            operationCount: Math.ceil(wordCount / 50),
            estimatedDuration,
            requiresExternalData: prompt.toLowerCase().includes('external') || prompt.toLowerCase().includes('api'),
            hasIterativeSteps: prompt.toLowerCase().includes('refine') || prompt.toLowerCase().includes('iterate'),
            riskFactors
        };
    }
    extractAtomicOperations(prompt, taskType) {
        const pattern = TASK_PATTERNS[taskType] || TASK_PATTERNS['CREATION'];
        const baseOperations = pattern.operations;
        const todos = [];
        const customOperations = this.parseCustomOperations(prompt);
        const operations = customOperations.length > 0 ? customOperations : baseOperations;
        operations.forEach((operation, index) => {
            const todo = {
                id: `todo-${Date.now()}-${index}`,
                title: this.humanizeOperationName(operation),
                description: this.generateOperationDescription(operation, prompt),
                estimatedDurationMs: this.estimateOperationDuration(operation, taskType),
                status: 'pending',
                dependencies: [],
                progressPercentage: 0
            };
            todos.push(todo);
        });
        return todos;
    }
    parseCustomOperations(prompt) {
        const operations = [];
        const listPatterns = [
            /\d+\.\s*([^\n]+)/g,
            /[-*]\s*([^\n]+)/g,
            /step\s*\d*[:\s]*([^\n]+)/gi
        ];
        listPatterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(prompt)) !== null) {
                const operation = match[1].trim();
                if (operation.length > 5 && operation.length < 100) {
                    operations.push(operation.toLowerCase().replace(/\s+/g, '_'));
                }
            }
        });
        return operations;
    }
    estimateOperationDuration(operation, taskType) {
        const pattern = TASK_PATTERNS[taskType] || TASK_PATTERNS['CREATION'];
        let baseDuration = pattern.avgDurationPerOp;
        if (operation.includes('implement') || operation.includes('create')) {
            baseDuration *= 1.5;
        }
        else if (operation.includes('review') || operation.includes('check')) {
            baseDuration *= 0.7;
        }
        else if (operation.includes('research') || operation.includes('analyze')) {
            baseDuration *= 1.2;
        }
        return Math.round(baseDuration);
    }
    identifyDependencies(todos) {
        const todoMap = new Map(todos.map(todo => [todo.title.toLowerCase().replace(/\s+/g, '_'), todo]));
        todos.forEach(todo => {
            const operationName = todo.title.toLowerCase().replace(/\s+/g, '_');
            Object.values(TASK_PATTERNS).forEach(pattern => {
                if (pattern.dependencies[operationName]) {
                    pattern.dependencies[operationName].forEach(depName => {
                        const depTodo = todoMap.get(depName);
                        if (depTodo && depTodo.id !== todo.id) {
                            todo.dependencies.push(depTodo.id);
                        }
                    });
                }
            });
            if (todo.dependencies.length === 0) {
                const currentIndex = todos.indexOf(todo);
                if (currentIndex > 0) {
                    todo.dependencies.push(todos[currentIndex - 1].id);
                }
            }
        });
        return todos;
    }
    generateProgressInstructions(todos) {
        const todoItems = todos.map(todo => `- [${todo.id}] ${todo.title}: ${todo.description} (Est: ${Math.round(todo.estimatedDurationMs / 60000)}min)`).join('\n');
        return PROGRESS_TEMPLATE.replace('{generatedTodoItems}', todoItems);
    }
    createCheckpointMarkers(todos) {
        const markers = [];
        todos.forEach(todo => {
            markers.push(`[CHECKPOINT:${todo.id}:COMPLETED]`);
            markers.push(`[PROGRESS:${todo.id}:`);
            markers.push(`[ISSUE:${todo.id}:`);
            markers.push(`[HELP:${todo.id}:`);
        });
        return markers;
    }
    embedProgressTracking(prompt, instructions, todos) {
        const todoSummary = `\n\n=== PROGRESS TRACKING ENABLED ===\n${instructions}\n=== END TRACKING SECTION ===\n\n`;
        return prompt + todoSummary;
    }
    humanizeOperationName(operation) {
        return operation
            .replace(/_/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase());
    }
    generateOperationDescription(operation, context) {
        const descriptions = {
            'understand_brief': 'Carefully read and comprehend the task requirements',
            'brainstorm_concepts': 'Generate multiple creative approaches and ideas',
            'select_approach': 'Choose the most suitable approach based on requirements',
            'create_draft': 'Develop the initial version of the deliverable',
            'refine_content': 'Improve and polish the content for quality',
            'final_review': 'Conduct final quality check and validation',
            'define_scope': 'Establish clear boundaries and objectives for research',
            'identify_sources': 'Find reliable and relevant information sources',
            'gather_data': 'Collect comprehensive information from identified sources',
            'analyze_findings': 'Process and interpret the collected data',
            'synthesize_results': 'Combine findings into coherent insights',
            'format_output': 'Present results in the required format'
        };
        return descriptions[operation] || `Complete the ${operation.replace(/_/g, ' ')} step`;
    }
    static createPreset(presetName) {
        const presets = {
            minimal: {
                includeTone: false,
                includeFormat: false,
                includeOriginalPrompt: true,
                includeStyleGuide: false,
                maxContextLength: 2000
            },
            standard: {
                includeTone: true,
                includeFormat: true,
                includeOriginalPrompt: true,
                includeStyleGuide: true,
                maxContextLength: 4000
            },
            comprehensive: {
                includeTone: true,
                includeFormat: true,
                includeOriginalPrompt: true,
                includeStyleGuide: true,
                maxContextLength: 8000
            }
        };
        return presets[presetName] || presets.standard;
    }
}
exports.DataInjector = DataInjector;
//# sourceMappingURL=dataInjector.js.map