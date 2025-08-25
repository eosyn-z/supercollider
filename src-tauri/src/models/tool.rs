use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tool {
    pub id: String,
    pub name: String,
    pub category: ToolCategory,
    pub executable_path: Option<PathBuf>,
    pub version: Option<String>,
    pub capabilities: Vec<ToolCapability>,
    pub input_formats: Vec<String>,
    pub output_formats: Vec<String>,
    pub parameters: HashMap<String, ParameterDefinition>,
    pub environment_vars: HashMap<String, String>,
    pub working_directory: Option<PathBuf>,
    pub timeout_seconds: Option<u64>,
    pub is_available: bool,
    pub requires_gpu: bool,
    pub requires_network: bool,
    pub platform_specific: HashMap<String, PlatformConfig>,
    pub validation_command: Option<String>,
    pub documentation_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ToolCategory {
    VideoProcessing,     // FFmpeg, HandBrake
    ImageProcessing,     // ImageMagick, GIMP
    AudioProcessing,     // Sox, Audacity
    ThreeDModeling,      // Blender, FreeCAD
    CodeCompilation,     // GCC, Rust, Node
    DataProcessing,      // Pandas, R
    DocumentProcessing,  // Pandoc, LaTeX
    Containerization,    // Docker, Podman
    Testing,            // Jest, Pytest
    Analysis,           // SonarQube, ESLint
    Deployment,         // Kubectl, Terraform
    Custom,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ToolCapability {
    // Video capabilities
    VideoEncode,
    VideoDecode,
    VideoTranscode,
    VideoEdit,
    VideoComposite,
    VideoEffects,
    
    // Image capabilities
    ImageResize,
    ImageConvert,
    ImageFilter,
    ImageComposite,
    ImageGenerate,
    
    // Audio capabilities
    AudioEncode,
    AudioDecode,
    AudioMix,
    AudioEffects,
    AudioSynthesize,
    
    // 3D capabilities
    ThreeDRender,
    ThreeDModel,
    ThreeDAnimate,
    ThreeDSimulate,
    
    // Code capabilities
    CodeCompile,
    CodeTranspile,
    CodeLint,
    CodeFormat,
    CodeTest,
    
    // Data capabilities
    DataTransform,
    DataAnalyze,
    DataVisualize,
    
    // Document capabilities
    DocumentConvert,
    DocumentRender,
    DocumentMerge,
    
    // General
    Execute,
    Script,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParameterDefinition {
    pub name: String,
    pub param_type: ParameterType,
    pub required: bool,
    pub default_value: Option<String>,
    pub description: String,
    pub validation: Option<ParameterValidation>,
    pub depends_on: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ParameterType {
    String,
    Integer,
    Float,
    Boolean,
    FilePath,
    DirectoryPath,
    Enum(Vec<String>),
    List(Box<ParameterType>),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParameterValidation {
    pub min_value: Option<f64>,
    pub max_value: Option<f64>,
    pub regex_pattern: Option<String>,
    pub file_extensions: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlatformConfig {
    pub executable_name: String,
    pub install_command: Option<String>,
    pub install_url: Option<String>,
    pub path_hints: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolExecution {
    pub tool_id: String,
    pub command: String,
    pub arguments: Vec<String>,
    pub input_files: Vec<PathBuf>,
    pub output_files: Vec<PathBuf>,
    pub parameters: HashMap<String, String>,
    pub stdin_data: Option<String>,
    pub expected_exit_codes: Vec<i32>,
    pub capture_stdout: bool,
    pub capture_stderr: bool,
    pub timeout_override: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolExecutionResult {
    pub success: bool,
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
    pub output_files: Vec<PathBuf>,
    pub execution_time_ms: u64,
    pub error_message: Option<String>,
}

// Predefined tool configurations
impl Tool {
    pub fn ffmpeg() -> Self {
        let mut parameters = HashMap::new();
        
        parameters.insert("input_file".to_string(), ParameterDefinition {
            name: "input_file".to_string(),
            param_type: ParameterType::FilePath,
            required: true,
            default_value: None,
            description: "Input media file".to_string(),
            validation: Some(ParameterValidation {
                min_value: None,
                max_value: None,
                regex_pattern: None,
                file_extensions: Some(vec!["mp4".to_string(), "avi".to_string(), "mov".to_string(), "mkv".to_string()]),
            }),
            depends_on: None,
        });
        
        parameters.insert("output_format".to_string(), ParameterDefinition {
            name: "output_format".to_string(),
            param_type: ParameterType::Enum(vec![
                "mp4".to_string(),
                "webm".to_string(),
                "avi".to_string(),
                "mkv".to_string(),
            ]),
            required: true,
            default_value: Some("mp4".to_string()),
            description: "Output format".to_string(),
            validation: None,
            depends_on: None,
        });
        
        let mut platform_config = HashMap::new();
        platform_config.insert("windows".to_string(), PlatformConfig {
            executable_name: "ffmpeg.exe".to_string(),
            install_command: Some("winget install ffmpeg".to_string()),
            install_url: Some("https://ffmpeg.org/download.html".to_string()),
            path_hints: vec![
                "C:\\ffmpeg\\bin".to_string(),
                "%PROGRAMFILES%\\ffmpeg\\bin".to_string(),
            ],
        });
        
        Tool {
            id: "ffmpeg".to_string(),
            name: "FFmpeg".to_string(),
            category: ToolCategory::VideoProcessing,
            executable_path: None,
            version: None,
            capabilities: vec![
                ToolCapability::VideoEncode,
                ToolCapability::VideoDecode,
                ToolCapability::VideoTranscode,
                ToolCapability::AudioEncode,
                ToolCapability::AudioDecode,
            ],
            input_formats: vec!["mp4".to_string(), "avi".to_string(), "mov".to_string(), "mkv".to_string()],
            output_formats: vec!["mp4".to_string(), "webm".to_string(), "avi".to_string(), "mkv".to_string()],
            parameters,
            environment_vars: HashMap::new(),
            working_directory: None,
            timeout_seconds: Some(3600),
            is_available: false,
            requires_gpu: false,
            requires_network: false,
            platform_specific: platform_config,
            validation_command: Some("-version".to_string()),
            documentation_url: Some("https://ffmpeg.org/documentation.html".to_string()),
        }
    }
    
    pub fn blender() -> Self {
        let mut parameters = HashMap::new();
        
        parameters.insert("blend_file".to_string(), ParameterDefinition {
            name: "blend_file".to_string(),
            param_type: ParameterType::FilePath,
            required: true,
            default_value: None,
            description: "Blender project file".to_string(),
            validation: Some(ParameterValidation {
                min_value: None,
                max_value: None,
                regex_pattern: None,
                file_extensions: Some(vec!["blend".to_string()]),
            }),
            depends_on: None,
        });
        
        parameters.insert("render_engine".to_string(), ParameterDefinition {
            name: "render_engine".to_string(),
            param_type: ParameterType::Enum(vec![
                "CYCLES".to_string(),
                "EEVEE".to_string(),
                "WORKBENCH".to_string(),
            ]),
            required: false,
            default_value: Some("EEVEE".to_string()),
            description: "Render engine to use".to_string(),
            validation: None,
            depends_on: None,
        });
        
        let mut platform_config = HashMap::new();
        platform_config.insert("windows".to_string(), PlatformConfig {
            executable_name: "blender.exe".to_string(),
            install_command: Some("winget install BlenderFoundation.Blender".to_string()),
            install_url: Some("https://www.blender.org/download/".to_string()),
            path_hints: vec![
                "C:\\Program Files\\Blender Foundation\\Blender*".to_string(),
                "%PROGRAMFILES%\\Blender Foundation\\Blender*".to_string(),
            ],
        });
        
        Tool {
            id: "blender".to_string(),
            name: "Blender".to_string(),
            category: ToolCategory::ThreeDModeling,
            executable_path: None,
            version: None,
            capabilities: vec![
                ToolCapability::ThreeDRender,
                ToolCapability::ThreeDModel,
                ToolCapability::ThreeDAnimate,
                ToolCapability::VideoEdit,
            ],
            input_formats: vec!["blend".to_string(), "obj".to_string(), "fbx".to_string(), "dae".to_string()],
            output_formats: vec!["png".to_string(), "jpg".to_string(), "exr".to_string(), "mp4".to_string()],
            parameters,
            environment_vars: HashMap::new(),
            working_directory: None,
            timeout_seconds: Some(7200),
            is_available: false,
            requires_gpu: true,
            requires_network: false,
            platform_specific: platform_config,
            validation_command: Some("--version".to_string()),
            documentation_url: Some("https://docs.blender.org/".to_string()),
        }
    }
    
    pub fn imagemagick() -> Self {
        Tool {
            id: "imagemagick".to_string(),
            name: "ImageMagick".to_string(),
            category: ToolCategory::ImageProcessing,
            executable_path: None,
            version: None,
            capabilities: vec![
                ToolCapability::ImageResize,
                ToolCapability::ImageConvert,
                ToolCapability::ImageFilter,
                ToolCapability::ImageComposite,
            ],
            input_formats: vec!["jpg".to_string(), "png".to_string(), "gif".to_string(), "tiff".to_string()],
            output_formats: vec!["jpg".to_string(), "png".to_string(), "gif".to_string(), "webp".to_string()],
            parameters: HashMap::new(),
            environment_vars: HashMap::new(),
            working_directory: None,
            timeout_seconds: Some(600),
            is_available: false,
            requires_gpu: false,
            requires_network: false,
            platform_specific: HashMap::new(),
            validation_command: Some("-version".to_string()),
            documentation_url: Some("https://imagemagick.org/".to_string()),
        }
    }
    
    pub fn pandoc() -> Self {
        Tool {
            id: "pandoc".to_string(),
            name: "Pandoc".to_string(),
            category: ToolCategory::DocumentProcessing,
            executable_path: None,
            version: None,
            capabilities: vec![
                ToolCapability::DocumentConvert,
                ToolCapability::DocumentRender,
            ],
            input_formats: vec!["md".to_string(), "rst".to_string(), "tex".to_string(), "docx".to_string()],
            output_formats: vec!["pdf".to_string(), "html".to_string(), "docx".to_string(), "epub".to_string()],
            parameters: HashMap::new(),
            environment_vars: HashMap::new(),
            working_directory: None,
            timeout_seconds: Some(300),
            is_available: false,
            requires_gpu: false,
            requires_network: false,
            platform_specific: HashMap::new(),
            validation_command: Some("--version".to_string()),
            documentation_url: Some("https://pandoc.org/".to_string()),
        }
    }
}