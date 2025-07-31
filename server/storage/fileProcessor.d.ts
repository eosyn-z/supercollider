import { EventEmitter } from 'events';
import { ProcessingCapability, FileWorkflowSuggestion, ImageAnalysis, VideoAnalysis } from '../../shared/types/fileManagement';
import { FileManagerConfig } from './fileManager';
export declare class FileProcessor extends EventEmitter {
    private config;
    private processingCache;
    private activeProcessing;
    constructor(config: FileManagerConfig);
    analyzeFile(fileId: string): Promise<ProcessingCapability[]>;
    extractTextFromImage(fileId: string): Promise<string>;
    extractTextFromDocument(fileId: string): Promise<string>;
    transcribeAudio(fileId: string): Promise<string>;
    analyzeVideo(fileId: string): Promise<VideoAnalysis>;
    analyzeImage(fileId: string): Promise<ImageAnalysis>;
    suggestWorkflows(fileId: string): Promise<FileWorkflowSuggestion[]>;
    generateThumbnail(fileId: string, size: {
        width: number;
        height: number;
    }): Promise<string>;
    convertFile(fileId: string, targetFormat: string): Promise<string>;
    private getFileManager;
    private determineCapabilities;
    private generateWorkflowSuggestions;
    private determineProcessingPipeline;
    private isDocumentFile;
    private isCodeFile;
    private isCodeFileByExtension;
    private getSupportedConversions;
    private getExtensionForFormat;
    private simulateProcessing;
    private mockOCRResult;
    private mockDocumentParsingResult;
    private mockTranscriptionResult;
    private mockImageAnalysisResult;
    private mockVideoAnalysisResult;
}
export default FileProcessor;
//# sourceMappingURL=fileProcessor.d.ts.map