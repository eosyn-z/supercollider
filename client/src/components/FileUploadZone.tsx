/**
 * File Upload Zone Component
 * Handles drag-and-drop file uploads with processing capabilities detection
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  FileUploadResult, 
  FileWorkflowSuggestion,
  ProcessingCapability,
  FileMetadata 
} from '../../../shared/types/fileManagement';

interface FileUploadZoneProps {
  onFileUpload: (files: File[]) => Promise<FileUploadResult[]>;
  onWorkflowSuggestion: (suggestions: FileWorkflowSuggestion[]) => void;
  acceptedTypes: string[];
  maxFileSize: number;
  multiple: boolean;
  className?: string;
  disabled?: boolean;
}

interface UploadProgress {
  fileId: string;
  fileName: string;
  progress: number;
  status: 'uploading' | 'processing' | 'complete' | 'error';
  processingStage?: string;
  capabilities?: ProcessingCapability[];
  error?: string;
}

const FileUploadZone: React.FC<FileUploadZoneProps> = ({
  onFileUpload,
  onWorkflowSuggestion,
  acceptedTypes,
  maxFileSize,
  multiple = true,
  className = '',
  disabled = false
}) => {
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<FileUploadResult[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useCallback(async (files: FileList | File[]) => {
    if (disabled) return;

    const fileArray = Array.from(files);
    
    // Validate files
    const validFiles = fileArray.filter(file => {
      if (file.size > maxFileSize) {
        console.warn(`File ${file.name} exceeds size limit`);
        return false;
      }
      
      if (acceptedTypes.length > 0 && !acceptedTypes.some(type => 
        file.type.match(type.replace('*', '.*'))
      )) {
        console.warn(`File ${file.name} type not accepted`);
        return false;
      }
      
      return true;
    });

    if (validFiles.length === 0) return;

    // Initialize progress tracking
    const progressItems: UploadProgress[] = validFiles.map(file => ({
      fileId: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      fileName: file.name,
      progress: 0,
      status: 'uploading'
    }));
    
    setUploadProgress(progressItems);
    
    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => prev.map(item => {
          if (item.status === 'uploading' && item.progress < 90) {
            return { ...item, progress: Math.min(90, item.progress + Math.random() * 20) };
          }
          return item;
        }));
      }, 500);

      const results = await onFileUpload(validFiles);
      
      clearInterval(progressInterval);
      
      // Update progress with results
      setUploadProgress(prev => prev.map((item, index) => {
        const result = results[index];
        if (result) {
          return {
            ...item,
            fileId: result.fileId,
            progress: 100,
            status: 'processing',
            processingStage: 'analyzing',
            capabilities: result.processingCapabilities
          };
        }
        return { ...item, status: 'error', error: 'Upload failed' };
      }));

      // Simulate processing stages
      setTimeout(() => {
        setUploadProgress(prev => prev.map(item => ({
          ...item,
          status: 'complete',
          processingStage: 'complete'
        })));
      }, 2000);

      setUploadedFiles(results);

      // Generate workflow suggestions
      const allSuggestions = results.flatMap(result => result.suggestedWorkflows || []);
      if (allSuggestions.length > 0) {
        const suggestions: FileWorkflowSuggestion[] = allSuggestions.map(type => ({
          workflowType: type,
          confidence: 0.8,
          requiredInputs: [results[0].fileId],
          expectedOutputs: [type + '_result'],
          estimatedDuration: 60000,
          description: `Process files using ${type} workflow`,
          tags: [type, 'processing']
        }));
        
        onWorkflowSuggestion(suggestions);
      }
      
    } catch (error) {
      console.error('Upload failed:', error);
      setUploadProgress(prev => prev.map(item => ({
        ...item,
        status: 'error',
        error: error instanceof Error ? error.message : 'Upload failed'
      })));
    }
  }, [onFileUpload, onWorkflowSuggestion, acceptedTypes, maxFileSize, disabled]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    setIsDragOver(false);
    
    if (disabled) return;
    
    const files = e.dataTransfer.files;
    if (files?.length > 0) {
      handleFileUpload(files);
    }
  }, [handleFileUpload, disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }, []);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length > 0) {
      handleFileUpload(e.target.files);
    }
  }, [handleFileUpload]);

  const openFileDialog = useCallback(() => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [disabled]);

  const removeFile = useCallback((fileId: string) => {
    setUploadProgress(prev => prev.filter(item => item.fileId !== fileId));
    setUploadedFiles(prev => prev.filter(file => file.fileId !== fileId));
  }, []);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusIcon = (status: UploadProgress['status']) => {
    switch (status) {
      case 'uploading':
        return (
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
        );
      case 'processing':
        return (
          <div className="animate-pulse rounded-full h-4 w-4 bg-yellow-500"></div>
        );
      case 'complete':
        return (
          <div className="rounded-full h-4 w-4 bg-green-500 flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        );
      case 'error':
        return (
          <div className="rounded-full h-4 w-4 bg-red-500 flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`file-upload-zone ${className}`}>
      {/* Drop Zone */}
      <div
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200
          ${isDragOver 
            ? 'border-blue-500 bg-blue-50 scale-105' 
            : 'border-gray-300 hover:border-gray-400'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50'}
        `}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onClick={openFileDialog}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple={multiple}
          accept={acceptedTypes.join(',')}
          onChange={handleFileInputChange}
          className="hidden"
          disabled={disabled}
        />
        
        <div className="space-y-4">
          <div className="mx-auto w-12 h-12 text-gray-400">
            <svg fill="none" stroke="currentColor" viewBox="0 0 48 48">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
              />
            </svg>
          </div>
          
          <div>
            <p className="text-lg font-medium text-gray-900">
              {isDragOver ? 'Drop files here' : 'Upload files'}
            </p>
            <p className="text-sm text-gray-500 mt-2">
              {isDragOver 
                ? 'Release to upload' 
                : `Drag and drop files here, or click to browse`
              }
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Max size: {formatFileSize(maxFileSize)} • 
              Types: {acceptedTypes.length > 0 ? acceptedTypes.join(', ') : 'All types'}
            </p>
          </div>
        </div>

        {isDragOver && (
          <div className="absolute inset-0 bg-blue-500 bg-opacity-10 rounded-lg pointer-events-none" />
        )}
      </div>

      {/* Progress Display */}
      {uploadProgress.length > 0 && (
        <div className="mt-6 space-y-3">
          <h3 className="text-sm font-medium text-gray-900">Upload Progress</h3>
          
          {uploadProgress.map((item) => (
            <div key={item.fileId} className="bg-white rounded-lg border p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  {getStatusIcon(item.status)}
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {item.fileName}
                    </p>
                    <p className="text-xs text-gray-500">
                      {item.status === 'uploading' && `Uploading... ${Math.round(item.progress)}%`}
                      {item.status === 'processing' && `Processing... ${item.processingStage}`}
                      {item.status === 'complete' && 'Upload complete'}
                      {item.status === 'error' && `Error: ${item.error}`}
                    </p>
                  </div>
                </div>
                
                <button
                  onClick={() => removeFile(item.fileId)}
                  className="ml-3 text-gray-400 hover:text-gray-600 p-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* Progress Bar */}
              {(item.status === 'uploading' || item.status === 'processing') && (
                <div className="mt-3">
                  <div className="bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${
                        item.status === 'uploading' ? 'bg-blue-600' : 'bg-yellow-500'
                      }`}
                      style={{ width: `${item.status === 'uploading' ? item.progress : 50}%` }}
                    />
                  </div>
                </div>
              )}
              
              {/* Capabilities Display */}
              {item.capabilities && item.capabilities.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs text-gray-600 mb-2">Detected capabilities:</p>
                  <div className="flex flex-wrap gap-1">
                    {item.capabilities.map((cap, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                      >
                        {cap.type}
                        <span className="ml-1 text-blue-600">
                          ({Math.round(cap.confidence * 100)}%)
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* File Preview Grid */}
      {uploadedFiles.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm uk mb-3">Uploaded Files</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {uploadedFiles.map((file) => (
              <FilePreviewCard key={file.fileId} file={file} onRemove={removeFile} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// File Preview Card Component
interface FilePreviewCardProps {
  file: FileUploadResult;
  onRemove: (fileId: string) => void;
}

const FilePreviewCard: React.FC<FilePreviewCardProps> = ({ file, onRemove }) => {
  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) {
      return (
        <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      );
    }
    
    if (mimeType.startsWith('video/')) {
      return (
        <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
          <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </div>
      );
    }
    
    if (mimeType.startsWith('audio/')) {
      return (
        <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
          <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
        </div>
      );
    }
    
    return (
      <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
    );
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="bg-white rounded-lg border p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          {getFileIcon(file.metadata.mimeType)}
          
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {file.metadata.originalName}
            </p>
            <p className="text-xs text-gray-500">
              {formatFileSize(file.metadata.size)} • {file.metadata.mimeType}
            </p>
          </div>
        </div>
        
        <button
          onClick={() => onRemove(file.fileId)}
          className="ml-2 text-gray-400 hover:text-gray-600 p-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      {/* Processing Capabilities */}
      {file.processingCapabilities.length > 0 && (
        <div className="mt-3">
          <div className="flex flex-wrap gap-1">
            {file.processingCapabilities.slice(0, 3).map((cap, index) => (
              <span
                key={index}
                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
              >
                {cap.type}
              </span>
            ))}
            {file.processingCapabilities.length > 3 && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                +{file.processingCapabilities.length - 3} more
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUploadZone;