export interface FileMetadata {
    id: string;
    originalName: string;
    storedName: string;
    mimeType: string;
    size: number;
    uploadTimestamp: number;
    workflowId?: string;
    taskId?: string;
    tags: string[];
    accessibility: 'public' | 'private' | 'workflow_scoped';
    expiresAt?: number;
    checksum: string;
    storageLocation: string;
    processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
    metadata?: Record<string, any>;
}
export interface FileUploadResult {
    fileId: string;
    metadata: FileMetadata;
    processingCapabilities: ProcessingCapability[];
    suggestedWorkflows: string[];
    storageLocation: string;
    uploadDuration: number;
}
export interface FileDownloadRequest {
    fileId: string;
    format?: string;
    quality?: 'original' | 'compressed' | 'optimized';
    transformations?: FileTransformation[];
    includeMetadata?: boolean;
}
export interface FileDownloadResult {
    fileId: string;
    downloadUrl: string;
    fileName: string;
    mimeType: string;
    size: number;
    expiresAt: number;
    transformationsApplied: FileTransformation[];
}
export interface FileTransformation {
    type: 'resize' | 'convert' | 'compress' | 'extract' | 'merge' | 'watermark' | 'crop';
    parameters: Record<string, any>;
    outputFormat?: string;
    quality?: number;
}
export interface ProcessingCapability {
    type: 'image_analysis' | 'text_extraction' | 'audio_transcription' | 'video_analysis' | 'document_parsing' | 'code_analysis' | 'data_parsing';
    confidence: number;
    estimatedDuration: number;
    requiredTools: string[];
    supportedFormats: string[];
    limitations?: string[];
}
export interface ProcessedFileResult {
    fileId: string;
    processingType: ProcessingCapability['type'];
    extractedData: any;
    derivedFiles: FileMetadata[];
    processingMetrics: {
        duration: number;
        accuracy: number;
        resourceUsage: number;
        memoryPeak: number;
    };
    processingLog: ProcessingLogEntry[];
}
export interface ProcessingLogEntry {
    timestamp: number;
    level: 'info' | 'warn' | 'error' | 'debug';
    message: string;
    data?: any;
}
export interface FileWorkflowSuggestion {
    workflowType: string;
    confidence: number;
    requiredInputs: string[];
    expectedOutputs: string[];
    estimatedDuration: number;
    description: string;
    tags: string[];
}
export interface WorkflowContext {
    workflowId?: string;
    userId?: string;
    sessionId: string;
    preferences: UserPreferences;
    constraints: WorkflowConstraint[];
}
export interface UserPreferences {
    qualityLevel: 'draft' | 'standard' | 'high' | 'premium';
    speedPriority: number;
    costSensitivity: number;
    preferredFormats: string[];
    autoOptimize: boolean;
}
export interface WorkflowConstraint {
    type: 'time' | 'quality' | 'resource' | 'format' | 'style' | 'budget';
    value: any;
    priority: 'low' | 'medium' | 'high' | 'critical';
    description?: string;
}
export interface FileFilter {
    workflowId?: string;
    taskId?: string;
    mimeType?: string[];
    tags?: string[];
    accessibility?: FileMetadata['accessibility'];
    uploadedAfter?: number;
    uploadedBefore?: number;
    sizeMin?: number;
    sizeMax?: number;
    processingStatus?: FileMetadata['processingStatus'];
    limit?: number;
    offset?: number;
}
export interface StorageQuota {
    userId: string;
    allocatedBytes: number;
    usedBytes: number;
    availableBytes: number;
    fileCount: number;
    expirationPolicy: {
        defaultTTL: number;
        maxTTL: number;
        autoCleanup: boolean;
    };
}
export interface FileValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    sanitizationApplied: boolean;
    virusScanPassed: boolean;
    contentTypeVerified: boolean;
}
export interface BulkFileOperation {
    operationType: 'upload' | 'download' | 'delete' | 'move' | 'copy' | 'transform';
    fileIds: string[];
    parameters: Record<string, any>;
    batchId: string;
    createdAt: number;
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
    progress: {
        completed: number;
        total: number;
        failed: number;
    };
}
export interface ImageAnalysis {
    dimensions: {
        width: number;
        height: number;
    };
    colorProfile: string;
    dominantColors: string[];
    objects: DetectedObject[];
    faces: DetectedFace[];
    text: ExtractedText[];
    quality: {
        sharpness: number;
        brightness: number;
        contrast: number;
        noise: number;
    };
    metadata: {
        camera?: string;
        location?: {
            lat: number;
            lng: number;
        };
        timestamp?: number;
        settings?: Record<string, any>;
    };
}
export interface DetectedObject {
    id: string;
    label: string;
    confidence: number;
    boundingBox: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    attributes?: Record<string, any>;
}
export interface DetectedFace {
    id: string;
    confidence: number;
    boundingBox: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    landmarks: FaceLandmark[];
    emotions: EmotionScore[];
    demographics: {
        ageRange?: {
            min: number;
            max: number;
        };
        gender?: {
            value: string;
            confidence: number;
        };
    };
}
export interface FaceLandmark {
    type: string;
    x: number;
    y: number;
}
export interface EmotionScore {
    emotion: string;
    confidence: number;
}
export interface ExtractedText {
    id: string;
    text: string;
    confidence: number;
    boundingBox: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    language?: string;
}
export interface VideoAnalysis {
    duration: number;
    dimensions: {
        width: number;
        height: number;
    };
    frameRate: number;
    bitrate: number;
    codec: string;
    audioTracks: AudioTrackInfo[];
    thumbnails: string[];
    scenes: VideoScene[];
    motion: MotionAnalysis;
    quality: VideoQuality;
}
export interface AudioTrackInfo {
    index: number;
    codec: string;
    bitrate: number;
    sampleRate: number;
    channels: number;
    language?: string;
    duration: number;
}
export interface VideoScene {
    startTime: number;
    endTime: number;
    description: string;
    confidence: number;
    keyframes: string[];
    motion: number;
    audioLevel: number;
}
export interface MotionAnalysis {
    averageMotion: number;
    motionPeaks: {
        time: number;
        intensity: number;
    }[];
    staticPercentage: number;
    cameraMovement: {
        type: 'static' | 'pan' | 'tilt' | 'zoom' | 'handheld';
        confidence: number;
    };
}
export interface VideoQuality {
    resolution: string;
    sharpness: number;
    noise: number;
    compression: number;
    artifacts: string[];
    overallScore: number;
}
export interface DocumentAnalysis {
    pageCount: number;
    textContent: string;
    language: string;
    structure: DocumentStructure;
    tables: ExtractedTable[];
    images: ExtractedImage[];
    metadata: DocumentMetadata;
    readability: ReadabilityScore;
}
export interface DocumentStructure {
    headings: TextElement[];
    paragraphs: TextElement[];
    lists: ListElement[];
    footnotes: TextElement[];
}
export interface TextElement {
    id: string;
    text: string;
    level?: number;
    page: number;
    boundingBox?: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    formatting?: TextFormatting;
}
export interface ListElement {
    id: string;
    items: string[];
    type: 'ordered' | 'unordered';
    page: number;
    level: number;
}
export interface TextFormatting {
    bold: boolean;
    italic: boolean;
    underline: boolean;
    fontSize: number;
    fontFamily: string;
    color: string;
}
export interface ExtractedTable {
    id: string;
    page: number;
    rows: TableRow[];
    boundingBox: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
}
export interface TableRow {
    cells: string[];
    isHeader: boolean;
}
export interface ExtractedImage {
    id: string;
    page: number;
    boundingBox: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    description?: string;
    extractedFileId?: string;
}
export interface DocumentMetadata {
    title?: string;
    author?: string;
    subject?: string;
    creator?: string;
    producer?: string;
    creationDate?: number;
    modificationDate?: number;
    keywords?: string[];
}
export interface ReadabilityScore {
    fleschKincaid: number;
    fleschReading: number;
    colemanLiau: number;
    automatedReadability: number;
    averageScore: number;
    level: 'elementary' | 'middle_school' | 'high_school' | 'college' | 'graduate';
}
export interface AudioAnalysis {
    duration: number;
    sampleRate: number;
    channels: number;
    bitrate: number;
    codec: string;
    waveform: number[];
    spectogram: SpectogramData;
    transcription?: TranscriptionResult;
    musicInfo?: MusicAnalysis;
    quality: AudioQuality;
}
export interface SpectogramData {
    frequencies: number[];
    magnitudes: number[][];
    timeResolution: number;
    frequencyResolution: number;
}
export interface TranscriptionResult {
    text: string;
    confidence: number;
    words: TranscribedWord[];
    language: string;
    speakers?: SpeakerInfo[];
}
export interface TranscribedWord {
    word: string;
    startTime: number;
    endTime: number;
    confidence: number;
    speakerId?: string;
}
export interface SpeakerInfo {
    id: string;
    name?: string;
    confidence: number;
    segments: {
        startTime: number;
        endTime: number;
    }[];
}
export interface MusicAnalysis {
    tempo: number;
    key: string;
    timeSignature: string;
    energy: number;
    danceability: number;
    mood: string;
    genre: string[];
    instruments: string[];
}
export interface AudioQuality {
    signalToNoise: number;
    dynamicRange: number;
    peakLevel: number;
    averageLevel: number;
    clipping: boolean;
    backgroundNoise: number;
}
export interface CachePolicy {
    ttl: number;
    maxSize: number;
    evictionStrategy: 'lru' | 'lfu' | 'fifo' | 'random';
    compressionEnabled: boolean;
}
export interface StorageConfig {
    provider: 'local' | 's3' | 'gcs' | 'azure' | 'cloudinary';
    basePath: string;
    maxFileSize: number;
    allowedMimeTypes: string[];
    virusScanEnabled: boolean;
    encryptionEnabled: boolean;
    backupEnabled: boolean;
    cdnEnabled: boolean;
}
//# sourceMappingURL=fileManagement.d.ts.map