/**
 * Universal Media Processing System - Media Classifier
 * Handles classification and processing pipeline generation for any input type
 */

import { readFileSync } from 'fs';
import { extname, basename } from 'path';
import * as mime from 'mime-types';

export type MediaType = 'text' | 'image' | 'video' | 'audio' | 'document' | 'code' | 'data' | 'url' | 'mixed';
export type ProcessingCapability = 'analyze' | 'generate' | 'transform' | 'extract' | 'synthesize' | 'caption' | 'transcribe';

export interface MediaInput {
  id: string;
  type: MediaType;
  source: string | Buffer | File;
  metadata: {
    format: string;
    size: number;
    duration?: number;
    dimensions?: { width: number; height: number };
    encoding?: string;
    language?: string;
    originalName?: string;
  };
  capabilities: ProcessingCapability[];
}

export interface ProcessingPipeline {
  id: string;
  inputTypes: MediaType[];
  outputTypes: MediaType[];
  steps: ProcessingStep[];
  parallelizable: boolean;
  estimatedDuration: number;
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
  estimatedDuration: number;
  requiredCapabilities: ProcessingCapability[];
  fallbackOptions: string[];
}

export interface MediaAnalysis {
  confidence: number;
  detectedFeatures: string[];
  processingRecommendations: ProcessingCapability[];
  estimatedComplexity: 'low' | 'medium' | 'high';
  requiresSpecialHandling: boolean;
}

export interface BatchProcessingGroup {
  id: string;
  mediaInputs: MediaInput[];
  sharedProcessingSteps: ProcessingStep[];
  estimatedSavings: number;
  batchSize: number;
}

export class MediaClassifier {
  private static readonly IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.webp', '.tiff'];
  private static readonly VIDEO_EXTENSIONS = ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv', '.m4v'];
  private static readonly AUDIO_EXTENSIONS = ['.mp3', '.wav', '.aac', '.flac', '.ogg', '.m4a', '.wma'];
  private static readonly DOCUMENT_EXTENSIONS = ['.pdf', '.doc', '.docx', '.txt', '.rtf', '.odt', '.pages'];
  private static readonly CODE_EXTENSIONS = ['.js', '.ts', '.py', '.java', '.cpp', '.c', '.cs', '.php', '.rb', '.go', '.rs'];
  private static readonly DATA_EXTENSIONS = ['.json', '.xml', '.csv', '.xlsx', '.sql', '.yaml', '.yml'];

  /**
   * Classify any input into appropriate media type and capabilities
   */
  static classifyInput(input: unknown): MediaInput {
    const mediaId = `media-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    
    if (typeof input === 'string') {
      return this.classifyStringInput(mediaId, input);
    } else if (input instanceof Buffer) {
      return this.classifyBufferInput(mediaId, input);
    } else if (input instanceof File || (input && typeof input === 'object' && 'name' in input)) {
      return this.classifyFileInput(mediaId, input as File);
    } else if (Array.isArray(input)) {
      return this.classifyArrayInput(mediaId, input);
    } else if (typeof input === 'object') {
      return this.classifyObjectInput(mediaId, input);
    }
    
    // Fallback to text
    return this.createTextMediaInput(mediaId, String(input));
  }

  /**
   * Classify string input (text, URL, file path, etc.)
   */
  private static classifyStringInput(id: string, input: string): MediaInput {
    // Check if it's a URL
    if (this.isUrl(input)) {
      return this.createUrlMediaInput(id, input);
    }
    
    // Check if it's a file path
    if (this.isFilePath(input)) {
      return this.classifyFilePathInput(id, input);
    }
    
    // Check if it contains structured data
    if (this.isStructuredData(input)) {
      return this.createDataMediaInput(id, input);
    }
    
    // Check if it's code
    if (this.isCode(input)) {
      return this.createCodeMediaInput(id, input);
    }
    
    // Default to text
    return this.createTextMediaInput(id, input);
  }

  /**
   * Classify buffer input
   */
  private static classifyBufferInput(id: string, buffer: Buffer): MediaInput {
    const format = this.detectBufferFormat(buffer);
    const size = buffer.length;
    
    if (this.isImageBuffer(buffer)) {
      return this.createImageMediaInput(id, buffer, format, size);
    } else if (this.isAudioBuffer(buffer)) {
      return this.createAudioMediaInput(id, buffer, format, size);
    } else if (this.isVideoBuffer(buffer)) {
      return this.createVideoMediaInput(id, buffer, format, size);
    } else if (this.isDocumentBuffer(buffer)) {
      return this.createDocumentMediaInput(id, buffer, format, size);
    }
    
    // Try to decode as text
    try {
      const text = buffer.toString('utf-8');
      return this.createTextMediaInput(id, text);
    } catch {
      return this.createDataMediaInput(id, buffer);
    }
  }

  /**
   * Classify file input
   */
  private static classifyFileInput(id: string, file: File): MediaInput {
    const extension = extname(file.name).toLowerCase();
    const name = basename(file.name);
    const size = file.size;
    
    const metadata = {
      format: extension || mime.lookup(file.name) || 'unknown',
      size,
      originalName: name
    };

    if (this.IMAGE_EXTENSIONS.includes(extension)) {
      return {
        id,
        type: 'image',
        source: file,
        metadata,
        capabilities: this.identifyCapabilities('image')
      };
    } else if (this.VIDEO_EXTENSIONS.includes(extension)) {
      return {
        id,
        type: 'video',
        source: file,
        metadata,
        capabilities: this.identifyCapabilities('video')
      };
    } else if (this.AUDIO_EXTENSIONS.includes(extension)) {
      return {
        id,
        type: 'audio',
        source: file,
        metadata,
        capabilities: this.identifyCapabilities('audio')
      };
    } else if (this.DOCUMENT_EXTENSIONS.includes(extension)) {
      return {
        id,
        type: 'document',
        source: file,
        metadata,
        capabilities: this.identifyCapabilities('document')
      };
    } else if (this.CODE_EXTENSIONS.includes(extension)) {
      return {
        id,
        type: 'code',
        source: file,
        metadata: { ...metadata, language: this.detectProgrammingLanguage(extension) },
        capabilities: this.identifyCapabilities('code')
      };
    } else if (this.DATA_EXTENSIONS.includes(extension)) {
      return {
        id,
        type: 'data',
        source: file,
        metadata,
        capabilities: this.identifyCapabilities('data')
      };
    }
    
    return {
      id,
      type: 'document',
      source: file,
      metadata,
      capabilities: this.identifyCapabilities('document')
    };
  }

  /**
   * Classify array input (mixed media)
   */
  private static classifyArrayInput(id: string, input: unknown[]): MediaInput {
    const subInputs = input.map((item, index) => 
      this.classifyInput(item)
    );
    
    const uniqueTypes = new Set(subInputs.map(item => item.type));
    const totalSize = subInputs.reduce((sum, item) => sum + item.metadata.size, 0);
    
    return {
      id,
      type: uniqueTypes.size > 1 ? 'mixed' : Array.from(uniqueTypes)[0],
      source: input,
      metadata: {
        format: 'mixed',
        size: totalSize,
        originalName: `mixed-media-${subInputs.length}-items`
      },
      capabilities: this.mergeCapabilities(subInputs.map(item => item.capabilities))
    };
  }

  /**
   * Classify object input (structured data)
   */
  private static classifyObjectInput(id: string, input: any): MediaInput {
    const jsonString = JSON.stringify(input, null, 2);
    return {
      id,
      type: 'data',
      source: input,
      metadata: {
        format: 'json',
        size: jsonString.length,
        originalName: 'structured-data'
      },
      capabilities: this.identifyCapabilities('data')
    };
  }

  /**
   * Identify capabilities for a given media type
   */
  static identifyCapabilities(mediaType: MediaType): ProcessingCapability[] {
    const capabilityMap: Record<MediaType, ProcessingCapability[]> = {
      'text': ['analyze', 'generate', 'transform', 'extract', 'synthesize'],
      'image': ['analyze', 'caption', 'transform', 'extract', 'generate'],
      'video': ['analyze', 'extract', 'transform', 'caption', 'transcribe'],
      'audio': ['analyze', 'transcribe', 'transform', 'extract', 'generate'],
      'document': ['analyze', 'extract', 'transform', 'synthesize'],
      'code': ['analyze', 'transform', 'extract', 'generate'],
      'data': ['analyze', 'transform', 'extract', 'synthesize'],
      'url': ['analyze', 'extract', 'transform'],
      'mixed': ['analyze', 'extract', 'transform', 'synthesize']
    };
    
    return capabilityMap[mediaType] || ['analyze'];
  }

  /**
   * Generate processing pipeline for given inputs and desired output
   */
  static generateProcessingPipeline(inputs: MediaInput[], desiredOutput: string): ProcessingPipeline {
    const pipelineId = `pipe-${Date.now()}`;
    const inputTypes = [...new Set(inputs.map(input => input.type))];
    const outputTypes = this.inferOutputTypes(desiredOutput);
    
    const steps = this.generateProcessingSteps(inputs, outputTypes);
    const parallelizable = this.canBatchProcess(steps);
    const estimatedDuration = this.estimatePipelineDuration(steps);
    
    return {
      id: pipelineId,
      inputTypes,
      outputTypes,
      steps,
      parallelizable,
      estimatedDuration
    };
  }

  /**
   * Determine if processing steps can be batched
   */
  static canBatchProcess(steps: ProcessingStep[]): boolean {
    // Check if steps have compatible batching capabilities
    const batchableSteps = steps.filter(step => step.canBatch);
    return batchableSteps.length > steps.length * 0.7; // 70% of steps must be batchable
  }

  /**
   * Group media inputs for optimal batch processing
   */
  static createBatchProcessingGroups(inputs: MediaInput[]): BatchProcessingGroup[] {
    const groups: BatchProcessingGroup[] = [];
    const processed = new Set<string>();
    
    // Group by media type and similar processing needs
    const typeGroups = this.groupByType(inputs);
    
    Object.entries(typeGroups).forEach(([type, mediaInputs]) => {
      if (mediaInputs.length > 1) {
        const sharedSteps = this.findSharedProcessingSteps(mediaInputs);
        const estimatedSavings = this.calculateBatchSavings(mediaInputs.length, sharedSteps);
        
        groups.push({
          id: `batch-${type}-${Date.now()}`,
          mediaInputs,
          sharedProcessingSteps: sharedSteps,
          estimatedSavings,
          batchSize: mediaInputs.length
        });
        
        mediaInputs.forEach(input => processed.add(input.id));
      }
    });
    
    // Handle remaining individual inputs
    const remainingInputs = inputs.filter(input => !processed.has(input.id));
    remainingInputs.forEach(input => {
      groups.push({
        id: `single-${input.id}`,
        mediaInputs: [input],
        sharedProcessingSteps: [],
        estimatedSavings: 0,
        batchSize: 1
      });
    });
    
    return groups;
  }

  /**
   * Analyze media input for processing recommendations
   */
  static analyzeMediaInput(input: MediaInput): MediaAnalysis {
    const complexity = this.assessComplexity(input);
    const features = this.extractFeatures(input);
    const recommendations = this.generateProcessingRecommendations(input, features);
    
    return {
      confidence: this.calculateClassificationConfidence(input),
      detectedFeatures: features,
      processingRecommendations: recommendations,
      estimatedComplexity: complexity,
      requiresSpecialHandling: this.requiresSpecialHandling(input)
    };
  }

  // Helper methods
  private static isUrl(input: string): boolean {
    try {
      new URL(input);
      return true;
    } catch {
      return false;
    }
  }

  private static isFilePath(input: string): boolean {
    return /^[./\\]|^[a-zA-Z]:[/\\]/.test(input) || input.includes('/') || input.includes('\\');
  }

  private static isStructuredData(input: string): boolean {
    try {
      JSON.parse(input);
      return true;
    } catch {
      return input.includes('<?xml') || 
             input.includes('---') || // YAML front matter
             input.includes(',') && input.includes('\n'); // CSV-like
    }
  }

  private static isCode(input: string): boolean {
    const codePatterns = [
      /function\s+\w+\s*\(/,
      /class\s+\w+/,
      /import\s+.*from/,
      /def\s+\w+\s*\(/,
      /public\s+(class|interface)/,
      /#include\s*</,
      /^\s*(const|let|var)\s+\w+\s*=/m
    ];
    
    return codePatterns.some(pattern => pattern.test(input));
  }

  private static detectBufferFormat(buffer: Buffer): string {
    // Simple magic number detection
    const header = buffer.slice(0, 16);
    
    if (header[0] === 0xFF && header[1] === 0xD8) return 'jpeg';
    if (header[0] === 0x89 && header.toString('ascii', 1, 4) === 'PNG') return 'png';
    if (header.toString('ascii', 0, 4) === 'GIF8') return 'gif';
    if (header.toString('ascii', 0, 4) === 'RIFF') return 'wav';
    if (header[0] === 0xFF && (header[1] & 0xE0) === 0xE0) return 'mp3';
    if (header.toString('ascii', 4, 8) === 'ftyp') return 'mp4';
    if (header.toString('ascii', 0, 4) === '%PDF') return 'pdf';
    
    return 'unknown';
  }

  private static isImageBuffer(buffer: Buffer): boolean {
    const format = this.detectBufferFormat(buffer);
    return ['jpeg', 'png', 'gif', 'bmp', 'webp'].includes(format);
  }

  private static isAudioBuffer(buffer: Buffer): boolean {
    const format = this.detectBufferFormat(buffer);
    return ['mp3', 'wav', 'aac', 'flac'].includes(format);
  }

  private static isVideoBuffer(buffer: Buffer): boolean {
    const format = this.detectBufferFormat(buffer);
    return ['mp4', 'avi', 'mov', 'webm'].includes(format);
  }

  private static isDocumentBuffer(buffer: Buffer): boolean {
    const format = this.detectBufferFormat(buffer);
    return ['pdf'].includes(format) || this.isTextBuffer(buffer);
  }

  private static isTextBuffer(buffer: Buffer): boolean {
    // Check if buffer contains valid UTF-8 text
    try {
      const text = buffer.toString('utf-8');
      // Simple heuristic: check for common text patterns and low control character ratio
      const controlChars = text.replace(/[\x09\x0A\x0D\x20-\x7E]/g, '').length;
      return controlChars / text.length < 0.1;
    } catch {
      return false;
    }
  }

  private static classifyFilePathInput(id: string, filePath: string): MediaInput {
    const extension = extname(filePath).toLowerCase();
    const name = basename(filePath);
    
    // Try to determine file size if accessible
    let size = 0;
    try {
      const stats = require('fs').statSync(filePath);
      size = stats.size;
    } catch {
      // File might not be accessible or exist
    }
    
    const metadata = {
      format: extension || 'unknown',
      size,
      originalName: name
    };

    if (this.IMAGE_EXTENSIONS.includes(extension)) {
      return { id, type: 'image', source: filePath, metadata, capabilities: this.identifyCapabilities('image') };
    } else if (this.VIDEO_EXTENSIONS.includes(extension)) {
      return { id, type: 'video', source: filePath, metadata, capabilities: this.identifyCapabilities('video') };
    } else if (this.AUDIO_EXTENSIONS.includes(extension)) {
      return { id, type: 'audio', source: filePath, metadata, capabilities: this.identifyCapabilities('audio') };
    } else if (this.DOCUMENT_EXTENSIONS.includes(extension)) {
      return { id, type: 'document', source: filePath, metadata, capabilities: this.identifyCapabilities('document') };
    } else if (this.CODE_EXTENSIONS.includes(extension)) {
      return { id, type: 'code', source: filePath, metadata: { ...metadata, language: this.detectProgrammingLanguage(extension) }, capabilities: this.identifyCapabilities('code') };
    } else if (this.DATA_EXTENSIONS.includes(extension)) {
      return { id, type: 'data', source: filePath, metadata, capabilities: this.identifyCapabilities('data') };
    }
    
    return { id, type: 'document', source: filePath, metadata, capabilities: this.identifyCapabilities('document') };
  }

  private static createTextMediaInput(id: string, text: string): MediaInput {
    return {
      id,
      type: 'text',
      source: text,
      metadata: {
        format: 'text/plain',
        size: text.length,
        language: this.detectLanguage(text)
      },
      capabilities: this.identifyCapabilities('text')
    };
  }

  private static createUrlMediaInput(id: string, url: string): MediaInput {
    const urlObj = new URL(url);
    return {
      id,
      type: 'url',
      source: url,
      metadata: {
        format: 'url',
        size: url.length,
        originalName: urlObj.hostname
      },
      capabilities: this.identifyCapabilities('url')
    };
  }

  private static createDataMediaInput(id: string, data: any): MediaInput {
    const dataString = typeof data === 'string' ? data : JSON.stringify(data);
    return {
      id,
      type: 'data',
      source: data,
      metadata: {
        format: this.detectDataFormat(dataString),
        size: dataString.length
      },
      capabilities: this.identifyCapabilities('data')
    };
  }

  private static createCodeMediaInput(id: string, code: string): MediaInput {
    return {
      id,
      type: 'code',
      source: code,
      metadata: {
        format: 'text/code',
        size: code.length,
        language: this.detectProgrammingLanguageFromContent(code)
      },
      capabilities: this.identifyCapabilities('code')
    };
  }

  private static createImageMediaInput(id: string, source: any, format: string, size: number): MediaInput {
    return {
      id,
      type: 'image',
      source,
      metadata: { format, size },
      capabilities: this.identifyCapabilities('image')
    };
  }

  private static createAudioMediaInput(id: string, source: any, format: string, size: number): MediaInput {
    return {
      id,
      type: 'audio',
      source,
      metadata: { format, size },
      capabilities: this.identifyCapabilities('audio')
    };
  }

  private static createVideoMediaInput(id: string, source: any, format: string, size: number): MediaInput {
    return {
      id,
      type: 'video',
      source,
      metadata: { format, size },
      capabilities: this.identifyCapabilities('video')
    };
  }

  private static createDocumentMediaInput(id: string, source: any, format: string, size: number): MediaInput {
    return {
      id,
      type: 'document',
      source,
      metadata: { format, size },
      capabilities: this.identifyCapabilities('document')
    };
  }

  private static detectProgrammingLanguage(extension: string): string {
    const languageMap: Record<string, string> = {
      '.js': 'javascript',
      '.ts': 'typescript',
      '.py': 'python',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'c',
      '.cs': 'csharp',
      '.php': 'php',
      '.rb': 'ruby',
      '.go': 'go',
      '.rs': 'rust'
    };
    
    return languageMap[extension] || 'unknown';
  }

  private static detectProgrammingLanguageFromContent(code: string): string {
    if (code.includes('function') && code.includes('=>')) return 'javascript';
    if (code.includes('def ') && code.includes(':')) return 'python';
    if (code.includes('public class') && code.includes('{')) return 'java';
    if (code.includes('#include') && code.includes('<')) return 'cpp';
    if (code.includes('using System')) return 'csharp';
    if (code.includes('<?php')) return 'php';
    if (code.includes('fn ') && code.includes('->')) return 'rust';
    if (code.includes('func ') && code.includes('package ')) return 'go';
    
    return 'unknown';
  }

  private static detectLanguage(text: string): string {
    // Simple language detection heuristics
    const commonWords = {
      'english': ['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all'],
      'spanish': ['el', 'la', 'de', 'que', 'y', 'a', 'en', 'un'],
      'french': ['le', 'de', 'et', 'à', 'un', 'il', 'être', 'et'],
      'german': ['der', 'die', 'und', 'in', 'den', 'von', 'zu', 'das']
    };
    
    const words = text.toLowerCase().split(/\s+/).slice(0, 100);
    let bestMatch = 'unknown';
    let maxScore = 0;
    
    Object.entries(commonWords).forEach(([lang, commonLangWords]) => {
      const score = words.filter(word => commonLangWords.includes(word)).length;
      if (score > maxScore) {
        maxScore = score;
        bestMatch = lang;
      }
    });
    
    return bestMatch;
  }

  private static detectDataFormat(data: string): string {
    if (data.startsWith('{') || data.startsWith('[')) return 'json';
    if (data.startsWith('<?xml') || data.includes('<root>')) return 'xml';
    if (data.includes('---\n') || data.includes(': ')) return 'yaml';
    if (data.includes(',') && data.includes('\n')) return 'csv';
    return 'text';
  }

  private static mergeCapabilities(capabilityArrays: ProcessingCapability[][]): ProcessingCapability[] {
    const merged = new Set<ProcessingCapability>();
    capabilityArrays.forEach(capabilities => {
      capabilities.forEach(cap => merged.add(cap));
    });
    return Array.from(merged);
  }

  private static inferOutputTypes(desiredOutput: string): MediaType[] {
    const outputKeywords = {
      'text': ['text', 'summary', 'analysis', 'report', 'description'],
      'image': ['image', 'picture', 'visual', 'chart', 'graph', 'diagram'],
      'video': ['video', 'movie', 'animation', 'clip'],
      'audio': ['audio', 'speech', 'music', 'sound'],
      'data': ['data', 'json', 'csv', 'table', 'database']
    };
    
    const lowerOutput = desiredOutput.toLowerCase();
    const detectedTypes: MediaType[] = [];
    
    Object.entries(outputKeywords).forEach(([type, keywords]) => {
      if (keywords.some(keyword => lowerOutput.includes(keyword))) {
        detectedTypes.push(type as MediaType);
      }
    });
    
    return detectedTypes.length > 0 ? detectedTypes : ['text'];
  }

  private static generateProcessingSteps(inputs: MediaInput[], outputTypes: MediaType[]): ProcessingStep[] {
    const steps: ProcessingStep[] = [];
    
    inputs.forEach((input, index) => {
      outputTypes.forEach((outputType, outputIndex) => {
        if (input.type !== outputType) {
          const step = this.createProcessingStep(input, outputType, index, outputIndex);
          steps.push(step);
        }
      });
    });
    
    return steps;
  }

  private static createProcessingStep(
    input: MediaInput,
    outputType: MediaType,
    inputIndex: number,
    outputIndex: number
  ): ProcessingStep {
    const stepId = `step-${inputIndex}-${outputIndex}`;
    const stepName = `Convert ${input.type} to ${outputType}`;
    
    return {
      id: stepId,
      name: stepName,
      inputType: input.type,
      outputType,
      dependencies: inputIndex > 0 ? [`step-${inputIndex - 1}-${outputIndex}`] : [],
      canBatch: this.canStepBeBatched(input.type, outputType),
      estimatedDuration: this.estimateStepDuration(input.type, outputType, input.metadata.size),
      requiredCapabilities: this.getRequiredCapabilities(input.type, outputType),
      fallbackOptions: this.getFallbackOptions(input.type, outputType)
    };
  }

  private static canStepBeBatched(inputType: MediaType, outputType: MediaType): boolean {
    // Most image and text processing can be batched
    const batchableTypes = ['image', 'text', 'document', 'data'];
    return batchableTypes.includes(inputType) && batchableTypes.includes(outputType);
  }

  private static estimateStepDuration(inputType: MediaType, outputType: MediaType, size: number): number {
    const baseDurations = {
      'text': 5000,
      'image': 15000,
      'audio': 30000,
      'video': 60000,
      'document': 20000,
      'data': 10000
    };
    
    const inputDuration = baseDurations[inputType] || 10000;
    const outputDuration = baseDurations[outputType] || 10000;
    const sizeFactor = Math.min(3, size / 1000000); // Scale with size up to 3x
    
    return Math.round((inputDuration + outputDuration) * sizeFactor);
  }

  private static getRequiredCapabilities(inputType: MediaType, outputType: MediaType): ProcessingCapability[] {
    const conversionMap: Record<string, ProcessingCapability[]> = {
      'image-text': ['caption', 'analyze'],
      'audio-text': ['transcribe', 'analyze'],
      'video-text': ['transcribe', 'caption', 'analyze'],
      'text-image': ['generate'],
      'text-audio': ['generate', 'synthesize'],
      'document-text': ['extract', 'analyze'],
      'data-text': ['analyze', 'synthesize']
    };
    
    const key = `${inputType}-${outputType}`;
    return conversionMap[key] || ['transform'];
  }

  private static getFallbackOptions(inputType: MediaType, outputType: MediaType): string[] {
    // Return alternative processing approaches
    return ['manual_processing', 'alternative_api', 'local_processing'];
  }

  private static estimatePipelineDuration(steps: ProcessingStep[]): number {
    return steps.reduce((total, step) => total + step.estimatedDuration, 0);
  }

  private static groupByType(inputs: MediaInput[]): Record<string, MediaInput[]> {
    return inputs.reduce((groups, input) => {
      if (!groups[input.type]) {
        groups[input.type] = [];
      }
      groups[input.type].push(input);
      return groups;
    }, {} as Record<string, MediaInput[]>);
  }

  private static findSharedProcessingSteps(inputs: MediaInput[]): ProcessingStep[] {
    // Find processing steps that can be shared across inputs
    if (inputs.length < 2) return [];
    
    const firstInputSteps = this.generateProcessingSteps([inputs[0]], ['text']);
    return firstInputSteps.filter(step => step.canBatch);
  }

  private static calculateBatchSavings(batchSize: number, sharedSteps: ProcessingStep[]): number {
    const sequentialTime = batchSize * sharedSteps.reduce((sum, step) => sum + step.estimatedDuration, 0);
    const batchTime = sharedSteps.reduce((sum, step) => sum + step.estimatedDuration, 0);
    return Math.max(0, sequentialTime - batchTime);
  }

  private static assessComplexity(input: MediaInput): 'low' | 'medium' | 'high' {
    const size = input.metadata.size;
    const type = input.type;
    
    if (type === 'video' || size > 10000000) return 'high';
    if (type === 'audio' || type === 'image' || size > 1000000) return 'medium';
    return 'low';
  }

  private static extractFeatures(input: MediaInput): string[] {
    const features: string[] = [];
    
    features.push(`type:${input.type}`);
    features.push(`format:${input.metadata.format}`);
    features.push(`size:${this.categorizeSize(input.metadata.size)}`);
    
    if (input.metadata.duration) {
      features.push(`duration:${this.categorizeDuration(input.metadata.duration)}`);
    }
    
    if (input.metadata.dimensions) {
      features.push(`resolution:${this.categorizeResolution(input.metadata.dimensions)}`);
    }
    
    if (input.metadata.language) {
      features.push(`language:${input.metadata.language}`);
    }
    
    return features;
  }

  private static generateProcessingRecommendations(input: MediaInput, features: string[]): ProcessingCapability[] {
    const recommendations: ProcessingCapability[] = [...input.capabilities];
    
    // Add specific recommendations based on features
    if (features.includes('type:image')) {
      recommendations.push('caption');
    }
    
    if (features.includes('type:audio')) {
      recommendations.push('transcribe');
    }
    
    if (features.some(f => f.startsWith('language:') && f !== 'language:english')) {
      recommendations.push('transform'); // For translation
    }
    
    return [...new Set(recommendations)];
  }

  private static calculateClassificationConfidence(input: MediaInput): number {
    let confidence = 80; // Base confidence
    
    // Increase confidence for clear file extensions or formats
    if (input.metadata.format && input.metadata.format !== 'unknown') {
      confidence += 15;
    }
    
    // Decrease confidence for edge cases
    if (input.type === 'mixed') {
      confidence -= 20;
    }
    
    if (input.metadata.size === 0) {
      confidence -= 10;
    }
    
    return Math.min(100, Math.max(50, confidence));
  }

  private static requiresSpecialHandling(input: MediaInput): boolean {
    return input.type === 'mixed' || 
           input.metadata.size > 100000000 || // > 100MB
           input.metadata.format === 'unknown' ||
           (input.metadata.duration && input.metadata.duration > 3600000); // > 1 hour
  }

  private static categorizeSize(size: number): string {
    if (size < 1000) return 'tiny';
    if (size < 100000) return 'small';
    if (size < 10000000) return 'medium';
    if (size < 100000000) return 'large';
    return 'huge';
  }

  private static categorizeDuration(duration: number): string {
    if (duration < 30000) return 'short';
    if (duration < 300000) return 'medium';
    if (duration < 1800000) return 'long';
    return 'very_long';
  }

  private static categorizeResolution(dimensions: { width: number; height: number }): string {
    const pixels = dimensions.width * dimensions.height;
    if (pixels < 480000) return 'low';
    if (pixels < 2000000) return 'standard';
    if (pixels < 8000000) return 'high';
    return 'ultra_high';
  }
}