"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskLibrary = void 0;
class TaskLibrary {
    static getAtomicTask(taskId) {
        const task = this.taskTemplates.get(taskId);
        return task ? this.cloneTask(task) : null;
    }
    static searchTasks(criteria) {
        const results = [];
        for (const task of this.taskTemplates.values()) {
            if (this.matchesCriteria(task, criteria)) {
                results.push(this.cloneTask(task));
            }
        }
        return this.sortSearchResults(results, criteria);
    }
    static createCustomTask(template) {
        const taskId = template.id || this.generateTaskId();
        const task = {
            id: taskId,
            type: template.type || 'process_data',
            name: template.name || 'Custom Task',
            description: template.description || 'Custom atomic task',
            inputs: template.inputs || [],
            outputs: template.outputs || [],
            dependencies: template.dependencies || [],
            estimatedDuration: template.estimatedDuration || 5000,
            complexity: template.complexity || 'simple',
            canRunInParallel: template.canRunInParallel ?? true,
            requiredCapabilities: template.requiredCapabilities || [],
            priority: template.priority || 5,
            retryPolicy: template.retryPolicy || this.getDefaultRetryPolicy(),
            validation: template.validation || this.getDefaultValidation(),
            metadata: template.metadata || {}
        };
        return task;
    }
    static validateTaskCompatibility(task1, task2) {
        for (const output of task1.outputs) {
            for (const input of task2.inputs) {
                if (this.areCompatibleTypes(output.dataType, input.dataType)) {
                    return true;
                }
            }
        }
        return false;
    }
    static getTaskTemplate(templateId) {
        return this.customTemplates.get(templateId) || null;
    }
    static getAvailableTaskTypes() {
        const types = new Set();
        for (const task of this.taskTemplates.values()) {
            types.add(task.type);
        }
        return Array.from(types);
    }
    static getTasksByCategory(category) {
        return Array.from(this.taskTemplates.values())
            .filter(task => this.getCategoryForTask(task) === category)
            .map(task => this.cloneTask(task));
    }
    static initializeLibrary() {
        this.initializeGenerationTasks();
        this.initializeProcessingTasks();
        this.initializeAnalysisTasks();
        this.initializeTransformationTasks();
        this.initializeCoordinationTasks();
        this.initializeOutputTasks();
        this.initializeCustomTemplates();
    }
    static initializeGenerationTasks() {
        this.addTask({
            id: 'generate_video_script',
            type: 'generate_text',
            name: 'Generate Video Script',
            description: 'Create a detailed script for video production with scenes, dialogue, and timing',
            inputs: [
                {
                    id: 'topic',
                    name: 'Video Topic',
                    description: 'The main topic or subject of the video',
                    type: 'text',
                    dataType: 'string',
                    required: true,
                    validation: [
                        { type: 'required', value: true, message: 'Topic is required', severity: 'error' },
                        { type: 'length', value: { min: 10, max: 500 }, message: 'Topic must be 10-500 characters', severity: 'error' }
                    ]
                },
                {
                    id: 'duration',
                    name: 'Target Duration',
                    description: 'Desired duration of the video in seconds',
                    type: 'parameter',
                    dataType: 'number',
                    required: true,
                    validation: [
                        { type: 'range', value: { min: 30, max: 3600 }, message: 'Duration must be 30-3600 seconds', severity: 'error' }
                    ]
                },
                {
                    id: 'style',
                    name: 'Style Guide',
                    description: 'Writing style and tone preferences',
                    type: 'text',
                    dataType: 'string',
                    required: false,
                    defaultValue: 'professional'
                },
                {
                    id: 'audience',
                    name: 'Target Audience',
                    description: 'Who is the target audience for this video',
                    type: 'text',
                    dataType: 'string',
                    required: false,
                    defaultValue: 'general'
                }
            ],
            outputs: [
                {
                    id: 'script',
                    name: 'Video Script',
                    description: 'Complete video script with scenes and timing',
                    type: 'text',
                    dataType: 'string',
                    format: 'markdown',
                    destinationType: 'next_task'
                },
                {
                    id: 'scene_breakdown',
                    name: 'Scene Breakdown',
                    description: 'Detailed breakdown of scenes with metadata',
                    type: 'data',
                    dataType: 'object',
                    format: 'json',
                    destinationType: 'next_task'
                },
                {
                    id: 'timing_guide',
                    name: 'Timing Guide',
                    description: 'Timing information for each scene',
                    type: 'data',
                    dataType: 'array',
                    format: 'json',
                    destinationType: 'next_task'
                }
            ],
            dependencies: [],
            estimatedDuration: 120000,
            complexity: 'moderate',
            canRunInParallel: false,
            requiredCapabilities: ['text_generation', 'creative_writing', 'script_formatting'],
            priority: 8,
            retryPolicy: this.getDefaultRetryPolicy(),
            validation: this.getDefaultValidation(),
            metadata: {
                category: 'content_generation',
                tags: ['video', 'script', 'creative'],
                version: '1.0.0'
            }
        });
        this.addTask({
            id: 'generate_voiceover',
            type: 'generate_audio',
            name: 'Generate Voiceover',
            description: 'Convert script text to high-quality audio narration',
            inputs: [
                {
                    id: 'script',
                    name: 'Script Text',
                    description: 'Text to be converted to speech',
                    type: 'text',
                    dataType: 'string',
                    required: true,
                    source: 'previous_task'
                },
                {
                    id: 'voice_style',
                    name: 'Voice Style',
                    description: 'Voice characteristics and style preferences',
                    type: 'parameter',
                    dataType: 'object',
                    required: false,
                    defaultValue: { gender: 'neutral', age: 'adult', accent: 'standard' }
                },
                {
                    id: 'speed',
                    name: 'Speech Speed',
                    description: 'Speed of speech (0.5-2.0)',
                    type: 'parameter',
                    dataType: 'number',
                    required: false,
                    defaultValue: 1.0
                }
            ],
            outputs: [
                {
                    id: 'audio_file',
                    name: 'Voiceover Audio',
                    description: 'Generated audio file',
                    type: 'file',
                    dataType: 'audio',
                    format: 'mp3',
                    destinationType: 'storage'
                },
                {
                    id: 'timing_data',
                    name: 'Timing Information',
                    description: 'Word-level timing information',
                    type: 'data',
                    dataType: 'array',
                    format: 'json',
                    destinationType: 'next_task'
                },
                {
                    id: 'audio_metadata',
                    name: 'Audio Metadata',
                    description: 'Technical metadata about the generated audio',
                    type: 'data',
                    dataType: 'object',
                    format: 'json',
                    destinationType: 'storage'
                }
            ],
            dependencies: [],
            estimatedDuration: 180000,
            complexity: 'simple',
            canRunInParallel: true,
            requiredCapabilities: ['text_to_speech', 'audio_generation'],
            priority: 7,
            retryPolicy: this.getDefaultRetryPolicy(),
            validation: this.getDefaultValidation(),
            metadata: {
                category: 'audio_generation',
                tags: ['audio', 'tts', 'voiceover']
            }
        });
        this.addTask({
            id: 'generate_storyboard_images',
            type: 'generate_image',
            name: 'Generate Storyboard Images',
            description: 'Create visual storyboard images from script descriptions',
            inputs: [
                {
                    id: 'scene_descriptions',
                    name: 'Scene Descriptions',
                    description: 'Detailed descriptions of each scene',
                    type: 'data',
                    dataType: 'array',
                    required: true,
                    source: 'previous_task'
                },
                {
                    id: 'style_guide',
                    name: 'Visual Style Guide',
                    description: 'Visual style and aesthetic preferences',
                    type: 'parameter',
                    dataType: 'object',
                    required: false,
                    defaultValue: { style: 'realistic', mood: 'professional', color_palette: 'neutral' }
                },
                {
                    id: 'resolution',
                    name: 'Image Resolution',
                    description: 'Desired resolution for generated images',
                    type: 'parameter',
                    dataType: 'object',
                    required: false,
                    defaultValue: { width: 1920, height: 1080 }
                }
            ],
            outputs: [
                {
                    id: 'storyboard_images',
                    name: 'Storyboard Images',
                    description: 'Generated images for each scene',
                    type: 'file',
                    dataType: 'image',
                    format: 'png',
                    destinationType: 'storage'
                },
                {
                    id: 'image_metadata',
                    name: 'Image Generation Metadata',
                    description: 'Metadata about generated images',
                    type: 'data',
                    dataType: 'array',
                    format: 'json',
                    destinationType: 'next_task'
                }
            ],
            dependencies: [],
            estimatedDuration: 300000,
            complexity: 'complex',
            canRunInParallel: true,
            requiredCapabilities: ['image_generation', 'ai_models', 'style_transfer'],
            priority: 6,
            retryPolicy: this.getDefaultRetryPolicy(),
            validation: this.getDefaultValidation(),
            metadata: {
                category: 'image_generation',
                tags: ['image', 'storyboard', 'ai', 'generation']
            }
        });
        this.addTask({
            id: 'generate_code_snippet',
            type: 'generate_code',
            name: 'Generate Code Snippet',
            description: 'Generate code snippets based on requirements',
            inputs: [
                {
                    id: 'requirements',
                    name: 'Code Requirements',
                    description: 'Description of what the code should do',
                    type: 'text',
                    dataType: 'string',
                    required: true
                },
                {
                    id: 'language',
                    name: 'Programming Language',
                    description: 'Target programming language',
                    type: 'parameter',
                    dataType: 'string',
                    required: true,
                    defaultValue: 'javascript'
                },
                {
                    id: 'style_preferences',
                    name: 'Code Style',
                    description: 'Coding style and conventions',
                    type: 'parameter',
                    dataType: 'object',
                    required: false
                }
            ],
            outputs: [
                {
                    id: 'code',
                    name: 'Generated Code',
                    description: 'The generated code snippet',
                    type: 'text',
                    dataType: 'string',
                    format: 'code',
                    destinationType: 'display'
                },
                {
                    id: 'documentation',
                    name: 'Code Documentation',
                    description: 'Documentation for the generated code',
                    type: 'text',
                    dataType: 'string',
                    format: 'markdown',
                    destinationType: 'display'
                }
            ],
            dependencies: [],
            estimatedDuration: 60000,
            complexity: 'moderate',
            canRunInParallel: true,
            requiredCapabilities: ['code_generation', 'programming_languages'],
            priority: 7,
            retryPolicy: this.getDefaultRetryPolicy(),
            validation: this.getDefaultValidation(),
            metadata: {
                category: 'code_generation',
                tags: ['code', 'programming', 'automation']
            }
        });
    }
    static initializeProcessingTasks() {
        this.addTask({
            id: 'edit_video_composite',
            type: 'edit_video',
            name: 'Composite Video Elements',
            description: 'Combine visual elements, audio, and timing into final video',
            inputs: [
                {
                    id: 'visual_elements',
                    name: 'Visual Elements',
                    description: 'Images, video clips, or graphics to composite',
                    type: 'file',
                    dataType: 'media',
                    required: true,
                    source: 'previous_task'
                },
                {
                    id: 'audio_track',
                    name: 'Audio Track',
                    description: 'Background music, voiceover, or sound effects',
                    type: 'file',
                    dataType: 'audio',
                    required: true,
                    source: 'previous_task'
                },
                {
                    id: 'timing_data',
                    name: 'Timing Data',
                    description: 'Synchronization and timing information',
                    type: 'data',
                    dataType: 'object',
                    required: true,
                    source: 'previous_task'
                },
                {
                    id: 'transitions',
                    name: 'Transition Effects',
                    description: 'Video transition specifications',
                    type: 'parameter',
                    dataType: 'array',
                    required: false,
                    defaultValue: []
                }
            ],
            outputs: [
                {
                    id: 'final_video',
                    name: 'Final Video',
                    description: 'Rendered composite video',
                    type: 'file',
                    dataType: 'video',
                    format: 'mp4',
                    destinationType: 'display'
                },
                {
                    id: 'render_log',
                    name: 'Render Log',
                    description: 'Detailed rendering information and statistics',
                    type: 'data',
                    dataType: 'object',
                    format: 'json',
                    destinationType: 'storage'
                }
            ],
            dependencies: [],
            estimatedDuration: 600000,
            complexity: 'complex',
            canRunInParallel: false,
            requiredCapabilities: ['video_editing', 'ffmpeg', 'compositing', 'rendering'],
            priority: 9,
            retryPolicy: {
                maxRetries: 2,
                backoffStrategy: 'exponential',
                baseDelay: 5000,
                maxDelay: 60000,
                retryableErrors: ['rendering_error', 'memory_error', 'timeout']
            },
            validation: this.getDefaultValidation(),
            metadata: {
                category: 'video_processing',
                tags: ['video', 'editing', 'compositing', 'rendering']
            }
        });
        this.addTask({
            id: 'enhance_image_quality',
            type: 'edit_image',
            name: 'Enhance Image Quality',
            description: 'Improve image quality through various enhancement techniques',
            inputs: [
                {
                    id: 'source_image',
                    name: 'Source Image',
                    description: 'Image to be enhanced',
                    type: 'file',
                    dataType: 'image',
                    required: true,
                    source: 'user_upload'
                },
                {
                    id: 'enhancement_options',
                    name: 'Enhancement Options',
                    description: 'Specific enhancement techniques to apply',
                    type: 'parameter',
                    dataType: 'object',
                    required: false,
                    defaultValue: {
                        denoise: true,
                        sharpen: true,
                        color_correct: true,
                        upscale: false
                    }
                }
            ],
            outputs: [
                {
                    id: 'enhanced_image',
                    name: 'Enhanced Image',
                    description: 'Quality-enhanced image',
                    type: 'file',
                    dataType: 'image',
                    format: 'png',
                    destinationType: 'display'
                },
                {
                    id: 'enhancement_report',
                    name: 'Enhancement Report',
                    description: 'Details about applied enhancements',
                    type: 'data',
                    dataType: 'object',
                    format: 'json',
                    destinationType: 'storage'
                }
            ],
            dependencies: [],
            estimatedDuration: 45000,
            complexity: 'moderate',
            canRunInParallel: true,
            requiredCapabilities: ['image_processing', 'opencv', 'ai_enhancement'],
            priority: 6,
            retryPolicy: this.getDefaultRetryPolicy(),
            validation: this.getDefaultValidation(),
            metadata: {
                category: 'image_processing',
                tags: ['image', 'enhancement', 'quality', 'processing']
            }
        });
        this.addTask({
            id: 'enhance_audio_quality',
            type: 'edit_audio',
            name: 'Enhance Audio Quality',
            description: 'Improve audio quality through noise reduction and enhancement',
            inputs: [
                {
                    id: 'source_audio',
                    name: 'Source Audio',
                    description: 'Audio file to be enhanced',
                    type: 'file',
                    dataType: 'audio',
                    required: true,
                    source: 'user_upload'
                },
                {
                    id: 'enhancement_settings',
                    name: 'Enhancement Settings',
                    description: 'Audio enhancement configuration',
                    type: 'parameter',
                    dataType: 'object',
                    required: false,
                    defaultValue: {
                        noise_reduction: 0.5,
                        normalize: true,
                        eq_preset: 'voice'
                    }
                }
            ],
            outputs: [
                {
                    id: 'enhanced_audio',
                    name: 'Enhanced Audio',
                    description: 'Quality-enhanced audio file',
                    type: 'file',
                    dataType: 'audio',
                    format: 'mp3',
                    destinationType: 'display'
                }
            ],
            dependencies: [],
            estimatedDuration: 90000,
            complexity: 'moderate',
            canRunInParallel: true,
            requiredCapabilities: ['audio_processing', 'noise_reduction', 'audio_enhancement'],
            priority: 6,
            retryPolicy: this.getDefaultRetryPolicy(),
            validation: this.getDefaultValidation(),
            metadata: {
                category: 'audio_processing',
                tags: ['audio', 'enhancement', 'noise_reduction']
            }
        });
    }
    static initializeAnalysisTasks() {
        this.addTask({
            id: 'analyze_document_content',
            type: 'analyze_content',
            name: 'Analyze Document Content',
            description: 'Comprehensive analysis of document content, structure, and insights',
            inputs: [
                {
                    id: 'document',
                    name: 'Document',
                    description: 'Document to analyze',
                    type: 'file',
                    dataType: 'document',
                    required: true,
                    source: 'user_upload'
                },
                {
                    id: 'analysis_depth',
                    name: 'Analysis Depth',
                    description: 'Level of analysis detail',
                    type: 'parameter',
                    dataType: 'string',
                    required: false,
                    defaultValue: 'standard'
                }
            ],
            outputs: [
                {
                    id: 'content_summary',
                    name: 'Content Summary',
                    description: 'Executive summary of document content',
                    type: 'text',
                    dataType: 'string',
                    format: 'markdown',
                    destinationType: 'display'
                },
                {
                    id: 'key_insights',
                    name: 'Key Insights',
                    description: 'Important insights and findings',
                    type: 'data',
                    dataType: 'array',
                    format: 'json',
                    destinationType: 'display'
                },
                {
                    id: 'entity_extraction',
                    name: 'Named Entities',
                    description: 'Extracted named entities (people, places, organizations)',
                    type: 'data',
                    dataType: 'array',
                    format: 'json',
                    destinationType: 'next_task'
                },
                {
                    id: 'sentiment_analysis',
                    name: 'Sentiment Analysis',
                    description: 'Overall sentiment and emotional tone',
                    type: 'data',
                    dataType: 'object',
                    format: 'json',
                    destinationType: 'display'
                }
            ],
            dependencies: [],
            estimatedDuration: 120000,
            complexity: 'complex',
            canRunInParallel: true,
            requiredCapabilities: ['nlp', 'content_analysis', 'named_entity_recognition', 'sentiment_analysis'],
            priority: 8,
            retryPolicy: this.getDefaultRetryPolicy(),
            validation: this.getDefaultValidation(),
            metadata: {
                category: 'content_analysis',
                tags: ['analysis', 'nlp', 'document', 'insights']
            }
        });
        this.addTask({
            id: 'analyze_image_content',
            type: 'analyze_content',
            name: 'Analyze Image Content',
            description: 'Comprehensive analysis of image content, objects, and context',
            inputs: [
                {
                    id: 'image',
                    name: 'Image',
                    description: 'Image to analyze',
                    type: 'file',
                    dataType: 'image',
                    required: true,
                    source: 'user_upload'
                },
                {
                    id: 'analysis_types',
                    name: 'Analysis Types',
                    description: 'Types of analysis to perform',
                    type: 'parameter',
                    dataType: 'array',
                    required: false,
                    defaultValue: ['objects', 'faces', 'text', 'scene']
                }
            ],
            outputs: [
                {
                    id: 'objects_detected',
                    name: 'Detected Objects',
                    description: 'Objects found in the image',
                    type: 'data',
                    dataType: 'array',
                    format: 'json',
                    destinationType: 'display'
                },
                {
                    id: 'scene_description',
                    name: 'Scene Description',
                    description: 'Natural language description of the scene',
                    type: 'text',
                    dataType: 'string',
                    format: 'plain',
                    destinationType: 'display'
                },
                {
                    id: 'image_metadata',
                    name: 'Image Metadata',
                    description: 'Technical and contextual metadata',
                    type: 'data',
                    dataType: 'object',
                    format: 'json',
                    destinationType: 'storage'
                }
            ],
            dependencies: [],
            estimatedDuration: 60000,
            complexity: 'moderate',
            canRunInParallel: true,
            requiredCapabilities: ['computer_vision', 'object_detection', 'scene_understanding'],
            priority: 7,
            retryPolicy: this.getDefaultRetryPolicy(),
            validation: this.getDefaultValidation(),
            metadata: {
                category: 'image_analysis',
                tags: ['image', 'computer_vision', 'object_detection']
            }
        });
    }
    static initializeTransformationTasks() {
        this.addTask({
            id: 'convert_media_format',
            type: 'convert_format',
            name: 'Convert Media Format',
            description: 'Convert media files between different formats',
            inputs: [
                {
                    id: 'source_file',
                    name: 'Source File',
                    description: 'File to convert',
                    type: 'file',
                    dataType: 'media',
                    required: true,
                    source: 'user_upload'
                },
                {
                    id: 'target_format',
                    name: 'Target Format',
                    description: 'Desired output format',
                    type: 'parameter',
                    dataType: 'string',
                    required: true
                },
                {
                    id: 'quality_settings',
                    name: 'Quality Settings',
                    description: 'Quality and compression settings',
                    type: 'parameter',
                    dataType: 'object',
                    required: false,
                    defaultValue: { quality: 'high', compression: 'balanced' }
                }
            ],
            outputs: [
                {
                    id: 'converted_file',
                    name: 'Converted File',
                    description: 'File in the new format',
                    type: 'file',
                    dataType: 'media',
                    format: 'variable',
                    destinationType: 'download'
                },
                {
                    id: 'conversion_report',
                    name: 'Conversion Report',
                    description: 'Details about the conversion process',
                    type: 'data',
                    dataType: 'object',
                    format: 'json',
                    destinationType: 'storage'
                }
            ],
            dependencies: [],
            estimatedDuration: 120000,
            complexity: 'simple',
            canRunInParallel: true,
            requiredCapabilities: ['format_conversion', 'ffmpeg', 'media_processing'],
            priority: 5,
            retryPolicy: this.getDefaultRetryPolicy(),
            validation: this.getDefaultValidation(),
            metadata: {
                category: 'format_conversion',
                tags: ['conversion', 'format', 'media']
            }
        });
        this.addTask({
            id: 'transform_data_structure',
            type: 'process_data',
            name: 'Transform Data Structure',
            description: 'Transform data from one structure to another',
            inputs: [
                {
                    id: 'source_data',
                    name: 'Source Data',
                    description: 'Data to transform',
                    type: 'data',
                    dataType: 'object',
                    required: true,
                    source: 'previous_task'
                },
                {
                    id: 'transformation_rules',
                    name: 'Transformation Rules',
                    description: 'Rules for data transformation',
                    type: 'parameter',
                    dataType: 'object',
                    required: true
                }
            ],
            outputs: [
                {
                    id: 'transformed_data',
                    name: 'Transformed Data',
                    description: 'Data in the new structure',
                    type: 'data',
                    dataType: 'object',
                    format: 'json',
                    destinationType: 'next_task'
                }
            ],
            dependencies: [],
            estimatedDuration: 30000,
            complexity: 'simple',
            canRunInParallel: true,
            requiredCapabilities: ['data_processing', 'transformation'],
            priority: 4,
            retryPolicy: this.getDefaultRetryPolicy(),
            validation: this.getDefaultValidation(),
            metadata: {
                category: 'data_transformation',
                tags: ['data', 'transformation', 'structure']
            }
        });
    }
    static initializeCoordinationTasks() {
        this.addTask({
            id: 'coordinate_parallel_execution',
            type: 'coordinate_tasks',
            name: 'Coordinate Parallel Execution',
            description: 'Coordinate and synchronize parallel task execution',
            inputs: [
                {
                    id: 'task_list',
                    name: 'Task List',
                    description: 'List of tasks to coordinate',
                    type: 'data',
                    dataType: 'array',
                    required: true,
                    source: 'previous_task'
                },
                {
                    id: 'coordination_strategy',
                    name: 'Coordination Strategy',
                    description: 'Strategy for coordinating tasks',
                    type: 'parameter',
                    dataType: 'string',
                    required: false,
                    defaultValue: 'wait_all'
                }
            ],
            outputs: [
                {
                    id: 'coordination_status',
                    name: 'Coordination Status',
                    description: 'Status of coordinated tasks',
                    type: 'data',
                    dataType: 'object',
                    format: 'json',
                    destinationType: 'next_task'
                }
            ],
            dependencies: [],
            estimatedDuration: 5000,
            complexity: 'simple',
            canRunInParallel: false,
            requiredCapabilities: ['task_coordination', 'synchronization'],
            priority: 3,
            retryPolicy: this.getDefaultRetryPolicy(),
            validation: this.getDefaultValidation(),
            metadata: {
                category: 'coordination',
                tags: ['coordination', 'parallel', 'synchronization']
            }
        });
        this.addTask({
            id: 'aggregate_results',
            type: 'aggregate_results',
            name: 'Aggregate Task Results',
            description: 'Combine and aggregate results from multiple tasks',
            inputs: [
                {
                    id: 'result_list',
                    name: 'Result List',
                    description: 'List of results to aggregate',
                    type: 'data',
                    dataType: 'array',
                    required: true,
                    source: 'previous_task'
                },
                {
                    id: 'aggregation_method',
                    name: 'Aggregation Method',
                    description: 'Method for aggregating results',
                    type: 'parameter',
                    dataType: 'string',
                    required: false,
                    defaultValue: 'merge'
                }
            ],
            outputs: [
                {
                    id: 'aggregated_result',
                    name: 'Aggregated Result',
                    description: 'Combined result from all inputs',
                    type: 'data',
                    dataType: 'object',
                    format: 'json',
                    destinationType: 'display'
                }
            ],
            dependencies: [],
            estimatedDuration: 10000,
            complexity: 'simple',
            canRunInParallel: false,
            requiredCapabilities: ['data_aggregation', 'result_processing'],
            priority: 4,
            retryPolicy: this.getDefaultRetryPolicy(),
            validation: this.getDefaultValidation(),
            metadata: {
                category: 'aggregation',
                tags: ['aggregation', 'results', 'combining']
            }
        });
    }
    static initializeOutputTasks() {
        this.addTask({
            id: 'validate_final_output',
            type: 'validate_output',
            name: 'Validate Final Output',
            description: 'Validate that all outputs meet quality and specification requirements',
            inputs: [
                {
                    id: 'outputs',
                    name: 'Outputs to Validate',
                    description: 'All outputs from previous tasks',
                    type: 'data',
                    dataType: 'array',
                    required: true,
                    source: 'previous_task'
                },
                {
                    id: 'validation_criteria',
                    name: 'Validation Criteria',
                    description: 'Criteria for validation',
                    type: 'parameter',
                    dataType: 'object',
                    required: false,
                    defaultValue: { quality_threshold: 0.8, completeness_check: true }
                }
            ],
            outputs: [
                {
                    id: 'validation_report',
                    name: 'Validation Report',
                    description: 'Detailed validation results',
                    type: 'data',
                    dataType: 'object',
                    format: 'json',
                    destinationType: 'display'
                },
                {
                    id: 'validated_outputs',
                    name: 'Validated Outputs',
                    description: 'Outputs that passed validation',
                    type: 'data',
                    dataType: 'array',
                    format: 'json',
                    destinationType: 'next_task'
                }
            ],
            dependencies: [],
            estimatedDuration: 15000,
            complexity: 'simple',
            canRunInParallel: false,
            requiredCapabilities: ['output_validation', 'quality_assurance'],
            priority: 9,
            retryPolicy: this.getDefaultRetryPolicy(),
            validation: this.getDefaultValidation(),
            metadata: {
                category: 'validation',
                tags: ['validation', 'quality', 'output']
            }
        });
        this.addTask({
            id: 'display_results',
            type: 'display_result',
            name: 'Display Results',
            description: 'Format and display final results to the user',
            inputs: [
                {
                    id: 'results',
                    name: 'Results to Display',
                    description: 'Final results from workflow',
                    type: 'data',
                    dataType: 'array',
                    required: true,
                    source: 'previous_task'
                },
                {
                    id: 'display_format',
                    name: 'Display Format',
                    description: 'How to format the display',
                    type: 'parameter',
                    dataType: 'string',
                    required: false,
                    defaultValue: 'interactive'
                }
            ],
            outputs: [
                {
                    id: 'formatted_display',
                    name: 'Formatted Display',
                    description: 'User-friendly display of results',
                    type: 'data',
                    dataType: 'object',
                    format: 'html',
                    destinationType: 'display'
                }
            ],
            dependencies: [],
            estimatedDuration: 5000,
            complexity: 'trivial',
            canRunInParallel: false,
            requiredCapabilities: ['result_formatting', 'ui_generation'],
            priority: 2,
            retryPolicy: this.getDefaultRetryPolicy(),
            validation: this.getDefaultValidation(),
            metadata: {
                category: 'output',
                tags: ['display', 'formatting', 'ui']
            }
        });
        this.addTask({
            id: 'export_results',
            type: 'export_data',
            name: 'Export Results',
            description: 'Export workflow results in various formats',
            inputs: [
                {
                    id: 'results',
                    name: 'Results to Export',
                    description: 'Data to export',
                    type: 'data',
                    dataType: 'array',
                    required: true,
                    source: 'previous_task'
                },
                {
                    id: 'export_format',
                    name: 'Export Format',
                    description: 'Desired export format',
                    type: 'parameter',
                    dataType: 'string',
                    required: true,
                    defaultValue: 'json'
                },
                {
                    id: 'export_options',
                    name: 'Export Options',
                    description: 'Additional export configuration',
                    type: 'parameter',
                    dataType: 'object',
                    required: false,
                    defaultValue: { include_metadata: true, compress: false }
                }
            ],
            outputs: [
                {
                    id: 'exported_file',
                    name: 'Exported File',
                    description: 'Exported results file',
                    type: 'file',
                    dataType: 'data',
                    format: 'variable',
                    destinationType: 'download'
                }
            ],
            dependencies: [],
            estimatedDuration: 20000,
            complexity: 'simple',
            canRunInParallel: true,
            requiredCapabilities: ['data_export', 'file_generation'],
            priority: 3,
            retryPolicy: this.getDefaultRetryPolicy(),
            validation: this.getDefaultValidation(),
            metadata: {
                category: 'export',
                tags: ['export', 'file', 'download']
            }
        });
    }
    static initializeCustomTemplates() {
        this.customTemplates.set('video_creation_template', {
            id: 'video_creation_template',
            name: 'Video Creation Template',
            description: 'Template for creating videos from text descriptions',
            category: 'video_production',
            template: {
                type: 'generate_video',
                complexity: 'complex',
                canRunInParallel: false,
                requiredCapabilities: ['video_generation', 'script_writing', 'audio_generation'],
                estimatedDuration: 300000
            },
            customizationOptions: [
                {
                    field: 'duration',
                    type: 'number',
                    default: 60,
                    description: 'Video duration in seconds'
                },
                {
                    field: 'style',
                    type: 'select',
                    options: ['professional', 'casual', 'educational', 'entertainment'],
                    default: 'professional',
                    description: 'Video style and tone'
                },
                {
                    field: 'quality',
                    type: 'select',
                    options: ['draft', 'standard', 'high', 'premium'],
                    default: 'standard',
                    description: 'Output quality level'
                }
            ],
            examples: [
                {
                    name: 'Educational Video',
                    description: 'Create an educational video about a specific topic',
                    inputs: {
                        topic: 'Machine Learning Basics',
                        duration: 300,
                        style: 'educational'
                    },
                    expectedOutputs: {
                        video: 'Educational video file',
                        transcript: 'Video transcript',
                        summary: 'Content summary'
                    }
                }
            ]
        });
        this.customTemplates.set('document_analysis_template', {
            id: 'document_analysis_template',
            name: 'Document Analysis Template',
            description: 'Template for comprehensive document analysis',
            category: 'document_processing',
            template: {
                type: 'analyze_content',
                complexity: 'moderate',
                canRunInParallel: true,
                requiredCapabilities: ['nlp', 'document_processing', 'content_analysis'],
                estimatedDuration: 120000
            },
            customizationOptions: [
                {
                    field: 'analysis_depth',
                    type: 'select',
                    options: ['basic', 'standard', 'comprehensive', 'expert'],
                    default: 'standard',
                    description: 'Depth of analysis to perform'
                },
                {
                    field: 'output_format',
                    type: 'select',
                    options: ['summary', 'detailed_report', 'structured_data'],
                    default: 'summary',
                    description: 'Format of analysis output'
                }
            ],
            examples: [
                {
                    name: 'Research Paper Analysis',
                    description: 'Analyze a research paper for key insights',
                    inputs: {
                        document: 'research_paper.pdf',
                        analysis_depth: 'comprehensive'
                    },
                    expectedOutputs: {
                        summary: 'Executive summary',
                        key_findings: 'Important findings',
                        references: 'Extracted references'
                    }
                }
            ]
        });
    }
    static addTask(task) {
        this.taskTemplates.set(task.id, task);
    }
    static cloneTask(task) {
        return JSON.parse(JSON.stringify(task));
    }
    static matchesCriteria(task, criteria) {
        if (criteria.type && task.type !== criteria.type)
            return false;
        if (criteria.complexity && task.complexity !== criteria.complexity)
            return false;
        if (criteria.maxDuration && task.estimatedDuration > criteria.maxDuration)
            return false;
        if (criteria.capabilities && criteria.capabilities.length > 0) {
            const hasRequiredCapabilities = criteria.capabilities.every(cap => task.requiredCapabilities.includes(cap));
            if (!hasRequiredCapabilities)
                return false;
        }
        if (criteria.tags && criteria.tags.length > 0) {
            const taskTags = task.metadata?.tags || [];
            const hasRequiredTags = criteria.tags.some(tag => taskTags.includes(tag));
            if (!hasRequiredTags)
                return false;
        }
        if (criteria.inputTypes && criteria.inputTypes.length > 0) {
            const hasCompatibleInputs = criteria.inputTypes.some(inputType => task.inputs.some(input => input.dataType === inputType));
            if (!hasCompatibleInputs)
                return false;
        }
        if (criteria.outputTypes && criteria.outputTypes.length > 0) {
            const hasCompatibleOutputs = criteria.outputTypes.some(outputType => task.outputs.some(output => output.dataType === outputType));
            if (!hasCompatibleOutputs)
                return false;
        }
        if (criteria.textSearch) {
            const searchText = criteria.textSearch.toLowerCase();
            const taskText = `${task.name} ${task.description}`.toLowerCase();
            if (!taskText.includes(searchText))
                return false;
        }
        return true;
    }
    static sortSearchResults(results, criteria) {
        return results.sort((a, b) => {
            let scoreA = a.priority;
            let scoreB = b.priority;
            if (criteria.type === a.type)
                scoreA += 10;
            if (criteria.type === b.type)
                scoreB += 10;
            if (!criteria.complexity) {
                const complexityScore = { trivial: 4, simple: 3, moderate: 2, complex: 1 };
                scoreA += complexityScore[a.complexity] || 0;
                scoreB += complexityScore[b.complexity] || 0;
            }
            return scoreB - scoreA;
        });
    }
    static areCompatibleTypes(outputType, inputType) {
        if (outputType === inputType)
            return true;
        const compatibilityMap = {
            'string': ['text', 'string'],
            'object': ['data', 'object', 'json'],
            'array': ['data', 'array', 'list'],
            'image': ['media', 'image', 'file'],
            'audio': ['media', 'audio', 'file'],
            'video': ['media', 'video', 'file'],
            'document': ['media', 'document', 'file'],
            'file': ['media', 'file']
        };
        const compatibleTypes = compatibilityMap[outputType] || [];
        return compatibleTypes.includes(inputType);
    }
    static generateTaskId() {
        return `custom_task_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    }
    static getDefaultRetryPolicy() {
        return {
            maxRetries: 3,
            backoffStrategy: 'exponential',
            baseDelay: 2000,
            maxDelay: 30000,
            retryableErrors: ['network_error', 'timeout', 'rate_limit', 'temporary_failure']
        };
    }
    static getDefaultValidation() {
        return {
            inputValidation: [],
            outputValidation: [],
            businessRules: [],
            qualityChecks: []
        };
    }
    static getCategoryForTask(task) {
        return task.metadata?.category || 'general';
    }
}
exports.TaskLibrary = TaskLibrary;
_a = TaskLibrary;
TaskLibrary.taskTemplates = new Map();
TaskLibrary.customTemplates = new Map();
(() => {
    _a.initializeLibrary();
})();
exports.default = TaskLibrary;
//# sourceMappingURL=taskLibrary.js.map