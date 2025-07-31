import { EventEmitter } from 'events';
import { FileMetadata, FileUploadResult, FileDownloadRequest, FileDownloadResult, ProcessingCapability, FileFilter, WorkflowContext, StorageConfig, BulkFileOperation } from '../../shared/types/fileManagement';
export interface FileManagerConfig extends StorageConfig {
    tempDirectory: string;
    maxConcurrentUploads: number;
    enableCompression: boolean;
    compressionLevel: number;
    enableThumbnails: boolean;
    thumbnailSizes: {
        width: number;
        height: number;
    }[];
}
export declare class FileManager extends EventEmitter {
    private config;
    private fileMetadataStore;
    private activeUploads;
    private processingQueue;
    private quotaStore;
    constructor(config: FileManagerConfig);
    uploadFile(file: Buffer | File, metadata: Partial<FileMetadata>, workflowContext?: WorkflowContext): Promise<FileUploadResult>;
    downloadFile(request: FileDownloadRequest): Promise<FileDownloadResult>;
    getFileMetadata(fileId: string): Promise<FileMetadata | null>;
    deleteFile(fileId: string, workflowId?: string): Promise<boolean>;
    listFiles(filters: FileFilter): Promise<FileMetadata[]>;
    processFileForWorkflow(fileId: string, processingType: ProcessingCapability['type']): Promise<any>;
    executeBulkOperation(operation: BulkFileOperation): Promise<BulkFileOperation>;
    private initializeStorageDirectories;
    private ensureDirectoryExists;
    private generateFileId;
    private generateStoredName;
    private generateStoragePath;
    private calculateChecksum;
    private detectMimeType;
    private validateFile;
    private detectFileCapabilities;
    private generateWorkflowSuggestions;
    private queueFileProcessing;
    private processFileCapabilities;
    private isImageFile;
    private generateThumbnails;
    private applyTransformations;
    private applyQualitySettings;
    private generateSecureDownloadUrl;
    private checkStorageQuota;
    private updateStorageQuota;
    private getUserFromWorkflow;
    private cleanupFailedUpload;
    private deleteThumbnails;
    private deleteTransformedVersions;
    private bulkDelete;
    private bulkMove;
    private bulkTransform;
    private startCleanupScheduler;
    private cleanupExpiredFiles;
}
export default FileManager;
//# sourceMappingURL=fileManager.d.ts.map