/**
 * File-Workflow Integration Service
 * Bridges the file management system with the existing workflow execution system
 */

import { EventEmitter } from 'events';
import { FileManager } from '../../../storage/fileManager';
import { FileProcessor } from '../../../storage/fileProcessor';
import { RuntimeWorkflowGenerator } from '../../core/utils/runtimeWorkflowGenerator';
import { AtomicDecomposer } from '../../core/utils/atomicDecomposer';
import { ExecutionService } from './ExecutionService';
import { WorkflowService } from './WorkflowService';
import { 
  FileMetadata, 
  FileUploadResult, 
  FileWorkflowSuggestion 
} from '../../../shared/types/fileManagement';
import { 
  AtomicWorkflow, 
  AtomicTask, 
  WorkflowIntent,
  ExecutionState
} from '../../../shared/types/atomicWorkflow';
import { Workflow } from '../../../core/types/workflowSchema';

export interface FileWorkflowIntegrationConfig {
  autoGenerateWorkflows: boolean;
  enableFileBasedDecomposition: boolean;
  maxWorkflowsPerFile: number;
  defaultWorkflowTags: string[];
  enableRealTimeProcessing: boolean;
  workflowExecutionTimeout: number;
}

export interface FileWorkflowExecution {
  id: string;
  fileId: string;
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startTime: number;
  endTime?: number;
  progress: number;
  results?: any[];
  error?: string;
  metadata: {
    originalFileName: string;
    workflowType: string;
    atomicTaskCount: number;
    estimatedDuration: number;
  };
}

export class FileWorkflowIntegration extends EventEmitter {
  private config: FileWorkflowIntegrationConfig;
  private fileManager: FileManager;
  private fileProcessor: FileProcessor;
  private workflowGenerator: RuntimeWorkflowGenerator;
  private atomicDecomposer: AtomicDecomposer;
  private executionService: ExecutionService;
  private workflowService: WorkflowService;
  
  private activeExecutions: Map<string, FileWorkflowExecution> = new Map();
  private fileWorkflowCache: Map<string, AtomicWorkflow[]> = new Map();

  constructor(
    config: FileWorkflowIntegrationConfig,
    fileManager: FileManager,
    fileProcessor: FileProcessor,
    executionService: ExecutionService,
    workflowService: WorkflowService
  ) {
    super();
    this.config = config;
    this.fileManager = fileManager;
    this.fileProcessor = fileProcessor;
    this.executionService = executionService;
    this.workflowService = workflowService;
    
    this.workflowGenerator = new RuntimeWorkflowGenerator();
    this.atomicDecomposer = new AtomicDecomposer();
    
    this.setupEventListeners();
  }

  /**
   * Process uploaded file and generate workflow suggestions
   */
  async processUploadedFile(uploadResult: FileUploadResult): Promise<FileWorkflowSuggestion[]> {
    try {
      const { fileId, metadata, processingCapabilities } = uploadResult;
      
      this.emit('file-upload-processed', { fileId, metadata });

      // Generate workflow suggestions based on file type and capabilities
      const suggestions = await this.generateWorkflowSuggestions(metadata, processingCapabilities);
      
      // Cache suggestions for quick access
      const workflows = await this.generateAtomicWorkflows(suggestions, metadata);
      this.fileWorkflowCache.set(fileId, workflows);

      // Auto-generate workflows if enabled
      if (this.config.autoGenerateWorkflows && suggestions.length > 0) {
        await this.autoGenerateWorkflows(fileId, suggestions.slice(0, this.config.maxWorkflowsPerFile));
      }

      this.emit('workflow-suggestions-generated', { fileId, suggestions, workflows });
      
      return suggestions;
    } catch (error) {
      this.emit('file-processing-error', { fileId: uploadResult.fileId, error });
      throw error;
    }
  }

  /**
   * Execute a workflow for a specific file
   */
  async executeFileWorkflow(
    fileId: string, 
    workflowType: string, 
    options: { priority?: number; timeout?: number } = {}
  ): Promise<FileWorkflowExecution> {
    try {
      const metadata = await this.fileManager.getFileMetadata(fileId);
      if (!metadata) {
        throw new Error(`File ${fileId} not found`);
      }

      // Get or generate workflow
      let workflow = await this.getWorkflowForFile(fileId, workflowType);
      if (!workflow) {
        workflow = await this.generateWorkflowForFileType(metadata, workflowType);
      }

      // Create file workflow execution
      const execution: FileWorkflowExecution = {
        id: this.generateExecutionId(),
        fileId,
        workflowId: workflow.id,
        status: 'pending',
        startTime: Date.now(),
        progress: 0,
        metadata: {
          originalFileName: metadata.originalName,
          workflowType,
          atomicTaskCount: workflow.atomicTasks.length,
          estimatedDuration: workflow.estimatedDuration
        }
      };

      this.activeExecutions.set(execution.id, execution);

      // Start workflow execution
      await this.executeWorkflow(execution, workflow, metadata);

      this.emit('file-workflow-started', execution);
      
      return execution;
    } catch (error) {
      this.emit('file-workflow-error', { fileId, workflowType, error });
      throw error;
    }
  }

  /**
   * Get execution status for a file workflow
   */
  async getExecutionStatus(executionId: string): Promise<FileWorkflowExecution | null> {
    return this.activeExecutions.get(executionId) || null;
  }

  /**
   * Cancel a running file workflow execution
   */
  async cancelExecution(executionId: string): Promise<boolean> {
    const execution = this.activeExecutions.get(executionId);
    if (!execution || execution.status === 'completed' || execution.status === 'failed') {
      return false;
    }

    execution.status = 'cancelled';
    execution.endTime = Date.now();
    
    // Cancel the underlying workflow execution
    try {
      await this.executionService.cancelExecution(execution.workflowId);
    } catch (error) {
      console.warn('Failed to cancel underlying workflow execution:', error);
    }

    this.emit('file-workflow-cancelled', execution);
    return true;
  }

  /**
   * Get all active executions
   */
  getActiveExecutions(): FileWorkflowExecution[] {
    return Array.from(this.activeExecutions.values())
      .filter(exec => exec.status === 'running' || exec.status === 'pending');
  }

  /**
   * Get workflow suggestions for a file
   */
  async getWorkflowSuggestionsForFile(fileId: string): Promise<FileWorkflowSuggestion[]> {
    const metadata = await this.fileManager.getFileMetadata(fileId);
    if (!metadata) {
      throw new Error(`File ${fileId} not found`);
    }

    const capabilities = await this.fileProcessor.analyzeFile(fileId);
    return this.generateWorkflowSuggestions(metadata, capabilities);
  }

  /**
   * Batch process multiple files with the same workflow
   */
  async batchProcessFiles(
    fileIds: string[], 
    workflowType: string,
    options: { parallel?: boolean; maxConcurrent?: number } = {}
  ): Promise<FileWorkflowExecution[]> {
    const executions: FileWorkflowExecution[] = [];
    const { parallel = true, maxConcurrent = 5 } = options;

    if (parallel) {
      // Process files in parallel with concurrency limit
      const batches = this.chunkArray(fileIds, maxConcurrent);
      
      for (const batch of batches) {
        const batchPromises = batch.map(fileId => 
          this.executeFileWorkflow(fileId, workflowType)
        );
        
        const batchResults = await Promise.allSettled(batchPromises);
        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            executions.push(result.value);
          } else {
            console.error(`Failed to process file ${batch[index]}:`, result.reason);
          }
        });
      }
    } else {
      // Process files sequentially
      for (const fileId of fileIds) {
        try {
          const execution = await this.executeFileWorkflow(fileId, workflowType);
          executions.push(execution);
        } catch (error) {
          console.error(`Failed to process file ${fileId}:`, error);
        }
      }
    }

    this.emit('batch-processing-completed', { fileIds, workflowType, executions });
    return executions;
  }

  // Private methods

  private setupEventListeners(): void {
    // Listen to file manager events
    this.fileManager.on('file-uploaded', (result: FileUploadResult) => {
      if (this.config.enableRealTimeProcessing) {
        this.processUploadedFile(result).catch(error => {
          console.error('Real-time file processing failed:', error);
        });
      }
    });

    // Listen to workflow completion events
    this.executionService.on('workflow-completed', (workflowId: string, results: any[]) => {
      this.handleWorkflowCompletion(workflowId, results);
    });

    this.executionService.on('workflow-failed', (workflowId: string, error: Error) => {
      this.handleWorkflowFailure(workflowId, error);
    });

    // Listen to task progress updates
    this.executionService.on('task-progress', (workflowId: string, taskId: string, progress: number) => {
      this.updateExecutionProgress(workflowId, taskId, progress);
    });
  }

  private async generateWorkflowSuggestions(
    metadata: FileMetadata, 
    capabilities: any[]
  ): Promise<FileWorkflowSuggestion[]> {
    const suggestions: FileWorkflowSuggestion[] = [];
    
    // File type specific suggestions
    if (metadata.mimeType.startsWith('image/')) {
      suggestions.push(
        {
          workflowType: 'image_enhancement',
          confidence: 0.9,
          requiredInputs: [metadata.id],
          expectedOutputs: ['enhanced_image', 'enhancement_report'],
          estimatedDuration: 30000,
          description: 'Enhance image quality with AI-powered improvements',
          tags: ['image', 'enhancement', 'ai']
        },
        {
          workflowType: 'object_detection',
          confidence: 0.85,
          requiredInputs: [metadata.id],
          expectedOutputs: ['detected_objects', 'bounding_boxes', 'confidence_scores'],
          estimatedDuration: 20000,
          description: 'Detect and classify objects in the image',
          tags: ['image', 'detection', 'computer-vision']
        }
      );
    }

    if (metadata.mimeType.startsWith('video/')) {
      suggestions.push(
        {
          workflowType: 'video_analysis',
          confidence: 0.88,
          requiredInputs: [metadata.id],
          expectedOutputs: ['video_summary', 'key_frames', 'transcript'],
          estimatedDuration: 120000,
          description: 'Comprehensive video analysis with scene detection and transcription',
          tags: ['video', 'analysis', 'transcription']
        },
        {
          workflowType: 'video_enhancement',
          confidence: 0.82,
          requiredInputs: [metadata.id],
          expectedOutputs: ['enhanced_video', 'quality_report'],
          estimatedDuration: 180000,
          description: 'Enhance video quality and stabilization',
          tags: ['video', 'enhancement', 'quality']
        }
      );
    }

    if (metadata.mimeType.startsWith('audio/')) {
      suggestions.push(
        {
          workflowType: 'audio_transcription',
          confidence: 0.95,
          requiredInputs: [metadata.id],
          expectedOutputs: ['transcript', 'speaker_segments', 'confidence_scores'],
          estimatedDuration: 60000,
          description: 'Convert speech to text with speaker identification',
          tags: ['audio', 'transcription', 'speech-to-text']
        },
        {
          workflowType: 'audio_enhancement',
          confidence: 0.85,
          requiredInputs: [metadata.id],
          expectedOutputs: ['enhanced_audio', 'noise_profile'],
          estimatedDuration: 45000,
          description: 'Reduce noise and enhance audio quality',
          tags: ['audio', 'enhancement', 'noise-reduction']
        }
      );
    }

    if (this.isDocumentFile(metadata.mimeType)) {
      suggestions.push(
        {
          workflowType: 'document_analysis',
          confidence: 0.92,
          requiredInputs: [metadata.id],
          expectedOutputs: ['extracted_text', 'document_structure', 'key_insights'],
          estimatedDuration: 40000,
          description: 'Extract and analyze document content',
          tags: ['document', 'analysis', 'text-extraction']
        },
        {
          workflowType: 'document_summarization',
          confidence: 0.88,
          requiredInputs: [metadata.id],
          expectedOutputs: ['summary', 'key_points', 'entities'],
          estimatedDuration: 35000,
          description: 'Generate intelligent document summary',
          tags: ['document', 'summarization', 'nlp']
        }
      );
    }

    // Add capability-based suggestions
    for (const capability of capabilities) {
      if (capability.type === 'text_extraction' && capability.confidence > 0.8) {
        suggestions.push({
          workflowType: 'text_extraction_and_analysis',
          confidence: capability.confidence,
          requiredInputs: [metadata.id],
          expectedOutputs: ['extracted_text', 'text_analysis', 'entities'],
          estimatedDuration: capability.estimatedDuration,
          description: 'Extract text and perform NLP analysis',
          tags: ['text', 'extraction', 'nlp']
        });
      }
    }

    // Sort by confidence and return top suggestions
    return suggestions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5);
  }

  private async generateAtomicWorkflows(
    suggestions: FileWorkflowSuggestion[],
    metadata: FileMetadata
  ): Promise<AtomicWorkflow[]> {
    const workflows: AtomicWorkflow[] = [];

    for (const suggestion of suggestions) {
      try {
        const intent: WorkflowIntent = {
          primaryGoal: suggestion.description,
          outputType: this.getOutputTypeFromWorkflowType(suggestion.workflowType),
          complexity: this.getComplexityFromDuration(suggestion.estimatedDuration),
          requirements: suggestion.tags,
          constraints: [],
          userFiles: [metadata],
          confidence: suggestion.confidence
        };

        const workflow = await this.workflowGenerator.generateWorkflowFromIntent(intent, [metadata]);
        workflows.push(workflow);
      } catch (error) {
        console.warn(`Failed to generate atomic workflow for ${suggestion.workflowType}:`, error);
      }
    }

    return workflows;
  }

  private async autoGenerateWorkflows(
    fileId: string, 
    suggestions: FileWorkflowSuggestion[]
  ): Promise<void> {
    for (const suggestion of suggestions) {
      try {
        // Only auto-generate high-confidence workflows
        if (suggestion.confidence > 0.85) {
          await this.executeFileWorkflow(fileId, suggestion.workflowType, { priority: 1 });
        }
      } catch (error) {
        console.warn(`Auto-generation failed for ${suggestion.workflowType}:`, error);
      }
    }
  }

  private async getWorkflowForFile(fileId: string, workflowType: string): Promise<AtomicWorkflow | null> {
    const cachedWorkflows = this.fileWorkflowCache.get(fileId);
    if (cachedWorkflows) {
      return cachedWorkflows.find(w => 
        w.metadata?.category === workflowType || 
        w.name.toLowerCase().includes(workflowType.toLowerCase())
      ) || null;
    }
    return null;
  }

  private async generateWorkflowForFileType(
    metadata: FileMetadata, 
    workflowType: string
  ): Promise<AtomicWorkflow> {
    const intent: WorkflowIntent = {
      primaryGoal: `Process ${metadata.originalName} with ${workflowType}`,
      outputType: this.getOutputTypeFromWorkflowType(workflowType),
      complexity: 5,
      requirements: [workflowType],
      constraints: [],
      userFiles: [metadata],
      confidence: 0.8
    };

    return await this.workflowGenerator.generateWorkflowFromIntent(intent, [metadata]);
  }

  private async executeWorkflow(
    execution: FileWorkflowExecution,
    workflow: AtomicWorkflow,
    metadata: FileMetadata
  ): Promise<void> {
    try {
      execution.status = 'running';
      
      // Convert atomic workflow to legacy workflow format for execution
      const legacyWorkflow = await this.convertToLegacyWorkflow(workflow, metadata);
      
      // Start execution with timeout
      const executionPromise = this.executionService.executeWorkflow(legacyWorkflow);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Workflow execution timeout')), 
          this.config.workflowExecutionTimeout);
      });

      const results = await Promise.race([executionPromise, timeoutPromise]);
      
      execution.status = 'completed';
      execution.endTime = Date.now();
      execution.progress = 100;
      execution.results = Array.isArray(results) ? results : [results];
      
      this.emit('file-workflow-completed', execution);
    } catch (error) {
      execution.status = 'failed';
      execution.endTime = Date.now();
      execution.error = error instanceof Error ? error.message : 'Unknown error';
      
      this.emit('file-workflow-failed', execution);
    }
  }

  private async convertToLegacyWorkflow(workflow: AtomicWorkflow, metadata: FileMetadata): Promise<Workflow> {
    // Convert atomic workflow to legacy format
    const legacyWorkflow: Workflow = {
      id: workflow.id,
      name: workflow.name,
      description: workflow.description,
      prompt: workflow.description,
      subtasks: workflow.atomicTasks.map(task => ({
        id: task.id,
        description: task.description,
        prompt: task.description,
        dependencies: task.dependencies,
        agents: [], // Would be populated based on task requirements
        context: {},
        priority: task.priority || 5
      })),
      metadata: {
        ...workflow.metadata,
        fileId: metadata.id,
        originalFileName: metadata.originalName
      },
      tags: this.config.defaultWorkflowTags.concat(workflow.metadata?.tags || []),
      created: Date.now(),
      modified: Date.now()
    };

    return legacyWorkflow;
  }

  private handleWorkflowCompletion(workflowId: string, results: any[]): void {
    // Find execution by workflow ID
    const execution = Array.from(this.activeExecutions.values())
      .find(exec => exec.workflowId === workflowId);
    
    if (execution) {
      execution.status = 'completed';
      execution.endTime = Date.now();
      execution.progress = 100;
      execution.results = results;
      
      this.emit('file-workflow-completed', execution);
    }
  }

  private handleWorkflowFailure(workflowId: string, error: Error): void {
    const execution = Array.from(this.activeExecutions.values())
      .find(exec => exec.workflowId === workflowId);
    
    if (execution) {
      execution.status = 'failed';
      execution.endTime = Date.now();
      execution.error = error.message;
      
      this.emit('file-workflow-failed', execution);
    }
  }

  private updateExecutionProgress(workflowId: string, taskId: string, progress: number): void {
    const execution = Array.from(this.activeExecutions.values())
      .find(exec => exec.workflowId === workflowId);
    
    if (execution) {
      // Calculate overall progress based on task progress
      const totalTasks = execution.metadata.atomicTaskCount;
      execution.progress = Math.min(100, (progress / totalTasks) * 100);
      
      this.emit('file-workflow-progress', { execution, taskId, progress });
    }
  }

  private isDocumentFile(mimeType: string): boolean {
    const documentTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/rtf'
    ];
    return documentTypes.includes(mimeType);
  }

  private getOutputTypeFromWorkflowType(workflowType: string): any {
    if (workflowType.includes('video')) return 'video';
    if (workflowType.includes('audio')) return 'audio';
    if (workflowType.includes('image')) return 'image';
    if (workflowType.includes('document')) return 'document';
    return 'data';
  }

  private getComplexityFromDuration(duration: number): number {
    if (duration < 30000) return 3; // Simple
    if (duration < 120000) return 6; // Moderate  
    return 9; // Complex
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private generateExecutionId(): string {
    return `file_exec_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  }

  // Cleanup method
  cleanup(): void {
    // Cancel all active executions
    for (const execution of this.activeExecutions.values()) {
      if (execution.status === 'running' || execution.status === 'pending') {
        this.cancelExecution(execution.id);
      }
    }
    
    // Clear caches
    this.fileWorkflowCache.clear();
    this.activeExecutions.clear();
  }
}

export default FileWorkflowIntegration;