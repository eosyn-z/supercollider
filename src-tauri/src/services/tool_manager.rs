use crate::models::tool::{Tool, ToolCategory, ToolCapability, ToolExecution, ToolExecutionResult};
use anyhow::{Context, Result};
use parking_lot::RwLock;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::process::Command as AsyncCommand;
use which::which;

pub struct ToolManager {
    tools: Arc<RwLock<HashMap<String, Tool>>>,
    tool_paths: Arc<RwLock<HashMap<String, PathBuf>>>,
    capability_mapping: Arc<RwLock<HashMap<String, Vec<String>>>>,
    base_path: PathBuf,
}

impl ToolManager {
    pub fn new(base_path: PathBuf) -> Result<Self> {
        let mut manager = Self {
            tools: Arc::new(RwLock::new(HashMap::new())),
            tool_paths: Arc::new(RwLock::new(HashMap::new())),
            capability_mapping: Arc::new(RwLock::new(HashMap::new())),
            base_path,
        };
        
        // Load default tools
        manager.initialize_default_tools()?;
        
        // Auto-detect installed tools
        manager.detect_installed_tools();
        
        Ok(manager)
    }
    
    /// Initialize default tool configurations
    fn initialize_default_tools(&mut self) -> Result<()> {
        let default_tools = vec![
            Tool::ffmpeg(),
            Tool::blender(),
            Tool::imagemagick(),
            Tool::pandoc(),
        ];
        
        let mut tools = self.tools.write();
        for tool in default_tools {
            tools.insert(tool.id.clone(), tool);
        }
        
        // Load additional tools from JSON file if it exists
        let tools_file = self.base_path.join("TOOLS").join("tool_definitions.json");
        if tools_file.exists() {
            let content = std::fs::read_to_string(&tools_file)?;
            if let Ok(tool_defs) = serde_json::from_str::<serde_json::Value>(&content) {
                if let Some(tools_array) = tool_defs["tools"].as_array() {
                    for tool_json in tools_array {
                        if let Ok(tool) = serde_json::from_value::<Tool>(tool_json.clone()) {
                            tools.insert(tool.id.clone(), tool);
                        }
                    }
                }
                
                // Load capability mappings
                if let Some(mapping) = tool_defs["capability_tool_mapping"].as_object() {
                    let mut capability_mapping = self.capability_mapping.write();
                    for (capability, tool_list) in mapping {
                        if let Some(tools) = tool_list.as_array() {
                            let tool_ids: Vec<String> = tools
                                .iter()
                                .filter_map(|t| t.as_str().map(|s| s.to_string()))
                                .collect();
                            capability_mapping.insert(capability.clone(), tool_ids);
                        }
                    }
                }
            }
        }
        
        Ok(())
    }
    
    /// Auto-detect installed tools on the system
    pub fn detect_installed_tools(&mut self) {
        let mut tools = self.tools.write();
        let mut tool_paths = self.tool_paths.write();
        
        for (id, tool) in tools.iter_mut() {
            // Try to find the executable
            let executable_name = self.get_platform_executable_name(tool);
            
            if let Ok(path) = which(&executable_name) {
                tool.executable_path = Some(path.clone());
                tool.is_available = true;
                tool_paths.insert(id.clone(), path);
                
                // Try to get version
                if let Some(version_cmd) = &tool.validation_command {
                    if let Ok(output) = Command::new(&path)
                        .arg(version_cmd)
                        .output()
                    {
                        let version_str = String::from_utf8_lossy(&output.stdout);
                        // Simple version extraction (can be improved per tool)
                        if let Some(version) = self.extract_version(&version_str) {
                            tool.version = Some(version);
                        }
                    }
                }
            } else {
                // Try platform-specific path hints
                if let Some(platform_config) = tool.platform_specific.get(std::env::consts::OS) {
                    for hint in &platform_config.path_hints {
                        let expanded = self.expand_path(hint);
                        if expanded.exists() {
                            tool.executable_path = Some(expanded.clone());
                            tool.is_available = true;
                            tool_paths.insert(id.clone(), expanded);
                            break;
                        }
                    }
                }
            }
        }
    }
    
    /// Get tools that can handle a specific capability
    pub fn get_tools_for_capability(&self, capability: &str) -> Vec<Tool> {
        let tools = self.tools.read();
        let capability_mapping = self.capability_mapping.read();
        
        let mut matching_tools = Vec::new();
        
        // Check direct capability mapping first
        if let Some(tool_ids) = capability_mapping.get(capability) {
            for tool_id in tool_ids {
                if let Some(tool) = tools.get(tool_id) {
                    if tool.is_available {
                        matching_tools.push(tool.clone());
                    }
                }
            }
        }
        
        // Also check tool capabilities directly
        for tool in tools.values() {
            if tool.is_available {
                // Check if capability string matches
                for cap in &tool.capabilities {
                    if format!("{:?}", cap).to_lowercase().contains(&capability.to_lowercase()) {
                        if !matching_tools.iter().any(|t| t.id == tool.id) {
                            matching_tools.push(tool.clone());
                        }
                        break;
                    }
                }
            }
        }
        
        matching_tools
    }
    
    /// Get tools that cannot process a specific type
    pub fn get_incompatible_tools(&self, content_type: &str) -> Vec<String> {
        let tools = self.tools.read();
        let mut incompatible = Vec::new();
        
        for tool in tools.values() {
            // Check if this tool explicitly cannot process this content type
            let cannot_process = match content_type {
                "text" => !tool.capabilities.iter().any(|c| matches!(c, 
                    ToolCapability::DocumentConvert | 
                    ToolCapability::DocumentRender
                )),
                "code" => !tool.capabilities.iter().any(|c| matches!(c,
                    ToolCapability::CodeCompile |
                    ToolCapability::CodeTranspile |
                    ToolCapability::CodeLint |
                    ToolCapability::CodeFormat |
                    ToolCapability::CodeTest
                )),
                "video" => !tool.capabilities.iter().any(|c| matches!(c,
                    ToolCapability::VideoEncode |
                    ToolCapability::VideoDecode |
                    ToolCapability::VideoTranscode |
                    ToolCapability::VideoEdit
                )),
                "image" => !tool.capabilities.iter().any(|c| matches!(c,
                    ToolCapability::ImageResize |
                    ToolCapability::ImageConvert |
                    ToolCapability::ImageFilter |
                    ToolCapability::ImageComposite
                )),
                "sound" => !tool.capabilities.iter().any(|c| matches!(c,
                    ToolCapability::AudioEncode |
                    ToolCapability::AudioDecode |
                    ToolCapability::AudioMix |
                    ToolCapability::AudioEffects
                )),
                "3d" => !tool.capabilities.iter().any(|c| matches!(c,
                    ToolCapability::ThreeDRender |
                    ToolCapability::ThreeDModel |
                    ToolCapability::ThreeDAnimate
                )),
                _ => false,
            };
            
            if cannot_process {
                incompatible.push(tool.id.clone());
            }
        }
        
        incompatible
    }
    
    /// Execute a tool with given parameters
    pub async fn execute_tool(&self, execution: ToolExecution) -> Result<ToolExecutionResult> {
        let tools = self.tools.read();
        let tool = tools.get(&execution.tool_id)
            .ok_or_else(|| anyhow::anyhow!("Tool '{}' not found", execution.tool_id))?;
        
        if !tool.is_available {
            return Err(anyhow::anyhow!("Tool '{}' is not available", tool.name));
        }
        
        let executable_path = tool.executable_path.as_ref()
            .ok_or_else(|| anyhow::anyhow!("No executable path for tool '{}'", tool.name))?;
        
        let start_time = Instant::now();
        
        // Build command
        let mut cmd = AsyncCommand::new(executable_path);
        cmd.args(&execution.arguments);
        
        // Set working directory if specified
        if let Some(ref working_dir) = tool.working_directory {
            cmd.current_dir(working_dir);
        }
        
        // Set environment variables
        for (key, value) in &tool.environment_vars {
            cmd.env(key, value);
        }
        
        // Set timeout
        let timeout = execution.timeout_override
            .or(tool.timeout_seconds)
            .unwrap_or(3600);
        
        // Configure stdio
        if execution.capture_stdout {
            cmd.stdout(Stdio::piped());
        }
        if execution.capture_stderr {
            cmd.stderr(Stdio::piped());
        }
        if execution.stdin_data.is_some() {
            cmd.stdin(Stdio::piped());
        }
        
        // Execute command
        let output = tokio::time::timeout(
            Duration::from_secs(timeout),
            cmd.output()
        ).await
            .context("Command timed out")?
            .context("Failed to execute command")?;
        
        let execution_time_ms = start_time.elapsed().as_millis() as u64;
        
        // Check exit code
        let success = execution.expected_exit_codes.contains(&(output.status.code().unwrap_or(-1)))
            || (execution.expected_exit_codes.is_empty() && output.status.success());
        
        Ok(ToolExecutionResult {
            success,
            exit_code: output.status.code().unwrap_or(-1),
            stdout: String::from_utf8_lossy(&output.stdout).to_string(),
            stderr: String::from_utf8_lossy(&output.stderr).to_string(),
            output_files: execution.output_files.clone(),
            execution_time_ms,
            error_message: if !success {
                Some(format!("Tool execution failed with exit code {}", output.status.code().unwrap_or(-1)))
            } else {
                None
            },
        })
    }
    
    /// Register a new tool
    pub fn register_tool(&mut self, tool: Tool) -> Result<()> {
        let mut tools = self.tools.write();
        
        // Validate the tool
        if tool.id.is_empty() {
            return Err(anyhow::anyhow!("Tool ID cannot be empty"));
        }
        
        tools.insert(tool.id.clone(), tool);
        
        // Re-detect to check if newly registered tool is available
        drop(tools);
        self.detect_installed_tools();
        
        Ok(())
    }
    
    /// Get all registered tools
    pub fn list_tools(&self) -> Vec<Tool> {
        self.tools.read().values().cloned().collect()
    }
    
    /// Get a specific tool by ID
    pub fn get_tool(&self, tool_id: &str) -> Option<Tool> {
        self.tools.read().get(tool_id).cloned()
    }
    
    /// Check if a tool can process a specific file format
    pub fn can_process_format(&self, tool_id: &str, format: &str) -> bool {
        if let Some(tool) = self.tools.read().get(tool_id) {
            tool.input_formats.iter().any(|f| f == format || f == "*")
        } else {
            false
        }
    }
    
    /// Get recommended tool for a task type and capability
    pub fn get_recommended_tool(&self, capability: ToolCapability) -> Option<Tool> {
        let tools = self.tools.read();
        
        // Find available tools with this capability
        let mut candidates: Vec<_> = tools.values()
            .filter(|t| t.is_available && t.capabilities.contains(&capability))
            .collect();
        
        // Sort by priority (could be enhanced with user preferences)
        candidates.sort_by_key(|t| {
            // Prefer tools with fewer capabilities (more specialized)
            t.capabilities.len()
        });
        
        candidates.first().map(|t| (*t).clone())
    }
    
    // Helper methods
    
    fn get_platform_executable_name(&self, tool: &Tool) -> String {
        if let Some(platform_config) = tool.platform_specific.get(std::env::consts::OS) {
            platform_config.executable_name.clone()
        } else {
            // Default to tool ID as executable name
            if std::env::consts::OS == "windows" {
                format!("{}.exe", tool.id)
            } else {
                tool.id.clone()
            }
        }
    }
    
    fn expand_path(&self, path: &str) -> PathBuf {
        // Expand environment variables in path
        let expanded = shellexpand::env(path).unwrap_or_else(|_| path.into());
        
        // Handle wildcards (simple glob)
        if expanded.contains('*') {
            if let Ok(entries) = glob::glob(&expanded) {
                for entry in entries.flatten() {
                    if entry.exists() {
                        return entry;
                    }
                }
            }
        }
        
        PathBuf::from(expanded.as_ref())
    }
    
    fn extract_version(&self, output: &str) -> Option<String> {
        // Simple version extraction using regex
        let re = regex::Regex::new(r"(\d+\.\d+(?:\.\d+)?)")?;
        re.captures(output)
            .and_then(|cap| cap.get(1))
            .map(|m| m.as_str().to_string())
    }
}

// Tool selection logic for task execution
impl ToolManager {
    /// Select the best tool for a given task based on capabilities and availability
    pub fn select_tool_for_task(
        &self,
        required_capabilities: &[ToolCapability],
        input_format: Option<&str>,
        output_format: Option<&str>,
    ) -> Option<Tool> {
        let tools = self.tools.read();
        
        let mut candidates: Vec<_> = tools.values()
            .filter(|t| {
                // Tool must be available
                t.is_available &&
                // Tool must have all required capabilities
                required_capabilities.iter().all(|cap| t.capabilities.contains(cap)) &&
                // Tool must support input format if specified
                input_format.map_or(true, |fmt| t.input_formats.contains(&fmt.to_string()) || t.input_formats.contains(&"*".to_string())) &&
                // Tool must support output format if specified
                output_format.map_or(true, |fmt| t.output_formats.contains(&fmt.to_string()) || t.output_formats.contains(&"*".to_string()))
            })
            .collect();
        
        // Sort by suitability
        candidates.sort_by_key(|t| {
            let mut score = 0;
            
            // Prefer tools with exact capability match (not too many extra capabilities)
            score += (t.capabilities.len() - required_capabilities.len()).abs();
            
            // Prefer tools that don't require GPU if not needed
            if t.requires_gpu {
                score += 10;
            }
            
            // Prefer tools that don't require network if not needed
            if t.requires_network {
                score += 5;
            }
            
            score
        });
        
        candidates.first().map(|t| (*t).clone())
    }
}