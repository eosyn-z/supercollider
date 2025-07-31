/**
 * Universal File Management System
 * Handles file upload, download, processing, and lifecycle management
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { EventEmitter } from 'events';
import { 
  FileMetadata, 
  FileUploadResult, 
  FileDownloadRequest, 
  FileDownloadResult,
  FileTransformation,
  ProcessingCapability,
  FileFilter,
  FileValidationResult,
  WorkflowContext,
  StorageConfig,
  BulkFileOperation,
  StorageQuota
} from '../../shared/types/fileManagement';

export interface FileManagerConfig extends StorageConfig {
  tempDirectory: string;
  maxConcurrentUploads: number;
  enableCompression: boolean;
  compressionLevel: number;
  enableThumbnails: boolean;
  thumbnailSizes: { width: number; height: number }[];
}

export class FileManager extends EventEmitter {
  private config: FileManagerConfig;
  private fileMetadataStore: Map<string, FileMetadata> = new Map();
  private activeUploads: Map<string, Promise<FileUploadResult>> = new Map();
  private processingQueue: Map<string, ProcessingCapability[]> = new Map();
  private quotaStore: Map<string, StorageQuota> = new Map();

  constructor(config: FileManagerConfig) {
    super();
    this.config = config;
    this.initializeStorageDirectories();
    this.startCleanupScheduler();
  }

  /**
   * Upload a file with comprehensive processing and validation
   */
  async uploadFile(
    file: Buffer | File,
    metadata: Partial<FileMetadata>,
    workflowContext?: WorkflowContext
  ): Promise<FileUploadResult> {
    const startTime = Date.now();
    const fileId = this.generateFileId();
    
    try {
      // Convert File to Buffer if needed
      const fileBuffer = file instanceof File ? 
        Buffer.from(await file.arrayBuffer()) : file;
      
      const originalName = metadata.originalName || 
        (file instanceof File ? file.name : 'unknown');

      // Validate file
      const validationResult = await this.validateFile(fileBuffer, originalName);
      if (!validationResult.isValid) {
        throw new Error(`File validation failed: ${validationResult.errors.join(', ')}`);
      }

      // Check quota if user context provided
      if (workflowContext?.userId) {
        await this.checkStorageQuota(workflowContext.userId, fileBuffer.length);
      }

      // Generate file metadata
      const fileMetadata: FileMetadata = {
        id: fileId,
        originalName,
        storedName: this.generateStoredName(originalName, fileId),
        mimeType: await this.detectMimeType(fileBuffer, originalName),
        size: fileBuffer.length,
        uploadTimestamp: Date.now(),
        workflowId: workflowContext?.workflowId,
        tags: metadata.tags || [],
        accessibility: metadata.accessibility || 'private',
        expiresAt: metadata.expiresAt,
        checksum: this.calculateChecksum(fileBuffer),
        storageLocation: '',
        processingStatus: 'pending',
        metadata: metadata.metadata || {}
      };

      // Generate storage path
      const storagePath = this.generateStoragePath(fileMetadata);
      fileMetadata.storageLocation = storagePath;

      // Store file
      await this.ensureDirectoryExists(path.dirname(storagePath));
      await fs.writeFile(storagePath, fileBuffer);

      // Store metadata
      this.fileMetadataStore.set(fileId, fileMetadata);

      // Detect processing capabilities
      const processingCapabilities = await this.detectFileCapabilities(
        fileBuffer, 
        fileMetadata.mimeType
      );

      // Generate workflow suggestions
      const suggestedWorkflows = await this.generateWorkflowSuggestions(
        fileMetadata,
        processingCapabilities
      );

      // Start background processing
      this.queueFileProcessing(fileId, processingCapabilities);

      // Generate thumbnails if applicable
      if (this.config.enableThumbnails && this.isImageFile(fileMetadata.mimeType)) {
        this.generateThumbnails(fileId).catch(error => 
          this.emit('thumbnail-error', { fileId, error })
        );
      }

      // Update quota
      if (workflowContext?.userId) {
        await this.updateStorageQuota(workflowContext.userId, fileBuffer.length);
      }

      const result: FileUploadResult = {
        fileId,
        metadata: fileMetadata,
        processingCapabilities,
        suggestedWorkflows,
        storageLocation: storagePath,
        uploadDuration: Date.now() - startTime
      };

      this.emit('file-uploaded', result);
      return result;

    } catch (error) {
      this.emit('upload-error', { fileId, error });
      
      // Cleanup on error
      try {
        await this.cleanupFailedUpload(fileId);
      } catch (cleanupError) {
        console.error('Cleanup failed:', cleanupError);
      }
      
      throw error;
    }
  }

  /**
   * Download a file with optional transformations
   */
  async downloadFile(request: FileDownloadRequest): Promise<FileDownloadResult> {
    const metadata = this.fileMetadataStore.get(request.fileId);
    if (!metadata) {
      throw new Error(`File not found: ${request.fileId}`);
    }

    let filePath = metadata.storageLocation;
    let fileName = metadata.originalName;
    let mimeType = metadata.mimeType;
    let fileSize = metadata.size;
    const transformationsApplied: FileTransformation[] = [];

    // Apply transformations if requested
    if (request.transformations && request.transformations.length > 0) {
      const transformedFile = await this.applyTransformations(
        request.fileId,
        request.transformations
      );
      filePath = transformedFile.path;
      fileName = transformedFile.name;
      mimeType = transformedFile.mimeType;
      fileSize = transformedFile.size;
      transformationsApplied.push(...request.transformations);
    }

    // Apply quality settings
    if (request.quality && request.quality !== 'original') {
      const qualityFile = await this.applyQualitySettings(
        filePath,
        request.quality,
        mimeType
      );
      filePath = qualityFile.path;
      fileSize = qualityFile.size;
    }

    // Generate secure download URL
    const downloadUrl = await this.generateSecureDownloadUrl(
      filePath,
      3600000 // 1 hour expiration
    );

    const result: FileDownloadResult = {
      fileId: request.fileId,
      downloadUrl,
      fileName,
      mimeType,
      size: fileSize,
      expiresAt: Date.now() + 3600000,
      transformationsApplied
    };

    this.emit('file-downloaded', result);
    return result;
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(fileId: string): Promise<FileMetadata | null> {
    return this.fileMetadataStore.get(fileId) || null;
  }

  /**
   * Delete a file and cleanup associated resources
   */
  async deleteFile(fileId: string, workflowId?: string): Promise<boolean> {
    const metadata = this.fileMetadataStore.get(fileId);
    if (!metadata) {
      return false;
    }

    // Check authorization
    if (workflowId && metadata.workflowId !== workflowId) {
      throw new Error('Unauthorized: File belongs to different workflow');
    }

    try {
      // Delete physical file
      await fs.unlink(metadata.storageLocation);

      // Delete thumbnails
      await this.deleteThumbnails(fileId);

      // Delete transformed versions
      await this.deleteTransformedVersions(fileId);

      // Remove from metadata store
      this.fileMetadataStore.delete(fileId);

      // Update quota
      if (metadata.workflowId) {
        // Approximate user from workflow context
        const userId = await this.getUserFromWorkflow(metadata.workflowId);
        if (userId) {
          await this.updateStorageQuota(userId, -metadata.size);
        }
      }

      this.emit('file-deleted', { fileId, metadata });
      return true;

    } catch (error) {
      this.emit('delete-error', { fileId, error });
      return false;
    }
  }

  /**
   * List files with filtering
   */
  async listFiles(filters: FileFilter): Promise<FileMetadata[]> {
    let files = Array.from(this.fileMetadataStore.values());

    // Apply filters
    if (filters.workflowId) {
      files = files.filter(f => f.workflowId === filters.workflowId);
    }

    if (filters.taskId) {
      files = files.filter(f => f.taskId === filters.taskId);
    }

    if (filters.mimeType && filters.mimeType.length > 0) {
      files = files.filter(f => filters.mimeType!.includes(f.mimeType));
    }

    if (filters.tags && filters.tags.length > 0) {
      files = files.filter(f => 
        filters.tags!.some(tag => f.tags.includes(tag))
      );
    }

    if (filters.accessibility) {
      files = files.filter(f => f.accessibility === filters.accessibility);
    }

    if (filters.uploadedAfter) {
      files = files.filter(f => f.uploadTimestamp >= filters.uploadedAfter!);
    }

    if (filters.uploadedBefore) {
      files = files.filter(f => f.uploadTimestamp <= filters.uploadedBefore!);
    }

    if (filters.sizeMin) {
      files = files.filter(f => f.size >= filters.sizeMin!);
    }

    if (filters.sizeMax) {
      files = files.filter(f => f.size <= filters.sizeMax!);
    }

    if (filters.processingStatus) {
      files = files.filter(f => f.processingStatus === filters.processingStatus);
    }

    // Sort by upload timestamp (newest first)
    files.sort((a, b) => b.uploadTimestamp - a.uploadTimestamp);

    // Apply pagination
    const offset = filters.offset || 0;
    const limit = filters.limit || 100;
    
    return files.slice(offset, offset + limit);
  }

  /**
   * Process file for workflow integration
   */
  async processFileForWorkflow(
    fileId: string,
    processingType: ProcessingCapability['type']
  ): Promise<any> {
    const metadata = this.fileMetadataStore.get(fileId);
    if (!metadata) {
      throw new Error(`File not found: ${fileId}`);
    }

    // Delegate to FileProcessor
    const { FileProcessor } = await import('./fileProcessor');
    const processor = new FileProcessor(this.config);
    
    switch (processingType) {
      case 'text_extraction':
        return await processor.extractTextFromDocument(fileId);
      case 'image_analysis':
        return await processor.analyzeImage(fileId);
      case 'audio_transcription':
        return await processor.transcribeAudio(fileId);
      case 'video_analysis':
        return await processor.analyzeVideo(fileId);
      default:
        throw new Error(`Unsupported processing type: ${processingType}`);
    }
  }

  /**
   * Bulk operations support
   */
  async executeBulkOperation(operation: BulkFileOperation): Promise<BulkFileOperation> {
    const updatedOperation = { ...operation, status: 'processing' as const };
    
    try {
      switch (operation.operationType) {
        case 'delete':
          await this.bulkDelete(operation.fileIds);
          break;
        case 'move':
          await this.bulkMove(operation.fileIds, operation.parameters.destination);
          break;
        case 'transform':
          await this.bulkTransform(operation.fileIds, operation.parameters.transformations);
          break;
        default:
          throw new Error(`Unsupported bulk operation: ${operation.operationType}`);
      }
      
      updatedOperation.status = 'completed';
      updatedOperation.progress.completed = operation.fileIds.length;
      
    } catch (error) {
      updatedOperation.status = 'failed';
      throw error;
    }
    
    return updatedOperation;
  }

  // Private methods

  private async initializeStorageDirectories(): Promise<void> {
    const dirs = [
      this.config.basePath,
      this.config.tempDirectory,
      path.join(this.config.basePath, 'thumbnails'),
      path.join(this.config.basePath, 'transformed'),
      path.join(this.config.basePath, 'archives')
    ];

    for (const dir of dirs) {
      await this.ensureDirectoryExists(dir);
    }
  }

  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  private generateFileId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  private generateStoredName(originalName: string, fileId: string): string {
    const ext = path.extname(originalName);
    const timestamp = Date.now();
    return `${fileId}_${timestamp}${ext}`;
  }

  private generateStoragePath(metadata: FileMetadata): string {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const day = String(new Date().getDate()).padStart(2, '0');
    
    return path.join(
      this.config.basePath,
      String(year),
      month,
      day,
      metadata.storedName
    );
  }

  private calculateChecksum(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  private async detectMimeType(buffer: Buffer, fileName: string): Promise<string> {
    // Simple MIME type detection based on file extension and magic numbers
    const ext = path.extname(fileName).toLowerCase();
    
    // Check magic numbers for common formats
    if (buffer.length >= 4) {
      const header = buffer.subarray(0, 4);
      
      // PNG
      if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47) {
        return 'image/png';
      }
      
      // JPEG
      if (header[0] === 0xFF && header[1] === 0xD8) {
        return 'image/jpeg';
      }
      
      // PDF
      if (header.toString('ascii', 0, 4) === '%PDF') {
        return 'application/pdf';
      }
    }

    // Fallback to extension-based detection
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.mp4': 'video/mp4',
      '.avi': 'video/avi',
      '.mov': 'video/quicktime',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.pdf': 'application/pdf',
      '.txt': 'text/plain',
      '.json': 'application/json',
      '.csv': 'text/csv',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };

    return mimeTypes[ext] || 'application/octet-stream';
  }

  private async validateFile(buffer: Buffer, fileName: string): Promise<FileValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    let sanitizationApplied = false;

    // Size validation
    if (buffer.length > this.config.maxFileSize) {
      errors.push(`File size exceeds limit: ${buffer.length} > ${this.config.maxFileSize}`);
    }

    if (buffer.length === 0) {
      errors.push('File is empty');
    }

    // MIME type validation
    const mimeType = await this.detectMimeType(buffer, fileName);
    if (!this.config.allowedMimeTypes.includes(mimeType)) {
      errors.push(`File type not allowed: ${mimeType}`);
    }

    // Filename validation
    if (fileName.length > 255) {
      warnings.push('Filename is very long');
    }

    // Check for potentially dangerous file extensions
    const dangerousExts = ['.exe', '.bat', '.cmd', '.scr', '.vbs', '.js'];
    const ext = path.extname(fileName).toLowerCase();
    if (dangerousExts.includes(ext)) {
      errors.push(`Potentially dangerous file extension: ${ext}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      sanitizationApplied,
      virusScanPassed: true, // Would integrate with virus scanner
      contentTypeVerified: true
    };
  }

  private async detectFileCapabilities(
    buffer: Buffer,
    mimeType: string
  ): Promise<ProcessingCapability[]> {
    const capabilities: ProcessingCapability[] = [];

    if (mimeType.startsWith('image/')) {
      capabilities.push({
        type: 'image_analysis',
        confidence: 0.95,
        estimatedDuration: 5000,
        requiredTools: ['image-processor'],
        supportedFormats: ['jpeg', 'png', 'gif', 'webp']
      });
    }

    if (mimeType.startsWith('text/') || mimeType === 'application/pdf') {
      capabilities.push({
        type: 'text_extraction',
        confidence: 0.90,
        estimatedDuration: 3000,
        requiredTools: ['pdf-parser', 'text-processor'],
        supportedFormats: ['pdf', 'txt', 'rtf', 'docx']
      });
    }

    if (mimeType.startsWith('audio/')) {
      capabilities.push({
        type: 'audio_transcription',
        confidence: 0.85,
        estimatedDuration: 15000,
        requiredTools: ['speech-to-text'],
        supportedFormats: ['mp3', 'wav', 'flac', 'aac']
      });
    }

    if (mimeType.startsWith('video/')) {
      capabilities.push({
        type: 'video_analysis',
        confidence: 0.80,
        estimatedDuration: 30000,
        requiredTools: ['video-processor', 'frame-extractor'],
        supportedFormats: ['mp4', 'avi', 'mov', 'webm']
      });
    }

    return capabilities;
  }

  private async generateWorkflowSuggestions(
    metadata: FileMetadata,
    capabilities: ProcessingCapability[]
  ): Promise<string[]> {
    const suggestions: string[] = [];

    if (metadata.mimeType.startsWith('image/')) {
      suggestions.push('image_enhancement', 'object_detection', 'content_analysis');
    }

    if (metadata.mimeType.startsWith('video/')) {
      suggestions.push('video_editing', 'scene_detection', 'subtitle_generation');
    }

    if (metadata.mimeType.startsWith('audio/')) {
      suggestions.push('audio_enhancement', 'transcription', 'music_analysis');
    }

    if (metadata.mimeType === 'application/pdf') {
      suggestions.push('document_analysis', 'text_extraction', 'summary_generation');
    }

    return suggestions;
  }

  private queueFileProcessing(fileId: string, capabilities: ProcessingCapability[]): void {
    this.processingQueue.set(fileId, capabilities);
    
    // Start processing in background
    setImmediate(async () => {
      try {
        await this.processFileCapabilities(fileId, capabilities);
      } catch (error) {
        this.emit('processing-error', { fileId, error });
      }
    });
  }

  private async processFileCapabilities(
    fileId: string,
    capabilities: ProcessingCapability[]
  ): Promise<void> {
    const metadata = this.fileMetadataStore.get(fileId);
    if (!metadata) return;

    metadata.processingStatus = 'processing';

    try {
      for (const capability of capabilities) {
        await this.processFileForWorkflow(fileId, capability.type);
      }
      
      metadata.processingStatus = 'completed';
      this.emit('processing-completed', { fileId, capabilities });
      
    } catch (error) {
      metadata.processingStatus = 'failed';
      this.emit('processing-failed', { fileId, error });
    }
  }

  private isImageFile(mimeType: string): boolean {
    return mimeType.startsWith('image/');
  }

  private async generateThumbnails(fileId: string): Promise<void> {
    // Implementation would generate thumbnails for images
    // This is a placeholder for the actual thumbnail generation logic
  }

  private async applyTransformations(
    fileId: string,
    transformations: FileTransformation[]
  ): Promise<{ path: string; name: string; mimeType: string; size: number }> {
    // Implementation would apply file transformations
    // This is a placeholder for the actual transformation logic
    const metadata = this.fileMetadataStore.get(fileId)!;
    return {
      path: metadata.storageLocation,
      name: metadata.originalName,
      mimeType: metadata.mimeType,
      size: metadata.size
    };
  }

  private async applyQualitySettings(
    filePath: string,
    quality: string,
    mimeType: string
  ): Promise<{ path: string; size: number }> {
    // Implementation would apply quality settings
    // This is a placeholder
    const stats = await fs.stat(filePath);
    return {
      path: filePath,
      size: stats.size
    };
  }

  private async generateSecureDownloadUrl(filePath: string, expirationMs: number): Promise<string> {
    // Implementation would generate secure, time-limited download URLs
    // This is a placeholder - in production would use signed URLs or tokens
    const token = crypto.randomBytes(32).toString('hex');
    const expiry = Date.now() + expirationMs;
    return `/api/files/download/${token}?expires=${expiry}`;
  }

  private async checkStorageQuota(userId: string, fileSize: number): Promise<void> {
    const quota = this.quotaStore.get(userId);
    if (quota && quota.usedBytes + fileSize > quota.allocatedBytes) {
      throw new Error('Storage quota exceeded');
    }
  }

  private async updateStorageQuota(userId: string, sizeChange: number): Promise<void> {
    let quota = this.quotaStore.get(userId);
    if (!quota) {
      quota = {
        userId,
        allocatedBytes: 10 * 1024 * 1024 * 1024, // 10GB default
        usedBytes: 0,
        availableBytes: 10 * 1024 * 1024 * 1024,
        fileCount: 0,
        expirationPolicy: {
          defaultTTL: 30 * 24 * 60 * 60 * 1000, // 30 days
          maxTTL: 365 * 24 * 60 * 60 * 1000, // 1 year
          autoCleanup: true
        }
      };
    }

    quota.usedBytes += sizeChange;
    quota.availableBytes = quota.allocatedBytes - quota.usedBytes;
    quota.fileCount += sizeChange > 0 ? 1 : -1;

    this.quotaStore.set(userId, quota);
  }

  private async getUserFromWorkflow(workflowId: string): Promise<string | null> {
    // Implementation would look up user from workflow
    return null;
  }

  private async cleanupFailedUpload(fileId: string): Promise<void> {
    const metadata = this.fileMetadataStore.get(fileId);
    if (metadata?.storageLocation) {
      try {
        await fs.unlink(metadata.storageLocation);
      } catch {
        // Ignore cleanup errors
      }
    }
    this.fileMetadataStore.delete(fileId);
  }

  private async deleteThumbnails(fileId: string): Promise<void> {
    // Implementation would delete thumbnail files
  }

  private async deleteTransformedVersions(fileId: string): Promise<void> {
    // Implementation would delete transformed file versions
  }

  private async bulkDelete(fileIds: string[]): Promise<void> {
    for (const fileId of fileIds) {
      await this.deleteFile(fileId);
    }
  }

  private async bulkMove(fileIds: string[], destination: string): Promise<void> {
    // Implementation would move files to new location
  }

  private async bulkTransform(fileIds: string[], transformations: FileTransformation[]): Promise<void> {
    // Implementation would apply transformations to multiple files
  }

  private startCleanupScheduler(): void {
    // Run cleanup every hour
    setInterval(async () => {
      await this.cleanupExpiredFiles();
    }, 60 * 60 * 1000);
  }

  private async cleanupExpiredFiles(): Promise<void> {
    const now = Date.now();
    const expiredFiles = Array.from(this.fileMetadataStore.values())
      .filter(file => file.expiresAt && file.expiresAt <= now);

    for (const file of expiredFiles) {
      await this.deleteFile(file.id);
    }

    this.emit('cleanup-completed', { deletedCount: expiredFiles.length });
  }
}

export default FileManager;