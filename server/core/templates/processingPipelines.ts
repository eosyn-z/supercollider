/**
 * Predefined Processing Pipelines - Universal Media Processing Templates
 * Contains pre-built pipelines for common media processing tasks
 */

import { ProcessingPipeline, ProcessingStep, MediaType, ProcessingCapability } from '../utils/mediaClassifier';

export interface PipelineTemplate {
  id: string;
  name: string;
  description: string;
  category: 'multimedia' | 'analysis' | 'transformation' | 'synthesis' | 'extraction';
  complexity: 'simple' | 'moderate' | 'complex';
  estimatedDuration: number;
  requiredCapabilities: ProcessingCapability[];
  supportedInputs: MediaType[];
  expectedOutputs: MediaType[];
  tags: string[];
  usageScenarios: string[];
  pipeline: ProcessingPipeline;
}

export const UNIVERSAL_PIPELINES: Record<string, PipelineTemplate> = {
  // Video to Story Pipeline
  'video_to_story': {
    id: 'video_to_story',
    name: 'Video to Story Converter',
    description: 'Extracts visual and audio content from video to create comprehensive narrative',
    category: 'transformation',
    complexity: 'complex',
    estimatedDuration: 180000, // 3 minutes
    requiredCapabilities: ['extract', 'caption', 'transcribe', 'synthesize'],
    supportedInputs: ['video'],
    expectedOutputs: ['text'],
    tags: ['video-processing', 'narrative', 'content-extraction', 'storytelling'],
    usageScenarios: [
      'Video summarization',
      'Content repurposing',
      'Accessibility enhancement',
      'Video analysis'
    ],
    pipeline: {
      id: 'video_to_story',
      inputTypes: ['video'],
      outputTypes: ['text'],
      steps: [
        {
          id: 'extract_frames',
          name: 'Extract Key Frames',
          inputType: 'video',
          outputType: 'image',
          apiEndpoint: '/api/video/extract-frames',
          dependencies: [],
          canBatch: true,
          estimatedDuration: 30000,
          requiredCapabilities: ['extract'],
          fallbackOptions: ['local_ffmpeg', 'alternative_extractor']
        },
        {
          id: 'caption_frames',
          name: 'Generate Frame Captions',
          inputType: 'image',
          outputType: 'text',
          apiEndpoint: '/api/vision/caption',
          dependencies: ['extract_frames'],
          canBatch: true,
          estimatedDuration: 45000,
          requiredCapabilities: ['caption', 'analyze'],
          fallbackOptions: ['alternative_vision_api', 'manual_annotation']
        },
        {
          id: 'extract_audio',
          name: 'Extract Audio Track',
          inputType: 'video',
          outputType: 'audio',
          apiEndpoint: '/api/video/extract-audio',
          dependencies: [],
          canBatch: false,
          estimatedDuration: 20000,
          requiredCapabilities: ['extract'],
          fallbackOptions: ['local_ffmpeg', 'audio_separator']
        },
        {
          id: 'transcribe_audio',
          name: 'Transcribe Audio Content',
          inputType: 'audio',
          outputType: 'text',
          apiEndpoint: '/api/speech/transcribe',
          dependencies: ['extract_audio'],
          canBatch: false,
          estimatedDuration: 60000,
          requiredCapabilities: ['transcribe'],
          fallbackOptions: ['alternative_stt', 'manual_transcription']
        },
        {
          id: 'synthesize_narrative',
          name: 'Create Unified Narrative',
          inputType: 'text',
          outputType: 'text',
          apiEndpoint: '/api/text/synthesize',
          dependencies: ['caption_frames', 'transcribe_audio'],
          canBatch: false,
          estimatedDuration: 25000,
          requiredCapabilities: ['synthesize', 'generate'],
          fallbackOptions: ['template_based', 'rule_based_synthesis']
        }
      ],
      parallelizable: true,
      estimatedDuration: 180000
    }
  },

  // Text to Multimedia Pipeline
  'text_to_multimedia': {
    id: 'text_to_multimedia',
    name: 'Text to Multimedia Creator',
    description: 'Converts text descriptions into rich multimedia content',
    category: 'multimedia',
    complexity: 'complex',
    estimatedDuration: 240000, // 4 minutes
    requiredCapabilities: ['analyze', 'generate', 'synthesize'],
    supportedInputs: ['text'],
    expectedOutputs: ['image', 'audio', 'video'],
    tags: ['content-generation', 'multimedia', 'creative', 'ai-generation'],
    usageScenarios: [
      'Content creation from scripts',
      'Educational material generation',
      'Marketing content creation',
      'Presentation enhancement'
    ],
    pipeline: {
      id: 'text_to_multimedia',
      inputTypes: ['text'],
      outputTypes: ['image', 'audio', 'video'],
      steps: [
        {
          id: 'analyze_intent',
          name: 'Analyze Content Intent',
          inputType: 'text',
          outputType: 'data',
          apiEndpoint: '/api/text/analyze-intent',
          dependencies: [],
          canBatch: false,
          estimatedDuration: 15000,
          requiredCapabilities: ['analyze'],
          fallbackOptions: ['rule_based_analysis', 'keyword_extraction']
        },
        {
          id: 'generate_image_prompts',
          name: 'Generate Image Prompts',
          inputType: 'text',
          outputType: 'text',
          apiEndpoint: '/api/text/generate-prompts',
          dependencies: ['analyze_intent'],
          canBatch: false,
          estimatedDuration: 20000,
          requiredCapabilities: ['generate'],
          fallbackOptions: ['template_prompts', 'manual_prompts']
        },
        {
          id: 'generate_images',
          name: 'Create Visual Content',
          inputType: 'text',
          outputType: 'image',
          apiEndpoint: '/api/image/generate',
          dependencies: ['generate_image_prompts'],
          canBatch: true,
          estimatedDuration: 90000,
          requiredCapabilities: ['generate'],
          fallbackOptions: ['stock_images', 'template_graphics']
        },
        {
          id: 'generate_audio',
          name: 'Create Audio Narration',
          inputType: 'text',
          outputType: 'audio',
          apiEndpoint: '/api/audio/text-to-speech',
          dependencies: ['analyze_intent'],
          canBatch: false,
          estimatedDuration: 45000,
          requiredCapabilities: ['generate', 'synthesize'],
          fallbackOptions: ['alternative_tts', 'audio_templates']
        },
        {
          id: 'combine_media',
          name: 'Combine into Video',
          inputType: 'mixed',
          outputType: 'video',
          apiEndpoint: '/api/video/combine',
          dependencies: ['generate_images', 'generate_audio'],
          canBatch: false,
          estimatedDuration: 70000,
          requiredCapabilities: ['synthesize'],
          fallbackOptions: ['simple_slideshow', 'static_presentation']
        }
      ],
      parallelizable: true,
      estimatedDuration: 240000
    }
  },

  // Document Intelligence Pipeline
  'document_intelligence': {
    id: 'document_intelligence',
    name: 'Document Intelligence Processor',
    description: 'Extracts structured information and insights from documents',
    category: 'analysis',
    complexity: 'moderate',
    estimatedDuration: 120000, // 2 minutes
    requiredCapabilities: ['extract', 'analyze', 'synthesize'],
    supportedInputs: ['document', 'image'],
    expectedOutputs: ['text', 'data'],
    tags: ['document-processing', 'ocr', 'data-extraction', 'analysis'],
    usageScenarios: [
      'Contract analysis',
      'Research paper processing',
      'Form data extraction',
      'Document summarization'
    ],
    pipeline: {
      id: 'document_intelligence',
      inputTypes: ['document', 'image'],
      outputTypes: ['text', 'data'],
      steps: [
        {
          id: 'extract_text',
          name: 'Extract Text Content',
          inputType: 'document',
          outputType: 'text',
          apiEndpoint: '/api/ocr/extract-text',
          dependencies: [],
          canBatch: true,
          estimatedDuration: 30000,
          requiredCapabilities: ['extract'],
          fallbackOptions: ['alternative_ocr', 'manual_typing']
        },
        {
          id: 'extract_tables',
          name: 'Extract Table Data',
          inputType: 'document',
          outputType: 'data',
          apiEndpoint: '/api/ocr/extract-tables',
          dependencies: [],
          canBatch: true,
          estimatedDuration: 25000,
          requiredCapabilities: ['extract'],
          fallbackOptions: ['manual_table_extraction', 'csv_export']
        },
        {
          id: 'analyze_structure',
          name: 'Analyze Document Structure',
          inputType: 'text',
          outputType: 'data',
          apiEndpoint: '/api/document/analyze-structure',
          dependencies: ['extract_text'],
          canBatch: false,
          estimatedDuration: 20000,
          requiredCapabilities: ['analyze'],
          fallbackOptions: ['rule_based_structure', 'manual_classification']
        },
        {
          id: 'extract_entities',
          name: 'Extract Named Entities',
          inputType: 'text',
          outputType: 'data',
          apiEndpoint: '/api/nlp/extract-entities',
          dependencies: ['extract_text'],
          canBatch: false,
          estimatedDuration: 15000,
          requiredCapabilities: ['analyze', 'extract'],
          fallbackOptions: ['regex_extraction', 'keyword_matching']
        },
        {
          id: 'generate_insights',
          name: 'Generate Document Insights',
          inputType: 'data',
          outputType: 'text',
          apiEndpoint: '/api/analysis/generate-insights',
          dependencies: ['analyze_structure', 'extract_entities', 'extract_tables'],
          canBatch: false,
          estimatedDuration: 30000,
          requiredCapabilities: ['synthesize', 'analyze'],
          fallbackOptions: ['template_insights', 'statistical_summary']
        }
      ],
      parallelizable: true,
      estimatedDuration: 120000
    }
  },

  // Audio Intelligence Pipeline
  'audio_intelligence': {
    id: 'audio_intelligence',
    name: 'Audio Intelligence Processor',
    description: 'Comprehensive audio analysis including speech, music, and sound identification',
    category: 'analysis',
    complexity: 'moderate',
    estimatedDuration: 150000, // 2.5 minutes
    requiredCapabilities: ['transcribe', 'analyze', 'extract'],
    supportedInputs: ['audio'],
    expectedOutputs: ['text', 'data'],
    tags: ['audio-processing', 'speech-recognition', 'music-analysis', 'sound-classification'],
    usageScenarios: [
      'Podcast transcription and analysis',
      'Music content analysis',
      'Call center analytics',
      'Audio accessibility'
    ],
    pipeline: {
      id: 'audio_intelligence',
      inputTypes: ['audio'],
      outputTypes: ['text', 'data'],
      steps: [
        {
          id: 'audio_preprocessing',
          name: 'Preprocess Audio',
          inputType: 'audio',
          outputType: 'audio',
          apiEndpoint: '/api/audio/preprocess',
          dependencies: [],
          canBatch: false,
          estimatedDuration: 20000,
          requiredCapabilities: ['transform'],
          fallbackOptions: ['basic_normalization', 'no_preprocessing']
        },
        {
          id: 'speech_detection',
          name: 'Detect Speech Segments',
          inputType: 'audio',
          outputType: 'data',
          apiEndpoint: '/api/audio/detect-speech',
          dependencies: ['audio_preprocessing'],
          canBatch: false,
          estimatedDuration: 25000,
          requiredCapabilities: ['analyze'],
          fallbackOptions: ['energy_based_detection', 'full_transcription']
        },
        {
          id: 'transcribe_speech',
          name: 'Transcribe Speech Content',
          inputType: 'audio',
          outputType: 'text',
          apiEndpoint: '/api/speech/transcribe',
          dependencies: ['speech_detection'],
          canBatch: false,
          estimatedDuration: 60000,
          requiredCapabilities: ['transcribe'],
          fallbackOptions: ['alternative_stt', 'manual_transcription']
        },
        {
          id: 'analyze_sentiment',
          name: 'Analyze Speech Sentiment',
          inputType: 'text',
          outputType: 'data',
          apiEndpoint: '/api/nlp/sentiment',
          dependencies: ['transcribe_speech'],
          canBatch: false,
          estimatedDuration: 15000,
          requiredCapabilities: ['analyze'],
          fallbackOptions: ['lexicon_based', 'neutral_sentiment']
        },
        {
          id: 'classify_audio',
          name: 'Classify Audio Content',
          inputType: 'audio',
          outputType: 'data',
          apiEndpoint: '/api/audio/classify',
          dependencies: ['audio_preprocessing'],
          canBatch: false,
          estimatedDuration: 30000,
          requiredCapabilities: ['analyze'],
          fallbackOptions: ['basic_classification', 'unknown_classification']
        }
      ],
      parallelizable: true,
      estimatedDuration: 150000
    }
  },

  // Image Analysis Pipeline
  'image_analysis': {
    id: 'image_analysis',
    name: 'Comprehensive Image Analyzer',
    description: 'Deep analysis of images including objects, text, faces, and scene understanding',
    category: 'analysis',
    complexity: 'moderate',
    estimatedDuration: 90000, // 1.5 minutes
    requiredCapabilities: ['analyze', 'caption', 'extract'],
    supportedInputs: ['image'],
    expectedOutputs: ['text', 'data'],
    tags: ['computer-vision', 'object-detection', 'scene-analysis', 'ocr'],
    usageScenarios: [
      'Photo organization and tagging',
      'Security and surveillance',
      'Medical image analysis',
      'E-commerce product analysis'
    ],
    pipeline: {
      id: 'image_analysis',
      inputTypes: ['image'],
      outputTypes: ['text', 'data'],
      steps: [
        {
          id: 'detect_objects',
          name: 'Detect Objects and Entities',
          inputType: 'image',
          outputType: 'data',
          apiEndpoint: '/api/vision/detect-objects',
          dependencies: [],
          canBatch: true,
          estimatedDuration: 25000,
          requiredCapabilities: ['analyze'],
          fallbackOptions: ['basic_classification', 'manual_tagging']
        },
        {
          id: 'extract_text_ocr',
          name: 'Extract Text via OCR',
          inputType: 'image',
          outputType: 'text',
          apiEndpoint: '/api/ocr/extract-text',
          dependencies: [],
          canBatch: true,
          estimatedDuration: 15000,
          requiredCapabilities: ['extract'],
          fallbackOptions: ['alternative_ocr', 'manual_transcription']
        },
        {
          id: 'analyze_scene',
          name: 'Analyze Scene Context',
          inputType: 'image',
          outputType: 'data',
          apiEndpoint: '/api/vision/analyze-scene',
          dependencies: [],
          canBatch: true,
          estimatedDuration: 20000,
          requiredCapabilities: ['analyze'],
          fallbackOptions: ['color_analysis', 'basic_features']
        },
        {
          id: 'generate_caption',
          name: 'Generate Descriptive Caption',
          inputType: 'image',
          outputType: 'text',
          apiEndpoint: '/api/vision/caption',
          dependencies: ['detect_objects', 'analyze_scene'],
          canBatch: true,
          estimatedDuration: 20000,
          requiredCapabilities: ['caption', 'synthesize'],
          fallbackOptions: ['template_caption', 'object_list']
        },
        {
          id: 'comprehensive_summary',
          name: 'Create Comprehensive Summary',
          inputType: 'mixed',
          outputType: 'text',
          apiEndpoint: '/api/analysis/summarize',
          dependencies: ['detect_objects', 'extract_text_ocr', 'analyze_scene', 'generate_caption'],
          canBatch: false,
          estimatedDuration: 10000,
          requiredCapabilities: ['synthesize'],
          fallbackOptions: ['concatenated_results', 'structured_output']
        }
      ],
      parallelizable: true,
      estimatedDuration: 90000
    }
  },

  // Data Processing Pipeline
  'data_processing': {
    id: 'data_processing',
    name: 'Universal Data Processor',
    description: 'Analyzes, cleanses, and generates insights from structured and unstructured data',
    category: 'analysis',
    complexity: 'moderate',
    estimatedDuration: 100000, // 1.7 minutes
    requiredCapabilities: ['analyze', 'transform', 'synthesize'],
    supportedInputs: ['data', 'text'],
    expectedOutputs: ['data', 'text'],
    tags: ['data-analysis', 'statistics', 'visualization', 'insights'],
    usageScenarios: [
      'Business intelligence',
      'Research data analysis',
      'Quality assurance',
      'Data exploration'
    ],
    pipeline: {
      id: 'data_processing',
      inputTypes: ['data', 'text'],
      outputTypes: ['data', 'text'],
      steps: [
        {
          id: 'data_validation',
          name: 'Validate Data Quality',
          inputType: 'data',
          outputType: 'data',
          apiEndpoint: '/api/data/validate',
          dependencies: [],
          canBatch: false,
          estimatedDuration: 15000,
          requiredCapabilities: ['analyze'],
          fallbackOptions: ['basic_validation', 'no_validation']
        },
        {
          id: 'data_cleansing',
          name: 'Clean and Normalize Data',
          inputType: 'data',
          outputType: 'data',
          apiEndpoint: '/api/data/cleanse',
          dependencies: ['data_validation'],
          canBatch: false,
          estimatedDuration: 25000,
          requiredCapabilities: ['transform'],
          fallbackOptions: ['basic_cleaning', 'manual_cleaning']
        },
        {
          id: 'statistical_analysis',
          name: 'Perform Statistical Analysis',
          inputType: 'data',
          outputType: 'data',
          apiEndpoint: '/api/stats/analyze',
          dependencies: ['data_cleansing'],
          canBatch: false,
          estimatedDuration: 30000,
          requiredCapabilities: ['analyze'],
          fallbackOptions: ['basic_stats', 'descriptive_only']
        },
        {
          id: 'pattern_detection',
          name: 'Detect Patterns and Anomalies',
          inputType: 'data',
          outputType: 'data',
          apiEndpoint: '/api/ml/detect-patterns',
          dependencies: ['statistical_analysis'],
          canBatch: false,
          estimatedDuration: 20000,
          requiredCapabilities: ['analyze'],
          fallbackOptions: ['rule_based_patterns', 'threshold_detection']
        },
        {
          id: 'generate_insights',
          name: 'Generate Actionable Insights',
          inputType: 'data',
          outputType: 'text',
          apiEndpoint: '/api/insights/generate',
          dependencies: ['statistical_analysis', 'pattern_detection'],
          canBatch: false,
          estimatedDuration: 10000,
          requiredCapabilities: ['synthesize'],
          fallbackOptions: ['template_insights', 'summary_statistics']
        }
      ],
      parallelizable: true,
      estimatedDuration: 100000
    }
  },

  // Content Moderation Pipeline
  'content_moderation': {
    id: 'content_moderation',
    name: 'Multi-Modal Content Moderator',
    description: 'Comprehensive content moderation across text, images, audio, and video',
    category: 'analysis',
    complexity: 'complex',
    estimatedDuration: 200000, // 3.3 minutes
    requiredCapabilities: ['analyze', 'extract'],
    supportedInputs: ['text', 'image', 'audio', 'video'],
    expectedOutputs: ['data'],
    tags: ['moderation', 'safety', 'compliance', 'ai-ethics'],
    usageScenarios: [
      'Social media content filtering',
      'Educational content safety',
      'Corporate compliance',
      'Platform safety'
    ],
    pipeline: {
      id: 'content_moderation',
      inputTypes: ['text', 'image', 'audio', 'video'],
      outputTypes: ['data'],
      steps: [
        {
          id: 'text_moderation',
          name: 'Moderate Text Content',
          inputType: 'text',
          outputType: 'data',
          apiEndpoint: '/api/moderation/text',
          dependencies: [],
          canBatch: true,
          estimatedDuration: 30000,
          requiredCapabilities: ['analyze'],
          fallbackOptions: ['keyword_filtering', 'rule_based']
        },
        {
          id: 'image_moderation',
          name: 'Moderate Visual Content',
          inputType: 'image',
          outputType: 'data',
          apiEndpoint: '/api/moderation/image',
          dependencies: [],
          canBatch: true,
          estimatedDuration: 45000,
          requiredCapabilities: ['analyze'],
          fallbackOptions: ['hash_matching', 'manual_review']
        },
        {
          id: 'audio_moderation',
          name: 'Moderate Audio Content',
          inputType: 'audio',
          outputType: 'data',
          apiEndpoint: '/api/moderation/audio',
          dependencies: [],
          canBatch: false,
          estimatedDuration: 60000,
          requiredCapabilities: ['analyze', 'transcribe'],
          fallbackOptions: ['speech_to_text_moderation', 'audio_fingerprinting']
        },
        {
          id: 'video_moderation',
          name: 'Moderate Video Content',
          inputType: 'video',
          outputType: 'data',
          apiEndpoint: '/api/moderation/video',
          dependencies: [],
          canBatch: false,
          estimatedDuration: 90000,
          requiredCapabilities: ['analyze', 'extract'],
          fallbackOptions: ['frame_sampling', 'audio_only']
        },
        {
          id: 'aggregate_results',
          name: 'Aggregate Moderation Results',
          inputType: 'data',
          outputType: 'data',
          apiEndpoint: '/api/moderation/aggregate',
          dependencies: ['text_moderation', 'image_moderation', 'audio_moderation', 'video_moderation'],
          canBatch: false,
          estimatedDuration: 15000,
          requiredCapabilities: ['synthesize'],
          fallbackOptions: ['simple_aggregation', 'worst_case_classification']
        }
      ],
      parallelizable: true,
      estimatedDuration: 200000
    }
  },

  // Translation Pipeline
  'universal_translation': {
    id: 'universal_translation',
    name: 'Universal Content Translator',
    description: 'Translates content across multiple media types and languages',
    category: 'transformation',
    complexity: 'moderate',
    estimatedDuration: 110000, // 1.8 minutes
    requiredCapabilities: ['transform', 'extract', 'synthesize'],
    supportedInputs: ['text', 'image', 'audio', 'document'],
    expectedOutputs: ['text', 'audio'],
    tags: ['translation', 'localization', 'accessibility', 'globalization'],
    usageScenarios: [
      'Document translation',
      'Website localization',
      'Video subtitles',
      'Audio dubbing'
    ],
    pipeline: {
      id: 'universal_translation',
      inputTypes: ['text', 'image', 'audio', 'document'],
      outputTypes: ['text', 'audio'],
      steps: [
        {
          id: 'extract_content',
          name: 'Extract Translatable Content',
          inputType: 'mixed',
          outputType: 'text',
          apiEndpoint: '/api/extraction/translatable',
          dependencies: [],
          canBatch: true,
          estimatedDuration: 25000,
          requiredCapabilities: ['extract'],
          fallbackOptions: ['direct_text', 'manual_extraction']
        },
        {
          id: 'detect_language',
          name: 'Detect Source Language',
          inputType: 'text',
          outputType: 'data',
          apiEndpoint: '/api/language/detect',
          dependencies: ['extract_content'],
          canBatch: false,
          estimatedDuration: 10000,
          requiredCapabilities: ['analyze'],
          fallbackOptions: ['user_specified', 'default_language']
        },
        {
          id: 'translate_text',
          name: 'Translate Content',
          inputType: 'text',
          outputType: 'text',
          apiEndpoint: '/api/translation/translate',
          dependencies: ['detect_language'],
          canBatch: false,
          estimatedDuration: 40000,
          requiredCapabilities: ['transform'],
          fallbackOptions: ['alternative_translator', 'dictionary_lookup']
        },
        {
          id: 'quality_check',
          name: 'Validate Translation Quality',
          inputType: 'text',
          outputType: 'data',
          apiEndpoint: '/api/translation/validate',
          dependencies: ['translate_text'],
          canBatch: false,
          estimatedDuration: 15000,
          requiredCapabilities: ['analyze'],
          fallbackOptions: ['basic_validation', 'no_validation']
        },
        {
          id: 'generate_audio',
          name: 'Generate Translated Audio',
          inputType: 'text',
          outputType: 'audio',
          apiEndpoint: '/api/tts/generate',
          dependencies: ['translate_text'],
          canBatch: false,
          estimatedDuration: 20000,
          requiredCapabilities: ['synthesize'],
          fallbackOptions: ['basic_tts', 'text_only']
        }
      ],
      parallelizable: true,
      estimatedDuration: 110000
    }
  }
};

/**
 * Pipeline Registry for managing and retrieving processing pipelines
 */
export class PipelineRegistry {
  private pipelines: Map<string, PipelineTemplate> = new Map();

  constructor() {
    this.initializePipelines();
  }

  /**
   * Initialize with default pipelines
   */
  private initializePipelines(): void {
    Object.entries(UNIVERSAL_PIPELINES).forEach(([key, pipeline]) => {
      this.pipelines.set(key, pipeline);
    });
  }

  /**
   * Get all available pipelines
   */
  getAllPipelines(): PipelineTemplate[] {
    return Array.from(this.pipelines.values());
  }

  /**
   * Get pipeline by ID
   */
  getPipeline(id: string): PipelineTemplate | undefined {
    return this.pipelines.get(id);
  }

  /**
   * Find pipelines by category
   */
  getPipelinesByCategory(category: PipelineTemplate['category']): PipelineTemplate[] {
    return Array.from(this.pipelines.values()).filter(p => p.category === category);
  }

  /**
   * Find pipelines by input type
   */
  getPipelinesByInputType(inputType: MediaType): PipelineTemplate[] {
    return Array.from(this.pipelines.values()).filter(p => 
      p.supportedInputs.includes(inputType)
    );
  }

  /**
   * Find pipelines by output type
   */
  getPipelinesByOutputType(outputType: MediaType): PipelineTemplate[] {
    return Array.from(this.pipelines.values()).filter(p => 
      p.expectedOutputs.includes(outputType)
    );
  }

  /**
   * Find pipelines by capability requirement
   */
  getPipelinesByCapability(capability: ProcessingCapability): PipelineTemplate[] {
    return Array.from(this.pipelines.values()).filter(p => 
      p.requiredCapabilities.includes(capability)
    );
  }

  /**
   * Find pipelines by complexity level
   */
  getPipelinesByComplexity(complexity: PipelineTemplate['complexity']): PipelineTemplate[] {
    return Array.from(this.pipelines.values()).filter(p => p.complexity === complexity);
  }

  /**
   * Search pipelines by tags
   */
  searchPipelinesByTags(tags: string[]): PipelineTemplate[] {
    return Array.from(this.pipelines.values()).filter(p => 
      tags.some(tag => p.tags.includes(tag))
    );
  }

  /**
   * Find optimal pipeline for specific requirements
   */
  findOptimalPipeline(
    inputTypes: MediaType[],
    outputTypes: MediaType[],
    maxDuration?: number,
    requiredCapabilities?: ProcessingCapability[]
  ): PipelineTemplate[] {
    let candidates = Array.from(this.pipelines.values());

    // Filter by input types
    candidates = candidates.filter(p => 
      inputTypes.some(input => p.supportedInputs.includes(input))
    );

    // Filter by output types
    candidates = candidates.filter(p => 
      outputTypes.some(output => p.expectedOutputs.includes(output))
    );

    // Filter by duration if specified
    if (maxDuration) {
      candidates = candidates.filter(p => p.estimatedDuration <= maxDuration);
    }

    // Filter by required capabilities if specified
    if (requiredCapabilities) {
      candidates = candidates.filter(p => 
        requiredCapabilities.every(cap => p.requiredCapabilities.includes(cap))
      );
    }

    // Sort by estimated duration (faster first)
    return candidates.sort((a, b) => a.estimatedDuration - b.estimatedDuration);
  }

  /**
   * Register custom pipeline
   */
  registerPipeline(pipeline: PipelineTemplate): void {
    this.pipelines.set(pipeline.id, pipeline);
  }

  /**
   * Remove pipeline
   */
  removePipeline(id: string): boolean {
    return this.pipelines.delete(id);
  }

  /**
   * Get pipeline statistics
   */
  getPipelineStats(): {
    totalPipelines: number;
    byCategory: Record<string, number>;
    byComplexity: Record<string, number>;
    averageDuration: number;
    supportedInputTypes: MediaType[];
    supportedOutputTypes: MediaType[];
  } {
    const pipelines = Array.from(this.pipelines.values());
    
    const byCategory = pipelines.reduce((acc, p) => {
      acc[p.category] = (acc[p.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byComplexity = pipelines.reduce((acc, p) => {
      acc[p.complexity] = (acc[p.complexity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const averageDuration = pipelines.reduce((sum, p) => sum + p.estimatedDuration, 0) / pipelines.length;

    const supportedInputTypes = [...new Set(pipelines.flatMap(p => p.supportedInputs))];
    const supportedOutputTypes = [...new Set(pipelines.flatMap(p => p.expectedOutputs))];

    return {
      totalPipelines: pipelines.length,
      byCategory,
      byComplexity,
      averageDuration,
      supportedInputTypes,
      supportedOutputTypes
    };
  }
}

// Export singleton instance
export const pipelineRegistry = new PipelineRegistry();