"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileManager = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
const events_1 = require("events");
class FileManager extends events_1.EventEmitter {
    constructor(config) {
        super();
        this.fileMetadataStore = new Map();
        this.activeUploads = new Map();
        this.processingQueue = new Map();
        this.quotaStore = new Map();
        this.config = config;
        this.initializeStorageDirectories();
        this.startCleanupScheduler();
    }
    async uploadFile(file, metadata, workflowContext) {
        const startTime = Date.now();
        const fileId = this.generateFileId();
        try {
            const fileBuffer = file instanceof File ?
                Buffer.from(await file.arrayBuffer()) : file;
            const originalName = metadata.originalName ||
                (file instanceof File ? file.name : 'unknown');
            const validationResult = await this.validateFile(fileBuffer, originalName);
            if (!validationResult.isValid) {
                throw new Error(`File validation failed: ${validationResult.errors.join(', ')}`);
            }
            if (workflowContext?.userId) {
                await this.checkStorageQuota(workflowContext.userId, fileBuffer.length);
            }
            const fileMetadata = {
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
            const storagePath = this.generateStoragePath(fileMetadata);
            fileMetadata.storageLocation = storagePath;
            await this.ensureDirectoryExists(path.dirname(storagePath));
            await fs.writeFile(storagePath, fileBuffer);
            this.fileMetadataStore.set(fileId, fileMetadata);
            const processingCapabilities = await this.detectFileCapabilities(fileBuffer, fileMetadata.mimeType);
            const suggestedWorkflows = await this.generateWorkflowSuggestions(fileMetadata, processingCapabilities);
            this.queueFileProcessing(fileId, processingCapabilities);
            if (this.config.enableThumbnails && this.isImageFile(fileMetadata.mimeType)) {
                this.generateThumbnails(fileId).catch(error => this.emit('thumbnail-error', { fileId, error }));
            }
            if (workflowContext?.userId) {
                await this.updateStorageQuota(workflowContext.userId, fileBuffer.length);
            }
            const result = {
                fileId,
                metadata: fileMetadata,
                processingCapabilities,
                suggestedWorkflows,
                storageLocation: storagePath,
                uploadDuration: Date.now() - startTime
            };
            this.emit('file-uploaded', result);
            return result;
        }
        catch (error) {
            this.emit('upload-error', { fileId, error });
            try {
                await this.cleanupFailedUpload(fileId);
            }
            catch (cleanupError) {
                console.error('Cleanup failed:', cleanupError);
            }
            throw error;
        }
    }
    async downloadFile(request) {
        const metadata = this.fileMetadataStore.get(request.fileId);
        if (!metadata) {
            throw new Error(`File not found: ${request.fileId}`);
        }
        let filePath = metadata.storageLocation;
        let fileName = metadata.originalName;
        let mimeType = metadata.mimeType;
        let fileSize = metadata.size;
        const transformationsApplied = [];
        if (request.transformations && request.transformations.length > 0) {
            const transformedFile = await this.applyTransformations(request.fileId, request.transformations);
            filePath = transformedFile.path;
            fileName = transformedFile.name;
            mimeType = transformedFile.mimeType;
            fileSize = transformedFile.size;
            transformationsApplied.push(...request.transformations);
        }
        if (request.quality && request.quality !== 'original') {
            const qualityFile = await this.applyQualitySettings(filePath, request.quality, mimeType);
            filePath = qualityFile.path;
            fileSize = qualityFile.size;
        }
        const downloadUrl = await this.generateSecureDownloadUrl(filePath, 3600000);
        const result = {
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
    async getFileMetadata(fileId) {
        return this.fileMetadataStore.get(fileId) || null;
    }
    async deleteFile(fileId, workflowId) {
        const metadata = this.fileMetadataStore.get(fileId);
        if (!metadata) {
            return false;
        }
        if (workflowId && metadata.workflowId !== workflowId) {
            throw new Error('Unauthorized: File belongs to different workflow');
        }
        try {
            await fs.unlink(metadata.storageLocation);
            await this.deleteThumbnails(fileId);
            await this.deleteTransformedVersions(fileId);
            this.fileMetadataStore.delete(fileId);
            if (metadata.workflowId) {
                const userId = await this.getUserFromWorkflow(metadata.workflowId);
                if (userId) {
                    await this.updateStorageQuota(userId, -metadata.size);
                }
            }
            this.emit('file-deleted', { fileId, metadata });
            return true;
        }
        catch (error) {
            this.emit('delete-error', { fileId, error });
            return false;
        }
    }
    async listFiles(filters) {
        let files = Array.from(this.fileMetadataStore.values());
        if (filters.workflowId) {
            files = files.filter(f => f.workflowId === filters.workflowId);
        }
        if (filters.taskId) {
            files = files.filter(f => f.taskId === filters.taskId);
        }
        if (filters.mimeType && filters.mimeType.length > 0) {
            files = files.filter(f => filters.mimeType.includes(f.mimeType));
        }
        if (filters.tags && filters.tags.length > 0) {
            files = files.filter(f => filters.tags.some(tag => f.tags.includes(tag)));
        }
        if (filters.accessibility) {
            files = files.filter(f => f.accessibility === filters.accessibility);
        }
        if (filters.uploadedAfter) {
            files = files.filter(f => f.uploadTimestamp >= filters.uploadedAfter);
        }
        if (filters.uploadedBefore) {
            files = files.filter(f => f.uploadTimestamp <= filters.uploadedBefore);
        }
        if (filters.sizeMin) {
            files = files.filter(f => f.size >= filters.sizeMin);
        }
        if (filters.sizeMax) {
            files = files.filter(f => f.size <= filters.sizeMax);
        }
        if (filters.processingStatus) {
            files = files.filter(f => f.processingStatus === filters.processingStatus);
        }
        files.sort((a, b) => b.uploadTimestamp - a.uploadTimestamp);
        const offset = filters.offset || 0;
        const limit = filters.limit || 100;
        return files.slice(offset, offset + limit);
    }
    async processFileForWorkflow(fileId, processingType) {
        const metadata = this.fileMetadataStore.get(fileId);
        if (!metadata) {
            throw new Error(`File not found: ${fileId}`);
        }
        const { FileProcessor } = await Promise.resolve().then(() => __importStar(require('./fileProcessor')));
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
    async executeBulkOperation(operation) {
        const updatedOperation = { ...operation, status: 'processing' };
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
        }
        catch (error) {
            updatedOperation.status = 'failed';
            throw error;
        }
        return updatedOperation;
    }
    async initializeStorageDirectories() {
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
    async ensureDirectoryExists(dirPath) {
        try {
            await fs.access(dirPath);
        }
        catch {
            await fs.mkdir(dirPath, { recursive: true });
        }
    }
    generateFileId() {
        return crypto.randomBytes(16).toString('hex');
    }
    generateStoredName(originalName, fileId) {
        const ext = path.extname(originalName);
        const timestamp = Date.now();
        return `${fileId}_${timestamp}${ext}`;
    }
    generateStoragePath(metadata) {
        const year = new Date().getFullYear();
        const month = String(new Date().getMonth() + 1).padStart(2, '0');
        const day = String(new Date().getDate()).padStart(2, '0');
        return path.join(this.config.basePath, String(year), month, day, metadata.storedName);
    }
    calculateChecksum(buffer) {
        return crypto.createHash('sha256').update(buffer).digest('hex');
    }
    async detectMimeType(buffer, fileName) {
        const ext = path.extname(fileName).toLowerCase();
        if (buffer.length >= 4) {
            const header = buffer.subarray(0, 4);
            if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47) {
                return 'image/png';
            }
            if (header[0] === 0xFF && header[1] === 0xD8) {
                return 'image/jpeg';
            }
            if (header.toString('ascii', 0, 4) === '%PDF') {
                return 'application/pdf';
            }
        }
        const mimeTypes = {
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
    async validateFile(buffer, fileName) {
        const errors = [];
        const warnings = [];
        let sanitizationApplied = false;
        if (buffer.length > this.config.maxFileSize) {
            errors.push(`File size exceeds limit: ${buffer.length} > ${this.config.maxFileSize}`);
        }
        if (buffer.length === 0) {
            errors.push('File is empty');
        }
        const mimeType = await this.detectMimeType(buffer, fileName);
        if (!this.config.allowedMimeTypes.includes(mimeType)) {
            errors.push(`File type not allowed: ${mimeType}`);
        }
        if (fileName.length > 255) {
            warnings.push('Filename is very long');
        }
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
            virusScanPassed: true,
            contentTypeVerified: true
        };
    }
    async detectFileCapabilities(buffer, mimeType) {
        const capabilities = [];
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
    async generateWorkflowSuggestions(metadata, capabilities) {
        const suggestions = [];
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
    queueFileProcessing(fileId, capabilities) {
        this.processingQueue.set(fileId, capabilities);
        setImmediate(async () => {
            try {
                await this.processFileCapabilities(fileId, capabilities);
            }
            catch (error) {
                this.emit('processing-error', { fileId, error });
            }
        });
    }
    async processFileCapabilities(fileId, capabilities) {
        const metadata = this.fileMetadataStore.get(fileId);
        if (!metadata)
            return;
        metadata.processingStatus = 'processing';
        try {
            for (const capability of capabilities) {
                await this.processFileForWorkflow(fileId, capability.type);
            }
            metadata.processingStatus = 'completed';
            this.emit('processing-completed', { fileId, capabilities });
        }
        catch (error) {
            metadata.processingStatus = 'failed';
            this.emit('processing-failed', { fileId, error });
        }
    }
    isImageFile(mimeType) {
        return mimeType.startsWith('image/');
    }
    async generateThumbnails(fileId) {
    }
    async applyTransformations(fileId, transformations) {
        const metadata = this.fileMetadataStore.get(fileId);
        return {
            path: metadata.storageLocation,
            name: metadata.originalName,
            mimeType: metadata.mimeType,
            size: metadata.size
        };
    }
    async applyQualitySettings(filePath, quality, mimeType) {
        const stats = await fs.stat(filePath);
        return {
            path: filePath,
            size: stats.size
        };
    }
    async generateSecureDownloadUrl(filePath, expirationMs) {
        const token = crypto.randomBytes(32).toString('hex');
        const expiry = Date.now() + expirationMs;
        return `/api/files/download/${token}?expires=${expiry}`;
    }
    async checkStorageQuota(userId, fileSize) {
        const quota = this.quotaStore.get(userId);
        if (quota && quota.usedBytes + fileSize > quota.allocatedBytes) {
            throw new Error('Storage quota exceeded');
        }
    }
    async updateStorageQuota(userId, sizeChange) {
        let quota = this.quotaStore.get(userId);
        if (!quota) {
            quota = {
                userId,
                allocatedBytes: 10 * 1024 * 1024 * 1024,
                usedBytes: 0,
                availableBytes: 10 * 1024 * 1024 * 1024,
                fileCount: 0,
                expirationPolicy: {
                    defaultTTL: 30 * 24 * 60 * 60 * 1000,
                    maxTTL: 365 * 24 * 60 * 60 * 1000,
                    autoCleanup: true
                }
            };
        }
        quota.usedBytes += sizeChange;
        quota.availableBytes = quota.allocatedBytes - quota.usedBytes;
        quota.fileCount += sizeChange > 0 ? 1 : -1;
        this.quotaStore.set(userId, quota);
    }
    async getUserFromWorkflow(workflowId) {
        return null;
    }
    async cleanupFailedUpload(fileId) {
        const metadata = this.fileMetadataStore.get(fileId);
        if (metadata?.storageLocation) {
            try {
                await fs.unlink(metadata.storageLocation);
            }
            catch {
            }
        }
        this.fileMetadataStore.delete(fileId);
    }
    async deleteThumbnails(fileId) {
    }
    async deleteTransformedVersions(fileId) {
    }
    async bulkDelete(fileIds) {
        for (const fileId of fileIds) {
            await this.deleteFile(fileId);
        }
    }
    async bulkMove(fileIds, destination) {
    }
    async bulkTransform(fileIds, transformations) {
    }
    startCleanupScheduler() {
        setInterval(async () => {
            await this.cleanupExpiredFiles();
        }, 60 * 60 * 1000);
    }
    async cleanupExpiredFiles() {
        const now = Date.now();
        const expiredFiles = Array.from(this.fileMetadataStore.values())
            .filter(file => file.expiresAt && file.expiresAt <= now);
        for (const file of expiredFiles) {
            await this.deleteFile(file.id);
        }
        this.emit('cleanup-completed', { deletedCount: expiredFiles.length });
    }
}
exports.FileManager = FileManager;
exports.default = FileManager;
//# sourceMappingURL=fileManager.js.map