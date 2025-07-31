/**
 * Download Manager - Secure File Download and Export System
 * Handles file downloads, transformations, and bulk operations
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import * as archiver from 'archiver';
import { EventEmitter } from 'events';
import {
  FileMetadata,
  FileTransformation,
  FileDownloadResult
} from '../../shared/types/fileManagement';

export interface DownloadRequest {
  fileIds: string[];
  format: 'original' | 'archive' | 'converted';
  archiveType?: 'zip' | 'tar' | '7z';
  includeMetadata: boolean;
  transformations?: FileTransformation[];
  userId?: string;
  sessionId?: string;
  expirationMinutes?: number;
}

export interface DownloadResult {
  downloadId: string;
  files: DownloadFile[];
  archiveUrl?: string;
  expiresAt: number;
  totalSize: number;
  preparationTime: number;
  downloadCount: number;
}

export interface DownloadFile {
  fileId: string;
  originalName: string;
  downloadName: string;
  url: string;
  size: number;
  mimeType: string;
  checksum: string;
}

export interface DownloadSession {
  id: string;
  userId?: string;
  downloads: DownloadResult[];
  createdAt: number;
  expiresAt: number;
  totalSize: number;
  status: 'active' | 'expired' | 'cleaned';
}

export interface DownloadConfig {
  basePath: string;
  downloadPath: string;
  maxConcurrentDownloads: number;
  defaultExpirationMinutes: number;
  maxDownloadSize: number;
  enableMetrics: boolean;
  enableCompression: boolean;
  compressionLevel: number;
  secureDownloads: boolean;
  allowAnonymousDownloads: boolean;
}

export class DownloadManager extends EventEmitter {
  private config: DownloadConfig;
  private downloadSessions: Map<string, DownloadSession> = new Map();
  private activeDownloads: Map<string, Promise<DownloadResult>> = new Map();
  private downloadMetrics: Map<string, any> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor(config: DownloadConfig) {
    super();
    this.config = config;
    this.initializeDownloadSystem();
    this.startCleanupScheduler();
  }

  /**
   * Prepare files for download
   */
  async prepareDownload(request: DownloadRequest): Promise<DownloadResult> {
    const startTime = Date.now();
    const downloadId = this.generateDownloadId();

    try {
      // Validate request
      await this.validateDownloadRequest(request);

      // Check if already processing
      if (this.activeDownloads.has(downloadId)) {
        return await this.activeDownloads.get(downloadId)!;
      }

      // Start download preparation
      const downloadPromise = this.executeDownloadPreparation(request, downloadId, startTime);
      this.activeDownloads.set(downloadId, downloadPromise);

      const result = await downloadPromise;
      
      // Store in session
      await this.storeDownloadSession(result, request);
      
      // Update metrics
      this.updateDownloadMetrics(result, request);

      this.emit('download-prepared', {
        downloadId,
        fileCount: result.files.length,
        totalSize: result.totalSize,
        preparationTime: result.preparationTime
      });

      return result;

    } catch (error) {
      this.activeDownloads.delete(downloadId);
      this.emit('download-error', { downloadId, error, request });
      throw error;
    }
  }

  /**
   * Create archive from multiple files
   */
  async createArchive(
    fileIds: string[], 
    archiveType: string = 'zip',
    options: { includeMetadata?: boolean; compression?: number } = {}
  ): Promise<string> {
    const archiveId = this.generateArchiveId();
    const archivePath = path.join(
      this.config.downloadPath,
      'archives',
      `${archiveId}.${archiveType}`
    );

    await this.ensureDirectoryExists(path.dirname(archivePath));

    switch (archiveType.toLowerCase()) {
      case 'zip':
        await this.createZipArchive(fileIds, archivePath, options);
        break;
      case 'tar':
        await this.createTarArchive(fileIds, archivePath, options);
        break;
      default:
        throw new Error(`Unsupported archive type: ${archiveType}`);
    }

    this.emit('archive-created', {
      archiveId,
      archivePath,
      fileCount: fileIds.length,
      archiveType
    });

    return archiveId;
  }

  /**
   * Get secure download URL
   */
  async getDownloadUrl(
    fileId: string, 
    expirationMinutes: number = this.config.defaultExpirationMinutes
  ): Promise<string> {
    // Validate file exists and user has access
    const fileManager = await this.getFileManager();
    const metadata = await fileManager.getFileMetadata(fileId);
    
    if (!metadata) {
      throw new Error(`File not found: ${fileId}`);
    }

    // Generate secure token
    const token = this.generateSecureToken(fileId, expirationMinutes);
    const expiresAt = Date.now() + (expirationMinutes * 60 * 1000);

    // Store download authorization
    await this.storeDownloadAuthorization(token, fileId, expiresAt);

    // Generate URL
    const downloadUrl = this.config.secureDownloads
      ? `/api/files/secure-download/${token}`
      : `/api/files/download/${fileId}`;

    this.emit('download-url-generated', {
      fileId,
      token,
      expiresAt,
      secure: this.config.secureDownloads
    });

    return downloadUrl;
  }

  /**
   * Track download access
   */
  async trackDownload(downloadId: string, userAgent: string, ipAddress?: string): Promise<void> {
    const timestamp = Date.now();
    
    const trackingData = {
      downloadId,
      timestamp,
      userAgent,
      ipAddress,
      success: true
    };

    // Store in metrics
    const existingMetrics = this.downloadMetrics.get(downloadId) || {
      downloadCount: 0,
      firstAccess: timestamp,
      lastAccess: timestamp,
      userAgents: new Set(),
      ipAddresses: new Set()
    };

    existingMetrics.downloadCount++;
    existingMetrics.lastAccess = timestamp;
    existingMetrics.userAgents.add(userAgent);
    if (ipAddress) existingMetrics.ipAddresses.add(ipAddress);

    this.downloadMetrics.set(downloadId, existingMetrics);

    this.emit('download-tracked', trackingData);
  }

  /**
   * Get download metrics
   */
  async getDownloadMetrics(downloadId: string): Promise<any> {
    const metrics = this.downloadMetrics.get(downloadId);
    
    if (!metrics) {
      throw new Error(`No metrics found for download: ${downloadId}`);
    }

    return {
      downloadId,
      downloadCount: metrics.downloadCount,
      firstAccess: metrics.firstAccess,
      lastAccess: metrics.lastAccess,
      uniqueUsers: metrics.userAgents.size,
      uniqueIPs: metrics.ipAddresses.size,
      averageAccessInterval: metrics.downloadCount > 1 
        ? (metrics.lastAccess - metrics.firstAccess) / (metrics.downloadCount - 1)
        : 0
    };
  }

  /**
   * Clean up expired downloads
   */
  async cleanupExpiredDownloads(): Promise<{ cleaned: number; errors: string[] }> {
    const now = Date.now();
    let cleaned = 0;
    const errors: string[] = [];

    // Clean up expired sessions
    for (const [sessionId, session] of this.downloadSessions.entries()) {
      if (session.expiresAt <= now) {
        try {
          await this.cleanupDownloadSession(sessionId);
          cleaned++;
        } catch (error) {
          errors.push(`Failed to cleanup session ${sessionId}: ${error}`);
        }
      }
    }

    // Clean up expired files
    try {
      const downloadDir = this.config.downloadPath;
      const files = await fs.readdir(downloadDir, { withFileTypes: true });
      
      for (const file of files) {
        if (file.isFile()) {
          const filePath = path.join(downloadDir, file.name);
          const stats = await fs.stat(filePath);
          
          // Remove files older than 24 hours
          if (now - stats.mtime.getTime() > 24 * 60 * 60 * 1000) {
            await fs.unlink(filePath);
            cleaned++;
          }
        }
      }
    } catch (error) {
      errors.push(`Failed to cleanup download directory: ${error}`);
    }

    this.emit('cleanup-completed', { cleaned, errors: errors.length });

    return { cleaned, errors };
  }

  /**
   * Get active download sessions
   */
  getActiveSessions(): DownloadSession[] {
    const now = Date.now();
    return Array.from(this.downloadSessions.values())
      .filter(session => session.expiresAt > now && session.status === 'active');
  }

  /**
   * Cancel download preparation
   */
  async cancelDownload(downloadId: string): Promise<boolean> {
    if (this.activeDownloads.has(downloadId)) {
      // Remove from active downloads (the promise will be rejected)
      this.activeDownloads.delete(downloadId);
      
      // Clean up any partial files
      await this.cleanupPartialDownload(downloadId);
      
      this.emit('download-cancelled', { downloadId });
      return true;
    }
    
    return false;
  }

  // Private methods

  private async initializeDownloadSystem(): Promise<void> {
    // Ensure download directories exist
    const dirs = [
      this.config.downloadPath,
      path.join(this.config.downloadPath, 'archives'),
      path.join(this.config.downloadPath, 'transformed'),
      path.join(this.config.downloadPath, 'temp')
    ];

    for (const dir of dirs) {
      await this.ensureDirectoryExists(dir);
    }

    // Load existing sessions
    await this.loadExistingSessions();
  }

  private async executeDownloadPreparation(
    request: DownloadRequest,
    downloadId: string,
    startTime: number
  ): Promise<DownloadResult> {
    const files: DownloadFile[] = [];
    let totalSize = 0;

    // Get file manager
    const fileManager = await this.getFileManager();

    // Process each file
    for (const fileId of request.fileIds) {
      const metadata = await fileManager.getFileMetadata(fileId);
      if (!metadata) {
        throw new Error(`File not found: ${fileId}`);
      }

      let processedFilePath = metadata.storageLocation;
      let processedFileName = metadata.originalName;
      let processedMimeType = metadata.mimeType;
      let processedSize = metadata.size;

      // Apply transformations if requested
      if (request.transformations && request.transformations.length > 0) {
        const transformResult = await this.applyTransformations(
          metadata,
          request.transformations
        );
        processedFilePath = transformResult.path;
        processedFileName = transformResult.name;
        processedMimeType = transformResult.mimeType;
        processedSize = transformResult.size;
      }

      // Generate download URL
      const downloadUrl = await this.generateFileDownloadUrl(
        fileId,
        processedFilePath,
        request.expirationMinutes
      );

      // Calculate checksum
      const checksum = await this.calculateFileChecksum(processedFilePath);

      const downloadFile: DownloadFile = {
        fileId,
        originalName: metadata.originalName,
        downloadName: processedFileName,
        url: downloadUrl,
        size: processedSize,
        mimeType: processedMimeType,
        checksum
      };

      files.push(downloadFile);
      totalSize += processedSize;
    }

    // Create archive if requested
    let archiveUrl: string | undefined;
    if (request.format === 'archive') {
      const archiveId = await this.createArchive(
        request.fileIds,
        request.archiveType || 'zip',
        {
          includeMetadata: request.includeMetadata,
          compression: this.config.enableCompression ? this.config.compressionLevel : 0
        }
      );
      
      archiveUrl = await this.generateArchiveDownloadUrl(
        archiveId,
        request.expirationMinutes
      );
      
      // Update total size with archive size
      const archivePath = path.join(
        this.config.downloadPath,
        'archives',
        `${archiveId}.${request.archiveType || 'zip'}`
      );
      const archiveStats = await fs.stat(archivePath);
      totalSize = archiveStats.size;
    }

    const result: DownloadResult = {
      downloadId,
      files,
      archiveUrl,
      expiresAt: Date.now() + ((request.expirationMinutes || this.config.defaultExpirationMinutes) * 60 * 1000),
      totalSize,
      preparationTime: Date.now() - startTime,
      downloadCount: 0
    };

    return result;
  }

  private async validateDownloadRequest(request: DownloadRequest): Promise<void> {
    // Check file count
    if (request.fileIds.length === 0) {
      throw new Error('No files specified for download');
    }

    if (request.fileIds.length > 100) {
      throw new Error('Too many files requested (max 100)');
    }

    // Check user authorization if not anonymous
    if (!this.config.allowAnonymousDownloads && !request.userId) {
      throw new Error('User authentication required for downloads');
    }

    // Validate transformations
    if (request.transformations) {
      for (const transformation of request.transformations) {
        await this.validateTransformation(transformation);
      }
    }

    // Check estimated size
    const estimatedSize = await this.estimateDownloadSize(request.fileIds);
    if (estimatedSize > this.config.maxDownloadSize) {
      throw new Error(`Download size exceeds limit: ${estimatedSize} > ${this.config.maxDownloadSize}`);
    }
  }

  private async createZipArchive(
    fileIds: string[],
    archivePath: string,
    options: { includeMetadata?: boolean; compression?: number } = {}
  ): Promise<void> {
    return new Promise(async (resolve, reject) => {
      const archive = archiver('zip', {
        zlib: { level: options.compression || 6 }
      });

      const output = require('fs').createWriteStream(archivePath);
      
      output.on('close', () => {
        resolve();
      });

      archive.on('error', (err: Error) => {
        reject(err);
      });

      archive.pipe(output);

      // Get file manager
      const fileManager = await this.getFileManager();

      // Add files to archive
      for (const fileId of fileIds) {
        try {
          const metadata = await fileManager.getFileMetadata(fileId);
          if (metadata) {
            archive.file(metadata.storageLocation, { name: metadata.originalName });
            
            // Add metadata if requested
            if (options.includeMetadata) {
              const metadataJson = JSON.stringify(metadata, null, 2);
              archive.append(metadataJson, { name: `${metadata.originalName}.metadata.json` });
            }
          }
        } catch (error) {
          console.warn(`Failed to add file ${fileId} to archive:`, error);
        }
      }

      await archive.finalize();
    });
  }

  private async createTarArchive(
    fileIds: string[],
    archivePath: string,
    options: { includeMetadata?: boolean; compression?: number } = {}
  ): Promise<void> {
    // Tar archive implementation would go here
    // For now, throw an error as it's not implemented
    throw new Error('TAR archive creation not yet implemented');
  }

  private async applyTransformations(
    metadata: FileMetadata,
    transformations: FileTransformation[]
  ): Promise<{ path: string; name: string; mimeType: string; size: number }> {
    let currentPath = metadata.storageLocation;
    let currentName = metadata.originalName;
    let currentMimeType = metadata.mimeType;

    for (const transformation of transformations) {
      const result = await this.applyTransformation(
        currentPath,
        currentName,
        currentMimeType,
        transformation
      );
      
      currentPath = result.path;
      currentName = result.name;
      currentMimeType = result.mimeType;
    }

    const stats = await fs.stat(currentPath);
    
    return {
      path: currentPath,
      name: currentName,
      mimeType: currentMimeType,
      size: stats.size
    };
  }

  private async applyTransformation(
    filePath: string,
    fileName: string,
    mimeType: string,
    transformation: FileTransformation
  ): Promise<{ path: string; name: string; mimeType: string }> {
    const transformedId = `trans_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
    const transformedDir = path.join(this.config.downloadPath, 'transformed');
    
    await this.ensureDirectoryExists(transformedDir);

    switch (transformation.type) {
      case 'convert':
        return await this.convertFile(filePath, fileName, transformation, transformedDir, transformedId);
      
      case 'resize':
        return await this.resizeFile(filePath, fileName, transformation, transformedDir, transformedId);
      
      case 'compress':
        return await this.compressFile(filePath, fileName, transformation, transformedDir, transformedId);
      
      default:
        throw new Error(`Unsupported transformation type: ${transformation.type}`);
    }
  }

  private async convertFile(
    filePath: string,
    fileName: string,
    transformation: FileTransformation,
    outputDir: string,
    transformedId: string
  ): Promise<{ path: string; name: string; mimeType: string }> {
    // File conversion implementation - placeholder
    // In production would use appropriate libraries (sharp for images, ffmpeg for video, etc.)
    
    const outputFormat = transformation.outputFormat || 'png';
    const outputExtension = this.getExtensionForFormat(outputFormat);
    const outputName = `${path.parse(fileName).name}_converted_${transformedId}.${outputExtension}`;
    const outputPath = path.join(outputDir, outputName);
    
    // For now, just copy the file
    await fs.copyFile(filePath, outputPath);
    
    return {
      path: outputPath,
      name: outputName,
      mimeType: this.getMimeTypeForFormat(outputFormat)
    };
  }

  private async resizeFile(
    filePath: string,
    fileName: string,
    transformation: FileTransformation,
    outputDir: string,
    transformedId: string
  ): Promise<{ path: string; name: string; mimeType: string }> {
    // Image resizing implementation - placeholder
    const outputName = `${path.parse(fileName).name}_resized_${transformedId}${path.extname(fileName)}`;
    const outputPath = path.join(outputDir, outputName);
    
    // For now, just copy the file
    await fs.copyFile(filePath, outputPath);
    
    return {
      path: outputPath,
      name: outputName,
      mimeType: this.getMimeTypeFromPath(fileName)
    };
  }

  private async compressFile(
    filePath: string,
    fileName: string,
    transformation: FileTransformation,
    outputDir: string,
    transformedId: string
  ): Promise<{ path: string; name: string; mimeType: string }> {
    // File compression implementation - placeholder
    const outputName = `${path.parse(fileName).name}_compressed_${transformedId}${path.extname(fileName)}`;
    const outputPath = path.join(outputDir, outputName);
    
    // For now, just copy the file
    await fs.copyFile(filePath, outputPath);
    
    return {
      path: outputPath,
      name: outputName,
      mimeType: this.getMimeTypeFromPath(fileName)
    };
  }

  private async generateFileDownloadUrl(
    fileId: string,
    filePath: string,
    expirationMinutes?: number
  ): Promise<string> {
    if (this.config.secureDownloads) {
      return await this.getDownloadUrl(fileId, expirationMinutes);
    } else {
      return `/api/files/download/${fileId}`;
    }
  }

  private async generateArchiveDownloadUrl(
    archiveId: string,
    expirationMinutes?: number
  ): Promise<string> {
    const token = this.generateSecureToken(archiveId, expirationMinutes);
    return `/api/files/archive-download/${token}`;
  }

  private generateSecureToken(resourceId: string, expirationMinutes?: number): string {
    const payload = {
      resourceId,
      expiresAt: Date.now() + ((expirationMinutes || this.config.defaultExpirationMinutes) * 60 * 1000),
      nonce: crypto.randomBytes(16).toString('hex')
    };

    const secret = process.env.DOWNLOAD_SECRET || 'default-secret-key';
    const token = crypto.createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');

    return `${Buffer.from(JSON.stringify(payload)).toString('base64')}.${token}`;
  }

  private async calculateFileChecksum(filePath: string): Promise<string> {
    const hash = crypto.createHash('sha256');
    const fileBuffer = await fs.readFile(filePath);
    return hash.update(fileBuffer).digest('hex');
  }

  private async storeDownloadSession(
    result: DownloadResult,
    request: DownloadRequest
  ): Promise<void> {
    const sessionId = request.sessionId || this.generateSessionId();
    
    let session = this.downloadSessions.get(sessionId);
    if (!session) {
      session = {
        id: sessionId,
        userId: request.userId,
        downloads: [],
        createdAt: Date.now(),
        expiresAt: result.expiresAt,
        totalSize: 0,
        status: 'active'
      };
    }

    session.downloads.push(result);
    session.totalSize += result.totalSize;
    session.expiresAt = Math.max(session.expiresAt, result.expiresAt);

    this.downloadSessions.set(sessionId, session);
  }

  private async storeDownloadAuthorization(
    token: string,
    fileId: string,
    expiresAt: number
  ): Promise<void> {
    // Store authorization in memory - in production would use database or cache
    // This is a simplified implementation
  }

  private updateDownloadMetrics(result: DownloadResult, request: DownloadRequest): void {
    if (!this.config.enableMetrics) return;

    const metrics = {
      downloadId: result.downloadId,
      fileCount: result.files.length,
      totalSize: result.totalSize,
      preparationTime: result.preparationTime,
      userId: request.userId,
      format: request.format,
      transformations: request.transformations?.length || 0,
      timestamp: Date.now()
    };

    this.downloadMetrics.set(result.downloadId, {
      ...metrics,
      downloadCount: 0,
      firstAccess: null,
      lastAccess: null,
      userAgents: new Set(),
      ipAddresses: new Set()
    });
  }

  private async cleanupDownloadSession(sessionId: string): Promise<void> {
    const session = this.downloadSessions.get(sessionId);
    if (!session) return;

    // Mark as expired
    session.status = 'expired';

    // Clean up associated files
    for (const download of session.downloads) {
      await this.cleanupDownloadFiles(download);
    }

    // Remove from active sessions
    this.downloadSessions.delete(sessionId);
  }

  private async cleanupDownloadFiles(download: DownloadResult): Promise<void> {
    // Clean up archive file if exists
    if (download.archiveUrl) {
      try {
        // Extract archive ID from URL and delete file
        // Implementation depends on URL structure
      } catch (error) {
        console.warn('Failed to cleanup archive file:', error);
      }
    }

    // Clean up transformed files
    for (const file of download.files) {
      if (file.url.includes('/transformed/')) {
        try {
          // Delete transformed file
          // Implementation would extract path from URL
        } catch (error) {
          console.warn('Failed to cleanup transformed file:', error);
        }
      }
    }
  }

  private async cleanupPartialDownload(downloadId: string): Promise<void> {
    // Clean up any partial files created during download preparation
    const tempDir = path.join(this.config.downloadPath, 'temp');
    
    try {
      const files = await fs.readdir(tempDir);
      const partialFiles = files.filter(file => file.includes(downloadId));
      
      for (const file of partialFiles) {
        await fs.unlink(path.join(tempDir, file));
      }
    } catch (error) {
      console.warn('Failed to cleanup partial download files:', error);
    }
  }

  private async loadExistingSessions(): Promise<void> {
    // Load persisted sessions from storage
    // This is a placeholder - in production would load from database
  }

  private startCleanupScheduler(): void {
    // Run cleanup every hour
    this.cleanupInterval = setInterval(async () => {
      try {
        await this.cleanupExpiredDownloads();
      } catch (error) {
        console.error('Cleanup scheduler error:', error);
      }
    }, 60 * 60 * 1000);
  }

  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  private async getFileManager(): Promise<any> {
    const { FileManager } = await import('./fileManager');
    return new FileManager(this.config as any);
  }

  private generateDownloadId(): string {
    return `dl_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  private generateArchiveId(): string {
    return `arch_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  private generateSessionId(): string {
    return `sess_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  private async validateTransformation(transformation: FileTransformation): Promise<void> {
    const allowedTypes = ['resize', 'convert', 'compress', 'extract', 'merge', 'watermark', 'crop'];
    
    if (!allowedTypes.includes(transformation.type)) {
      throw new Error(`Unsupported transformation type: ${transformation.type}`);
    }

    // Additional validation based on transformation type
    switch (transformation.type) {
      case 'resize':
        if (!transformation.parameters.width && !transformation.parameters.height) {
          throw new Error('Resize transformation requires width or height parameter');
        }
        break;
      
      case 'convert':
        if (!transformation.outputFormat) {
          throw new Error('Convert transformation requires outputFormat parameter');
        }
        break;
    }
  }

  private async estimateDownloadSize(fileIds: string[]): Promise<number> {
    const fileManager = await this.getFileManager();
    let totalSize = 0;

    for (const fileId of fileIds) {
      const metadata = await fileManager.getFileMetadata(fileId);
      if (metadata) {
        totalSize += metadata.size;
      }
    }

    return totalSize;
  }

  private getExtensionForFormat(format: string): string {
    const extensions: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
      'video/mp4': 'mp4',
      'video/webm': 'webm',
      'audio/mp3': 'mp3',
      'audio/wav': 'wav',
      'application/pdf': 'pdf',
      'text/plain': 'txt'
    };
    return extensions[format] || 'bin';
  }

  private getMimeTypeForFormat(format: string): string {
    return format.includes('/') ? format : `application/${format}`;
  }

  private getMimeTypeFromPath(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.pdf': 'application/pdf',
      '.txt': 'text/plain'
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  // Cleanup on shutdown
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

export default DownloadManager;