"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskSlicer = void 0;
const subtaskSchema_1 = require("../types/subtaskSchema");
class TaskSlicer {
    sliceAdvanced(prompt, config) {
        const analysis = this.analyze(prompt);
        if (analysis.requiresLargePromptSlicing) {
            return this.sliceLargePrompt(prompt, config, analysis);
        }
        else {
            const subtasks = this.slice(prompt, config);
            return {
                subtasks,
                oversizedSegments: [],
                contextualLinks: new Map(),
                slicingStatistics: {
                    originalTokenCount: analysis.tokenCount,
                    averageTokensPerSubtask: analysis.tokenCount / subtasks.length,
                    maxTokensInSubtask: Math.max(...subtasks.map(s => this.estimateTokenCount(s.description))),
                    compressionRatio: 1.0,
                    contextPreservationScore: 0.9
                }
            };
        }
    }
    sliceLargePrompt(prompt, config, analysis) {
        const chunks = this.performSemanticChunking(prompt, config);
        const subtasks = [];
        const oversizedSegments = [];
        const contextualLinks = new Map();
        const workflowId = this.generateId();
        let totalTokensInSubtasks = 0;
        let maxTokensInSubtask = 0;
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            if (chunk.tokenCount > config.maxTokensPerSubtask) {
                const subChunks = this.splitOversizedChunk(chunk, config.maxTokensPerSubtask);
                for (const subChunk of subChunks) {
                    if (subChunk.tokenCount <= config.maxTokensPerSubtask) {
                        const subtask = this.createSubtaskFromChunk(subChunk, i, workflowId, config);
                        subtasks.push(subtask);
                        totalTokensInSubtasks += subChunk.tokenCount;
                        maxTokensInSubtask = Math.max(maxTokensInSubtask, subChunk.tokenCount);
                    }
                    else {
                        oversizedSegments.push(subChunk.content);
                    }
                }
            }
            else {
                const subtask = this.createSubtaskFromChunk(chunk, i, workflowId, config);
                subtasks.push(subtask);
                totalTokensInSubtasks += chunk.tokenCount;
                maxTokensInSubtask = Math.max(maxTokensInSubtask, chunk.tokenCount);
            }
            if (config.preserveContext) {
                const links = this.identifyContextualLinks(chunk, chunks);
                if (links.length > 0) {
                    contextualLinks.set(chunk.content, links);
                }
            }
        }
        this.addContextualDependencies(subtasks, contextualLinks);
        const slicingStatistics = {
            originalTokenCount: analysis.tokenCount,
            averageTokensPerSubtask: subtasks.length > 0 ? totalTokensInSubtasks / subtasks.length : 0,
            maxTokensInSubtask,
            compressionRatio: totalTokensInSubtasks / analysis.tokenCount,
            contextPreservationScore: this.calculateContextPreservationScore(contextualLinks, subtasks.length)
        };
        return {
            subtasks,
            oversizedSegments,
            contextualLinks,
            slicingStatistics
        };
    }
    slice(prompt, config) {
        const analysis = this.analyze(prompt);
        const subtasks = [];
        const targetCount = config.granularity === 'fine'
            ? Math.min(analysis.suggestedSliceCount * 2, config.maxSubtasks)
            : Math.min(analysis.suggestedSliceCount, config.maxSubtasks);
        const workflowId = this.generateId();
        for (let i = 0; i < targetCount; i++) {
            const subtaskType = this.determineSubtaskType(i, targetCount, analysis);
            const dependencies = this.determineDependencies(i, subtasks);
            const subtask = {
                id: this.generateId(),
                title: this.generateSubtaskTitle(subtaskType, i + 1),
                description: this.generateSubtaskDescription(prompt, subtaskType, i + 1, targetCount),
                type: subtaskType,
                priority: this.determinePriority(i, targetCount),
                status: subtaskSchema_1.SubtaskStatus.PENDING,
                dependencies,
                createdAt: new Date(),
                updatedAt: new Date(),
                parentWorkflowId: workflowId,
                estimatedDuration: this.estimateSubtaskDuration(subtaskType, config.granularity)
            };
            subtasks.push(subtask);
        }
        return subtasks;
    }
    analyze(prompt) {
        const sentences = this.splitIntoSentences(prompt);
        const paragraphs = prompt.split(/\n\s*\n/).filter(p => p.trim().length > 0);
        const wordCount = prompt.split(/\s+/).length;
        const tokenCount = this.estimateTokenCount(prompt);
        const complexity = this.calculateComplexity(prompt, wordCount);
        const estimatedTypeBreakdown = {
            [subtaskSchema_1.SubtaskType.RESEARCH]: this.countKeywords(prompt, [
                'research', 'find', 'investigate', 'explore', 'discover', 'study', 'examine'
            ]) > 0 ? 1 : 0,
            [subtaskSchema_1.SubtaskType.ANALYSIS]: this.countKeywords(prompt, [
                'analyze', 'evaluate', 'compare', 'assess', 'review', 'critique', 'interpret'
            ]) > 0 ? 1 : 0,
            [subtaskSchema_1.SubtaskType.CREATION]: this.countKeywords(prompt, [
                'create', 'build', 'write', 'generate', 'develop', 'design', 'implement', 'construct'
            ]) > 0 ? 1 : 0,
            [subtaskSchema_1.SubtaskType.VALIDATION]: this.countKeywords(prompt, [
                'test', 'validate', 'verify', 'check', 'confirm', 'ensure', 'review'
            ]) > 0 ? 1 : 0
        };
        const hasStructuredContent = this.detectStructuredContent(prompt);
        const keyTopics = this.extractKeyTopics(prompt);
        const requiresLargePromptSlicing = tokenCount > 4000 ||
            sentences.length > 50 ||
            paragraphs.length > 10 ||
            complexity > 0.8;
        const suggestedSliceCount = this.calculateOptimalSliceCount(tokenCount, sentences.length, complexity);
        return {
            complexity,
            estimatedTypeBreakdown,
            suggestedSliceCount,
            tokenCount,
            sentenceCount: sentences.length,
            paragraphCount: paragraphs.length,
            hasStructuredContent,
            keyTopics,
            requiresLargePromptSlicing
        };
    }
    merge(subtasks) {
        const completedSubtasks = subtasks
            .filter(subtask => subtask.status === subtaskSchema_1.SubtaskStatus.COMPLETED && subtask.result)
            .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        if (completedSubtasks.length === 0) {
            return 'No completed subtasks to merge.';
        }
        let mergedResult = '# Compiled Results\n\n';
        completedSubtasks.forEach((subtask, index) => {
            mergedResult += `## ${subtask.title}\n`;
            mergedResult += `${subtask.result.content}\n\n`;
            if (subtask.result.errors && subtask.result.errors.length > 0) {
                mergedResult += `**Errors encountered:**\n`;
                subtask.result.errors.forEach(error => {
                    mergedResult += `- ${error}\n`;
                });
                mergedResult += '\n';
            }
        });
        return mergedResult.trim();
    }
    generateId() {
        return Math.random().toString(36).substring(2, 15);
    }
    performSemanticChunking(prompt, config) {
        const sentences = this.splitIntoSentences(prompt);
        const chunks = [];
        if (config.slicingStrategy === 'semantic') {
            return this.semanticChunking(sentences, config.maxTokensPerSubtask);
        }
        else if (config.slicingStrategy === 'structural') {
            return this.structuralChunking(prompt, config.maxTokensPerSubtask);
        }
        else {
            return this.balancedChunking(sentences, config.maxTokensPerSubtask);
        }
    }
    semanticChunking(sentences, maxTokens) {
        const chunks = [];
        let currentChunk = [];
        let currentTokens = 0;
        let currentTopics = new Set();
        for (let i = 0; i < sentences.length; i++) {
            const sentence = sentences[i];
            const sentenceTokens = this.estimateTokenCount(sentence);
            const sentenceTopics = this.extractTopicsFromSentence(sentence);
            if (currentTokens + sentenceTokens > maxTokens && currentChunk.length > 0) {
                chunks.push({
                    content: currentChunk.join(' '),
                    tokenCount: currentTokens,
                    topics: Array.from(currentTopics),
                    sentenceStart: i - currentChunk.length,
                    sentenceEnd: i - 1,
                    importance: this.calculateChunkImportance(currentChunk)
                });
                currentChunk = [];
                currentTokens = 0;
                currentTopics.clear();
            }
            currentChunk.push(sentence);
            currentTokens += sentenceTokens;
            sentenceTopics.forEach(topic => currentTopics.add(topic));
        }
        if (currentChunk.length > 0) {
            chunks.push({
                content: currentChunk.join(' '),
                tokenCount: currentTokens,
                topics: Array.from(currentTopics),
                sentenceStart: sentences.length - currentChunk.length,
                sentenceEnd: sentences.length - 1,
                importance: this.calculateChunkImportance(currentChunk)
            });
        }
        return chunks;
    }
    structuralChunking(prompt, maxTokens) {
        const sections = this.identifyStructuralSections(prompt);
        const chunks = [];
        for (const section of sections) {
            const sectionTokens = this.estimateTokenCount(section);
            if (sectionTokens <= maxTokens) {
                chunks.push({
                    content: section,
                    tokenCount: sectionTokens,
                    topics: this.extractTopicsFromSentence(section),
                    sentenceStart: 0,
                    sentenceEnd: this.splitIntoSentences(section).length - 1,
                    importance: this.calculateChunkImportance([section])
                });
            }
            else {
                const sentences = this.splitIntoSentences(section);
                const subChunks = this.semanticChunking(sentences, maxTokens);
                chunks.push(...subChunks);
            }
        }
        return chunks;
    }
    balancedChunking(sentences, maxTokens) {
        const targetTokens = Math.floor(maxTokens * 0.8);
        return this.semanticChunking(sentences, targetTokens);
    }
    calculateComplexity(prompt, wordCount) {
        let complexity = 0.2;
        if (wordCount > 100)
            complexity += 0.1;
        if (wordCount > 300)
            complexity += 0.15;
        if (wordCount > 800)
            complexity += 0.2;
        if (wordCount > 1500)
            complexity += 0.25;
        const technicalKeywords = [
            'implement', 'algorithm', 'system', 'architecture', 'integration',
            'framework', 'protocol', 'optimization', 'scalability', 'performance'
        ];
        complexity += Math.min(0.3, this.countKeywords(prompt, technicalKeywords) * 0.05);
        const processKeywords = [
            'first', 'then', 'finally', 'after', 'next', 'step', 'phase',
            'subsequently', 'following', 'preceding'
        ];
        complexity += Math.min(0.2, this.countKeywords(prompt, processKeywords) * 0.03);
        const lists = (prompt.match(/\n\s*[-*]\s/g) || []).length;
        const numberedLists = (prompt.match(/\n\s*\d+\./g) || []).length;
        complexity += Math.min(0.15, (lists + numberedLists) * 0.02);
        return Math.min(1.0, complexity);
    }
    countKeywords(text, keywords) {
        const lowerText = text.toLowerCase();
        return keywords.reduce((count, keyword) => {
            const regex = new RegExp(`\\b${keyword}\\b`, 'g');
            const matches = lowerText.match(regex);
            return count + (matches ? matches.length : 0);
        }, 0);
    }
    determineSubtaskType(index, totalCount, analysis) {
        if (index === 0 && analysis.estimatedTypeBreakdown[subtaskSchema_1.SubtaskType.RESEARCH] > 0) {
            return subtaskSchema_1.SubtaskType.RESEARCH;
        }
        if (index === totalCount - 1 && analysis.estimatedTypeBreakdown[subtaskSchema_1.SubtaskType.VALIDATION] > 0) {
            return subtaskSchema_1.SubtaskType.VALIDATION;
        }
        if (analysis.estimatedTypeBreakdown[subtaskSchema_1.SubtaskType.CREATION] > 0) {
            return subtaskSchema_1.SubtaskType.CREATION;
        }
        return subtaskSchema_1.SubtaskType.ANALYSIS;
    }
    determineDependencies(index, existingSubtasks) {
        const dependencies = [];
        if (index > 0 && existingSubtasks.length > 0) {
            const previousSubtask = existingSubtasks[existingSubtasks.length - 1];
            dependencies.push({
                subtaskId: previousSubtask.id,
                type: 'BLOCKING',
                description: 'Sequential dependency on previous subtask'
            });
        }
        return dependencies;
    }
    generateSubtaskTitle(type, index) {
        const titles = {
            [subtaskSchema_1.SubtaskType.RESEARCH]: `Research Phase ${index}`,
            [subtaskSchema_1.SubtaskType.ANALYSIS]: `Analysis Phase ${index}`,
            [subtaskSchema_1.SubtaskType.CREATION]: `Creation Phase ${index}`,
            [subtaskSchema_1.SubtaskType.VALIDATION]: `Validation Phase ${index}`
        };
        return titles[type];
    }
    generateSubtaskDescription(prompt, type, index, totalCount) {
        const promptSnippet = prompt.length > 100 ? prompt.substring(0, 97) + '...' : prompt;
        const descriptions = {
            [subtaskSchema_1.SubtaskType.RESEARCH]: `Conduct research and gather information relevant to: "${promptSnippet}"`,
            [subtaskSchema_1.SubtaskType.ANALYSIS]: `Analyze the requirements and plan the approach for: "${promptSnippet}"`,
            [subtaskSchema_1.SubtaskType.CREATION]: `Execute and create the deliverable for: "${promptSnippet}"`,
            [subtaskSchema_1.SubtaskType.VALIDATION]: `Validate and review the results for: "${promptSnippet}"`
        };
        return descriptions[type];
    }
    determinePriority(index, totalCount) {
        if (index === 0 || index === totalCount - 1) {
            return subtaskSchema_1.Priority.HIGH;
        }
        return subtaskSchema_1.Priority.MEDIUM;
    }
    estimateTokenCount(text) {
        return Math.ceil(text.length / 4);
    }
    splitIntoSentences(text) {
        return text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    }
    detectStructuredContent(prompt) {
        const structureIndicators = [
            /\n\s*[-*]\s/,
            /\n\s*\d+\./,
            /\n\s*#{1,6}\s/,
            /\n\s*\w+:\s*$/,
            /\|.*\|/
        ];
        return structureIndicators.some(pattern => pattern.test(prompt));
    }
    extractKeyTopics(prompt) {
        const words = prompt.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
        const wordFreq = new Map();
        words.forEach(word => {
            if (!this.isStopWord(word)) {
                wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
            }
        });
        return Array.from(wordFreq.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([word]) => word);
    }
    isStopWord(word) {
        const stopWords = new Set([
            'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'any', 'can', 'had',
            'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how',
            'its', 'may', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did',
            'she', 'use', 'her', 'now', 'oil', 'sit', 'word', 'says', 'each', 'which',
            'their', 'time', 'will', 'about', 'after', 'would', 'there', 'could', 'other'
        ]);
        return stopWords.has(word);
    }
    calculateOptimalSliceCount(tokenCount, sentenceCount, complexity) {
        let baseCount = Math.ceil(tokenCount / 1000);
        if (sentenceCount > 20)
            baseCount += Math.ceil(sentenceCount / 20);
        baseCount = Math.ceil(baseCount * (1 + complexity));
        return Math.max(2, Math.min(20, baseCount));
    }
    extractTopicsFromSentence(sentence) {
        return this.extractKeyTopics(sentence).slice(0, 3);
    }
    calculateChunkImportance(sentences) {
        const text = sentences.join(' ');
        let importance = 0.5;
        const actionWords = ['create', 'implement', 'build', 'design', 'develop'];
        importance += this.countKeywords(text, actionWords) * 0.1;
        const techWords = ['system', 'algorithm', 'framework', 'architecture'];
        importance += this.countKeywords(text, techWords) * 0.05;
        return Math.min(1.0, importance);
    }
    identifyStructuralSections(prompt) {
        const sections = prompt.split(/\n\s*#{1,6}\s.*\n|\n\s*\n/)
            .filter(section => section.trim().length > 0);
        return sections.length > 1 ? sections : [prompt];
    }
    splitOversizedChunk(chunk, maxTokens) {
        const sentences = this.splitIntoSentences(chunk.content);
        return this.semanticChunking(sentences, maxTokens);
    }
    createSubtaskFromChunk(chunk, index, workflowId, config) {
        const subtaskType = this.determineSubtaskTypeFromChunk(chunk);
        return {
            id: this.generateId(),
            title: `${subtaskType} - Segment ${index + 1}`,
            description: chunk.content,
            type: subtaskType,
            priority: chunk.importance > 0.7 ? subtaskSchema_1.Priority.HIGH : subtaskSchema_1.Priority.MEDIUM,
            status: subtaskSchema_1.SubtaskStatus.PENDING,
            dependencies: [],
            createdAt: new Date(),
            updatedAt: new Date(),
            parentWorkflowId: workflowId,
            estimatedDuration: this.estimateSubtaskDuration(subtaskType, config.granularity),
            metadata: {
                tokenCount: chunk.tokenCount,
                topics: chunk.topics,
                importance: chunk.importance
            }
        };
    }
    determineSubtaskTypeFromChunk(chunk) {
        const content = chunk.content.toLowerCase();
        if (this.countKeywords(content, ['research', 'find', 'investigate']) > 0) {
            return subtaskSchema_1.SubtaskType.RESEARCH;
        }
        if (this.countKeywords(content, ['create', 'build', 'implement']) > 0) {
            return subtaskSchema_1.SubtaskType.CREATION;
        }
        if (this.countKeywords(content, ['test', 'validate', 'verify']) > 0) {
            return subtaskSchema_1.SubtaskType.VALIDATION;
        }
        return subtaskSchema_1.SubtaskType.ANALYSIS;
    }
    identifyContextualLinks(chunk, allChunks) {
        const links = [];
        const chunkTopics = new Set(chunk.topics);
        for (const otherChunk of allChunks) {
            if (otherChunk === chunk)
                continue;
            const commonTopics = otherChunk.topics.filter(topic => chunkTopics.has(topic));
            if (commonTopics.length > 0) {
                links.push(otherChunk.content);
            }
        }
        return links;
    }
    addContextualDependencies(subtasks, contextualLinks) {
        const contentToSubtask = new Map();
        subtasks.forEach(subtask => {
            contentToSubtask.set(subtask.description, subtask);
        });
        for (const [content, links] of contextualLinks.entries()) {
            const subtask = contentToSubtask.get(content);
            if (subtask) {
                for (const link of links) {
                    const linkedSubtask = contentToSubtask.get(link);
                    if (linkedSubtask && linkedSubtask.id !== subtask.id) {
                        subtask.dependencies.push({
                            subtaskId: linkedSubtask.id,
                            type: 'SOFT',
                            description: 'Contextual relationship detected',
                            priority: subtaskSchema_1.Priority.LOW
                        });
                    }
                }
            }
        }
    }
    calculateContextPreservationScore(contextualLinks, subtaskCount) {
        const totalLinks = Array.from(contextualLinks.values())
            .reduce((sum, links) => sum + links.length, 0);
        return Math.min(1.0, totalLinks / (subtaskCount * 2));
    }
    estimateSubtaskDuration(type, granularity) {
        const baseDurations = {
            [subtaskSchema_1.SubtaskType.RESEARCH]: 15,
            [subtaskSchema_1.SubtaskType.ANALYSIS]: 10,
            [subtaskSchema_1.SubtaskType.CREATION]: 20,
            [subtaskSchema_1.SubtaskType.VALIDATION]: 10
        };
        const multiplier = granularity === 'fine' ? 0.7 : 1.3;
        return Math.round(baseDurations[type] * multiplier);
    }
}
exports.TaskSlicer = TaskSlicer;
//# sourceMappingURL=taskSlicer.js.map