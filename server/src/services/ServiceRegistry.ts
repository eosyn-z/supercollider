/**
 * Service registry to prevent circular dependencies
 */

import { WorkflowService } from './WorkflowService';
import { AgentService } from './AgentService';
import { ExecutionService } from './ExecutionService';
import { SystemService } from './SystemService';
import { FileWorkflowIntegration } from './FileWorkflowIntegration';
import { FileManager } from '../../storage/fileManager';
import { FileProcessor } from '../../storage/fileProcessor';

class ServiceRegistry {
  private static instance: ServiceRegistry;
  private _workflowService?: WorkflowService;
  private _agentService?: AgentService;
  private _executionService?: ExecutionService;
  private _systemService?: SystemService;
  private _fileWorkflowIntegration?: FileWorkflowIntegration;
  private _fileManager?: FileManager;
  private _fileProcessor?: FileProcessor;

  private constructor() {}

  static getInstance(): ServiceRegistry {
    if (!ServiceRegistry.instance) {
      ServiceRegistry.instance = new ServiceRegistry();
    }
    return ServiceRegistry.instance;
  }

  get workflowService(): WorkflowService {
    if (!this._workflowService) {
      this._workflowService = new WorkflowService();
    }
    return this._workflowService;
  }

  get agentService(): AgentService {
    if (!this._agentService) {
      this._agentService = new AgentService();
    }
    return this._agentService;
  }

  get executionService(): ExecutionService {
    if (!this._executionService) {
      this._executionService = new ExecutionService();
    }
    return this._executionService;
  }

  get systemService(): SystemService {
    if (!this._systemService) {
      this._systemService = new SystemService();
    }
    return this._systemService;
  }

  get fileManager(): FileManager {
    if (!this._fileManager) {
      this._fileManager = new FileManager({
        basePath: process.env.FILE_STORAGE_PATH || './storage',
        maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '104857600'), // 100MB
        allowedTypes: ['*'],
        enableVersioning: true,
        enableBackup: true,
        tempDirectory: './temp',
        maxConcurrentUploads: 5,
        enableCompression: false,
        compressionLevel: 6,
        enableThumbnails: false,
        thumbnailSizes: [{ width: 150, height: 150 }, { width: 300, height: 300 }]
      });
    }
    return this._fileManager;
  }

  get fileProcessor(): FileProcessor {
    if (!this._fileProcessor) {
      const config = {
        basePath: process.env.FILE_STORAGE_PATH || './storage',
        maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '104857600'), // 100MB
        allowedTypes: ['*'],
        enableVersioning: true,
        enableBackup: true,
        tempDirectory: './temp',
        maxConcurrentUploads: 5,
        enableCompression: false,
        compressionLevel: 6,
        enableThumbnails: false,
        thumbnailSizes: [{ width: 150, height: 150 }, { width: 300, height: 300 }]
      };
      this._fileProcessor = new FileProcessor(config);
    }
    return this._fileProcessor;
  }

  get fileWorkflowIntegration(): FileWorkflowIntegration {
    if (!this._fileWorkflowIntegration) {
      const config = {
        autoGenerateWorkflows: process.env.AUTO_GENERATE_WORKFLOWS === 'true',
        enableFileBasedDecomposition: true,
        maxWorkflowsPerFile: parseInt(process.env.MAX_WORKFLOWS_PER_FILE || '3'),
        defaultWorkflowTags: ['file-based', 'auto-generated'],
        enableRealTimeProcessing: process.env.ENABLE_REALTIME_PROCESSING === 'true',
        workflowExecutionTimeout: parseInt(process.env.WORKFLOW_EXECUTION_TIMEOUT || '300000')
      };
      
      this._fileWorkflowIntegration = new FileWorkflowIntegration(
        config,
        this.fileManager,
        this.fileProcessor,
        this.executionService,
        this.workflowService
      );
    }
    return this._fileWorkflowIntegration;
  }

  // Initialize all services
  initialize(): void {
    console.log('Initializing services...');
    
    // Access all services to ensure they're created
    this.workflowService;
    this.agentService;
    this.executionService;
    this.systemService;
    this.fileManager;
    this.fileProcessor;
    this.fileWorkflowIntegration;
    
    console.log('✅ All services initialized');
  }
}

export const serviceRegistry = ServiceRegistry.getInstance();