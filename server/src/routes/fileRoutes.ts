import { Router } from 'express';
import multer from 'multer';
import { fileController } from '../controllers/fileController';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  dest: './uploads/',
  limits: {
    fileSize: 1024 * 1024 * 100, // 100MB limit
    files: 10 // Max 10 files per request
  },
  fileFilter: (req, file, cb) => {
    // Allow all file types for now - validation happens in controller
    cb(null, true);
  }
});

// ===== FILE UPLOAD & MANAGEMENT ROUTES =====

// File Upload
router.post('/upload', upload.array('files', 10), fileController.uploadFiles.bind(fileController));
router.post('/upload/single', upload.single('file'), fileController.uploadSingleFile.bind(fileController));
router.post('/upload/chunked', fileController.uploadChunkedFile.bind(fileController));

// File Information & Metadata
router.get('/files', fileController.listFiles.bind(fileController));
router.get('/files/:fileId', fileController.getFileMetadata.bind(fileController));
router.get('/files/:fileId/info', fileController.getFileInfo.bind(fileController));
router.put('/files/:fileId/metadata', fileController.updateFileMetadata.bind(fileController));
router.delete('/files/:fileId', fileController.deleteFile.bind(fileController));

// File Processing & Analysis
router.post('/files/:fileId/analyze', fileController.analyzeFile.bind(fileController));
router.get('/files/:fileId/capabilities', fileController.getFileCapabilities.bind(fileController));
router.post('/files/:fileId/process', fileController.processFile.bind(fileController));
router.get('/files/:fileId/processing-status', fileController.getProcessingStatus.bind(fileController));

// File Transformations
router.post('/files/:fileId/transform', fileController.transformFile.bind(fileController));
router.post('/files/:fileId/thumbnail', fileController.generateThumbnail.bind(fileController));
router.post('/files/:fileId/convert', fileController.convertFile.bind(fileController));
router.get('/files/:fileId/thumbnails', fileController.getThumbnails.bind(fileController));

// File Download & Export
router.get('/files/:fileId/download', fileController.downloadFile.bind(fileController));
router.post('/files/download/prepare', fileController.prepareDownload.bind(fileController));
router.get('/files/download/:downloadId', fileController.getDownload.bind(fileController));
router.get('/secure-download/:token', fileController.secureDownload.bind(fileController));
router.get('/archive-download/:token', fileController.downloadArchive.bind(fileController));

// Bulk Operations
router.post('/files/bulk/upload', upload.array('files', 50), fileController.bulkUpload.bind(fileController));
router.post('/files/bulk/download', fileController.bulkDownload.bind(fileController));
router.post('/files/bulk/delete', fileController.bulkDelete.bind(fileController));
router.post('/files/bulk/transform', fileController.bulkTransform.bind(fileController));
router.get('/files/bulk/operations/:operationId', fileController.getBulkOperationStatus.bind(fileController));

// Archive Operations
router.post('/files/archive/create', fileController.createArchive.bind(fileController));
router.get('/files/archive/:archiveId', fileController.getArchiveInfo.bind(fileController));
router.get('/files/archive/:archiveId/download', fileController.downloadArchive.bind(fileController));

// ===== WORKFLOW MANAGEMENT ROUTES =====

// Workflow CRUD
router.get('/workflows', fileController.listWorkflows.bind(fileController));
router.get('/workflows/:workflowId', fileController.getWorkflow.bind(fileController));
router.post('/workflows', fileController.saveWorkflow.bind(fileController));
router.put('/workflows/:workflowId', fileController.updateWorkflow.bind(fileController));
router.delete('/workflows/:workflowId', fileController.deleteWorkflow.bind(fileController));
router.post('/workflows/:workflowId/backup', fileController.backupWorkflow.bind(fileController));
router.post('/backups/cleanup', fileController.cleanupBackups.bind(fileController));

// Atomic Workflow Decomposition
router.post('/workflows/decompose', fileController.decomposeWorkflow.bind(fileController));
router.post('/workflows/:workflowId/decompose', fileController.decomposeWorkflow.bind(fileController));
router.get('/workflows/:workflowId/decomposition', fileController.getAtomicDecomposition.bind(fileController));
router.post('/workflows/create-and-decompose', fileController.createAndDecomposeWorkflow.bind(fileController));
router.post('/workflows/generate-runtime', fileController.generateRuntimeWorkflow.bind(fileController));

// Workflow Execution
router.post('/workflows/:workflowId/execute', fileController.executeWorkflow.bind(fileController));
router.get('/workflows/:workflowId/execution/:executionId', fileController.getExecutionStatus.bind(fileController));
router.post('/workflows/:workflowId/execution/:executionId/cancel', fileController.cancelExecution.bind(fileController));
router.get('/workflows/:workflowId/executions', fileController.listExecutions.bind(fileController));

// Workflow Suggestions
router.post('/workflows/suggest', fileController.suggestWorkflows.bind(fileController));
router.post('/files/:fileId/workflow-suggestions', fileController.getFileWorkflowSuggestions.bind(fileController));

// ===== ATOMIC TASK ROUTES =====

// Task Library
router.get('/tasks', fileController.listAvailableTasks.bind(fileController));
router.get('/tasks/:taskId', fileController.getTaskTemplate.bind(fileController));
router.post('/tasks/search', fileController.searchTasks.bind(fileController));
router.post('/tasks/custom', fileController.createCustomTask.bind(fileController));
router.get('/tasks/categories', fileController.getTaskCategories.bind(fileController));

// Task Validation & Compatibility
router.post('/tasks/validate', fileController.validateTask.bind(fileController));
router.post('/tasks/compatibility', fileController.checkTaskCompatibility.bind(fileController));

// ===== RESOURCE MANAGEMENT ROUTES =====

// Runtime Resources
router.get('/resources', fileController.listResources.bind(fileController));
router.post('/resources/register', fileController.registerResource.bind(fileController));
router.put('/resources/:resourceId/availability', fileController.updateResourceAvailability.bind(fileController));
router.get('/resources/:resourceId/metrics', fileController.getResourceMetrics.bind(fileController));

// ===== SYSTEM & UTILITIES =====

// File System Utilities
router.get('/files/:filepath/stats', fileController.getFileStats.bind(fileController));
router.get('/system/storage', fileController.getStorageInfo.bind(fileController));
router.get('/system/quota/:userId', fileController.getUserQuota.bind(fileController));
router.post('/system/cleanup', fileController.runSystemCleanup.bind(fileController));

// Health & Metrics
router.get('/health', fileController.getSystemHealth.bind(fileController));
router.get('/metrics', fileController.getSystemMetrics.bind(fileController));
router.get('/metrics/downloads', fileController.getDownloadMetrics.bind(fileController));
router.get('/metrics/processing', fileController.getProcessingMetrics.bind(fileController));

// Configuration
router.get('/config', fileController.getConfiguration.bind(fileController));
router.put('/config', fileController.updateConfiguration.bind(fileController));

export default router; 