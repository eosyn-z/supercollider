interface AtomType {
  type: 'RESEARCH' | 'ANALYSIS' | 'CREATION' | 'VALIDATION' | 'PLANNING' | 'OPTIMIZATION' | 'DOCUMENTATION' | 'INTEGRATION';
  confidence: number;
  estimatedComplexity: number;
}

interface PromptShred {
  id: string;
  atomType: string;
  content: string;
  estimatedTokens: number;
  dependencies: string[];
  batchable: boolean;
  agentCapabilities: string[];
}

interface BatchGroup {
  groupId: string;
  workflowType: string;
  tasks: PromptShred[];
  canExecuteInParallel: boolean;
  sharedContext: string;
  estimatedExecutionTime: number;
  requiredAgentCapabilities: string[];
}

interface ShredResult {
  strategy: 'atom_types' | 'token_chunks';
  shreds: PromptShred[];
  totalEstimatedCost: number;
  estimatedDuration: number;
  batchGroups: BatchGroup[];
}

const ATOM_TYPE_PATTERNS = {
  RESEARCH: [
    /search\s+for/i,
    /find\s+information/i,
    /look\s+up/i,
    /investigate/i,
    /research/i,
    /gather\s+data/i,
    /collect\s+information/i,
    /explore\s+options/i
  ],
  ANALYSIS: [
    /analyze/i,
    /examine/i,
    /evaluate/i,
    /assess/i,
    /review/i,
    /compare/i,
    /study/i,
    /interpret/i,
    /understand/i,
    /break\s+down/i
  ],
  CREATION: [
    /create/i,
    /build/i,
    /make/i,
    /generate/i,
    /develop/i,
    /write/i,
    /code/i,
    /implement/i,
    /construct/i,
    /design/i,
    /produce/i
  ],
  VALIDATION: [
    /test/i,
    /validate/i,
    /verify/i,
    /check/i,
    /confirm/i,
    /ensure/i,
    /debug/i,
    /troubleshoot/i,
    /fix/i,
    /correct/i
  ],
  PLANNING: [
    /plan/i,
    /strategy/i,
    /roadmap/i,
    /schedule/i,
    /organize/i,
    /structure/i,
    /outline/i,
    /prepare/i,
    /coordinate/i
  ],
  OPTIMIZATION: [
    /optimize/i,
    /improve/i,
    /enhance/i,
    /refactor/i,
    /streamline/i,
    /efficient/i,
    /performance/i,
    /speed\s+up/i,
    /reduce/i,
    /minimize/i
  ],
  DOCUMENTATION: [
    /document/i,
    /explain/i,
    /describe/i,
    /comment/i,
    /readme/i,
    /guide/i,
    /tutorial/i,
    /instructions/i,
    /manual/i
  ],
  INTEGRATION: [
    /integrate/i,
    /connect/i,
    /combine/i,
    /merge/i,
    /link/i,
    /sync/i,
    /join/i,
    /unify/i,
    /coordinate/i
  ]
};

class SmartShredder {
  private generateShredId(): string {
    return `shred_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  private estimateComplexity(atomType: string, content: string): number {
    const baseComplexity = {
      'RESEARCH': 3,
      'ANALYSIS': 4,
      'CREATION': 6,
      'VALIDATION': 4,
      'PLANNING': 5,
      'OPTIMIZATION': 7,
      'DOCUMENTATION': 3,
      'INTEGRATION': 8
    };

    const wordCount = content.split(/\s+/).length;
    const complexityMultiplier = Math.min(2, wordCount / 100);
    
    return (baseComplexity[atomType as keyof typeof baseComplexity] || 5) * complexityMultiplier;
  }

  async smartShred(userPrompt: string, targetTokenSize: number): Promise<ShredResult> {
    const atomTypes = this.detectAtomicTaskTypes(userPrompt);
    
    if (atomTypes.length > 1 && atomTypes.some(at => at.confidence > 0.7)) {
      return this.shredByAtomTypes(userPrompt, atomTypes, targetTokenSize);
    } else {
      return this.shredByTokenChunks(userPrompt, targetTokenSize);
    }
  }

  private detectAtomicTaskTypes(prompt: string): AtomType[] {
    const detectedTypes: AtomType[] = [];

    for (const [atomType, patterns] of Object.entries(ATOM_TYPE_PATTERNS)) {
      let matches = 0;
      let totalPatterns = patterns.length;

      for (const pattern of patterns) {
        if (pattern.test(prompt)) {
          matches++;
        }
      }

      if (matches > 0) {
        const confidence = matches / totalPatterns;
        const estimatedComplexity = this.estimateComplexity(atomType, prompt);
        
        detectedTypes.push({
          type: atomType as AtomType['type'],
          confidence,
          estimatedComplexity
        });
      }
    }

    return detectedTypes.sort((a, b) => b.confidence - a.confidence);
  }

  private async shredByAtomTypes(prompt: string, atomTypes: AtomType[], targetTokenSize: number): Promise<ShredResult> {
    const shreds: PromptShred[] = [];
    const sentences = prompt.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    for (const atomType of atomTypes) {
      const relevantSentences = sentences.filter(sentence => {
        const patterns = ATOM_TYPE_PATTERNS[atomType.type];
        return patterns.some(pattern => pattern.test(sentence));
      });

      if (relevantSentences.length > 0) {
        const content = relevantSentences.join('. ').trim();
        const estimatedTokens = this.estimateTokens(content);
        
        if (estimatedTokens <= targetTokenSize) {
          shreds.push({
            id: this.generateShredId(),
            atomType: atomType.type,
            content,
            estimatedTokens,
            dependencies: [],
            batchable: atomType.type !== 'VALIDATION' && atomType.type !== 'INTEGRATION',
            agentCapabilities: this.getRequiredCapabilities(atomType.type)
          });
        } else {
          const chunks = this.chunkContent(content, targetTokenSize);
          chunks.forEach((chunk, index) => {
            shreds.push({
              id: this.generateShredId(),
              atomType: atomType.type,
              content: chunk,
              estimatedTokens: this.estimateTokens(chunk),
              dependencies: index > 0 ? [shreds[shreds.length - 1].id] : [],
              batchable: index === 0 && atomType.type !== 'VALIDATION' && atomType.type !== 'INTEGRATION',
              agentCapabilities: this.getRequiredCapabilities(atomType.type)
            });
          });
        }
      }
    }

    const batchGroups = this.createBatchGroups(shreds);
    const totalEstimatedCost = this.calculateTotalCost(shreds);
    const estimatedDuration = this.calculateEstimatedDuration(batchGroups);

    return {
      strategy: 'atom_types',
      shreds,
      totalEstimatedCost,
      estimatedDuration,
      batchGroups
    };
  }

  private async shredByTokenChunks(prompt: string, targetTokenSize: number): Promise<ShredResult> {
    const shreds: PromptShred[] = [];
    const chunks = this.chunkContent(prompt, targetTokenSize);
    
    chunks.forEach((chunk, index) => {
      shreds.push({
        id: this.generateShredId(),
        atomType: 'GENERAL',
        content: chunk,
        estimatedTokens: this.estimateTokens(chunk),
        dependencies: index > 0 ? [shreds[shreds.length - 1].id] : [],
        batchable: index === 0,
        agentCapabilities: ['general-purpose']
      });
    });

    const batchGroups = this.createBatchGroups(shreds);
    const totalEstimatedCost = this.calculateTotalCost(shreds);
    const estimatedDuration = this.calculateEstimatedDuration(batchGroups);

    return {
      strategy: 'token_chunks',
      shreds,
      totalEstimatedCost,
      estimatedDuration,
      batchGroups
    };
  }

  private chunkContent(content: string, targetTokenSize: number): string[] {
    const chunks: string[] = [];
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    let currentChunk = '';
    
    for (const sentence of sentences) {
      const testChunk = currentChunk + (currentChunk ? '. ' : '') + sentence.trim();
      
      if (this.estimateTokens(testChunk) <= targetTokenSize) {
        currentChunk = testChunk;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk);
          currentChunk = sentence.trim();
        } else {
          chunks.push(sentence.trim());
        }
      }
    }
    
    if (currentChunk) {
      chunks.push(currentChunk);
    }
    
    return chunks;
  }

  private getRequiredCapabilities(atomType: string): string[] {
    const capabilities = {
      'RESEARCH': ['web-search', 'data-gathering', 'information-retrieval'],
      'ANALYSIS': ['data-analysis', 'pattern-recognition', 'critical-thinking'],
      'CREATION': ['content-generation', 'coding', 'design'],
      'VALIDATION': ['testing', 'quality-assurance', 'debugging'],
      'PLANNING': ['project-management', 'strategic-thinking', 'scheduling'],
      'OPTIMIZATION': ['performance-tuning', 'code-refactoring', 'efficiency-analysis'],
      'DOCUMENTATION': ['technical-writing', 'explanation', 'formatting'],
      'INTEGRATION': ['system-integration', 'api-connectivity', 'data-synchronization']
    };

    return capabilities[atomType] || ['general-purpose'];
  }

  private createBatchGroups(shreds: PromptShred[]): BatchGroup[] {
    const groups: BatchGroup[] = [];
    const atomTypeGroups = new Map<string, PromptShred[]>();

    shreds.forEach(shred => {
      if (shred.batchable && shred.dependencies.length === 0) {
        if (!atomTypeGroups.has(shred.atomType)) {
          atomTypeGroups.set(shred.atomType, []);
        }
        atomTypeGroups.get(shred.atomType)!.push(shred);
      }
    });

    atomTypeGroups.forEach((groupShreds, atomType) => {
      if (groupShreds.length > 1) {
        groups.push({
          groupId: `batch_${atomType}_${Date.now()}`,
          workflowType: atomType,
          tasks: groupShreds,
          canExecuteInParallel: true,
          sharedContext: this.generateSharedContext(groupShreds),
          estimatedExecutionTime: Math.max(...groupShreds.map(s => s.estimatedTokens * 0.1)),
          requiredAgentCapabilities: this.getRequiredCapabilities(atomType)
        });
      }
    });

    return groups;
  }

  private generateSharedContext(shreds: PromptShred[]): string {
    const commonWords = this.findCommonWords(shreds.map(s => s.content));
    return `Shared context: ${commonWords.slice(0, 10).join(', ')}`;
  }

  private findCommonWords(contents: string[]): string[] {
    const wordCounts = new Map<string, number>();
    
    contents.forEach(content => {
      const words = content.toLowerCase().split(/\W+/).filter(w => w.length > 3);
      words.forEach(word => {
        wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
      });
    });

    return Array.from(wordCounts.entries())
      .filter(([_, count]) => count > 1)
      .sort((a, b) => b[1] - a[1])
      .map(([word]) => word);
  }

  private calculateTotalCost(shreds: PromptShred[]): number {
    return shreds.reduce((total, shred) => total + (shred.estimatedTokens * 0.001), 0);
  }

  private calculateEstimatedDuration(batchGroups: BatchGroup[]): number {
    const parallelTime = Math.max(...batchGroups.map(g => g.estimatedExecutionTime), 0);
    const sequentialTime = batchGroups.reduce((total, g) => total + (g.estimatedExecutionTime * 0.1), 0);
    return parallelTime + sequentialTime;
  }
}

export { SmartShredder, AtomType, PromptShred, ShredResult, BatchGroup };