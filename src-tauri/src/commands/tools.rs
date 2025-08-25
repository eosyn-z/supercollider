use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolInfo {
    pub id: String,
    pub name: String,
    pub category: String,
    pub executable_path: Option<String>,
    pub version: Option<String>,
    pub capabilities: Vec<String>,
    pub input_formats: Vec<String>,
    pub output_formats: Vec<String>,
    pub is_available: bool,
    pub requires_gpu: bool,
    pub requires_network: bool,
    pub documentation_url: Option<String>,
    pub cannot_process: Option<Vec<String>>,
}

#[tauri::command]
pub fn tools_list() -> Result<serde_json::Value, String> {
    // Load tool definitions from TOOLS/tool_definitions.json
    let tools_path = std::env::current_dir()
        .unwrap_or_default()
        .join("TOOLS")
        .join("tool_definitions.json");
    
    let mut tools = Vec::new();
    
    if tools_path.exists() {
        if let Ok(content) = std::fs::read_to_string(&tools_path) {
            if let Ok(tool_defs) = serde_json::from_str::<serde_json::Value>(&content) {
                if let Some(tools_array) = tool_defs["tools"].as_array() {
                    for tool_json in tools_array {
                        if let Ok(mut tool) = serde_json::from_value::<ToolInfo>(tool_json.clone()) {
                            // Check if tool is available on the system
                            tool.is_available = check_tool_availability(&tool.id);
                            tools.push(tool);
                        }
                    }
                }
            }
        }
    }
    
    // Return empty list if no tools are defined - don't populate with defaults
    // The UI should handle empty state appropriately
    
    Ok(json!({
        "tools": tools
    }))
}

#[tauri::command]
pub fn tools_detect() -> Result<serde_json::Value, String> {
    // Detect which tools are installed on the system
    let mut detected = HashMap::new();
    
    // Check common tools
    let tools_to_check = vec![
        ("ffmpeg", vec!["ffmpeg", "ffmpeg.exe"]),
        ("blender", vec!["blender", "blender.exe"]),
        ("imagemagick", vec!["magick", "convert", "magick.exe", "convert.exe"]),
        ("pandoc", vec!["pandoc", "pandoc.exe"]),
        ("git", vec!["git", "git.exe"]),
        ("python", vec!["python", "python3", "python.exe"]),
        ("node", vec!["node", "nodejs", "node.exe"]),
    ];
    
    for (tool_id, executables) in tools_to_check {
        for exe in executables {
            if let Ok(path) = which::which(exe) {
                detected.insert(tool_id.to_string(), path.to_string_lossy().to_string());
                break;
            }
        }
    }
    
    Ok(json!({
        "detected": detected
    }))
}

#[tauri::command]
pub fn tools_validate(tool_id: String) -> Result<serde_json::Value, String> {
    // Validate that a tool is properly installed and get its version
    let version_commands = HashMap::from([
        ("ffmpeg", "ffmpeg -version"),
        ("blender", "blender --version"),
        ("imagemagick", "magick -version"),
        ("pandoc", "pandoc --version"),
        ("git", "git --version"),
        ("python", "python --version"),
        ("node", "node --version"),
    ]);
    
    if let Some(cmd) = version_commands.get(tool_id.as_str()) {
        // Try to execute the version command
        if let Ok(output) = std::process::Command::new(if cfg!(windows) { "cmd" } else { "sh" })
            .arg(if cfg!(windows) { "/C" } else { "-c" })
            .arg(cmd)
            .output()
        {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let version = extract_version(&stdout);
            
            return Ok(json!({
                "valid": output.status.success(),
                "version": version
            }));
        }
    }
    
    Ok(json!({
        "valid": false,
        "version": null
    }))
}

#[tauri::command]
pub fn tools_install(tool_id: String) -> Result<serde_json::Value, String> {
    // Provide installation instructions for a tool
    let install_instructions = HashMap::from([
        ("ffmpeg", InstallInfo {
            windows: "winget install ffmpeg",
            macos: "brew install ffmpeg",
            linux: "sudo apt install ffmpeg",
            url: "https://ffmpeg.org/download.html",
        }),
        ("blender", InstallInfo {
            windows: "winget install BlenderFoundation.Blender",
            macos: "brew install --cask blender",
            linux: "sudo snap install blender --classic",
            url: "https://www.blender.org/download/",
        }),
        ("imagemagick", InstallInfo {
            windows: "winget install ImageMagick.ImageMagick",
            macos: "brew install imagemagick",
            linux: "sudo apt install imagemagick",
            url: "https://imagemagick.org/script/download.php",
        }),
        ("pandoc", InstallInfo {
            windows: "winget install JohnMacFarlane.Pandoc",
            macos: "brew install pandoc",
            linux: "sudo apt install pandoc",
            url: "https://pandoc.org/installing.html",
        }),
    ]);
    
    if let Some(info) = install_instructions.get(tool_id.as_str()) {
        let command = if cfg!(windows) {
            info.windows
        } else if cfg!(target_os = "macos") {
            info.macos
        } else {
            info.linux
        };
        
        Ok(json!({
            "success": true,
            "message": format!("To install {}, run: {}", tool_id, command),
            "command": command,
            "url": info.url
        }))
    } else {
        Ok(json!({
            "success": false,
            "message": format!("No installation instructions available for {}", tool_id)
        }))
    }
}

#[derive(serde::Deserialize, serde::Serialize, Debug, Clone)]
pub struct ManualToolInput {
    pub id: String,
    pub name: String,
    pub category: String,
    pub capabilities: Option<Vec<String>>,
    pub input_formats: Option<Vec<String>>,
    pub output_formats: Option<Vec<String>>,
    pub requires_gpu: Option<bool>,
    pub requires_network: Option<bool>,
}

#[tauri::command]
pub fn tools_register_manual(tool: ManualToolInput) -> Result<serde_json::Value, String> {
    // Append or upsert into TOOLS/tool_definitions.json under "tools" array
    let tools_dir = std::env::current_dir().unwrap_or_default().join("TOOLS");
    let tools_file = tools_dir.join("tool_definitions.json");
    std::fs::create_dir_all(&tools_dir).map_err(|e| e.to_string())?;

    let mut root = if tools_file.exists() {
        let content = std::fs::read_to_string(&tools_file).map_err(|e| e.to_string())?;
        serde_json::from_str::<serde_json::Value>(&content).unwrap_or(json!({ "tools": [], "capability_tool_mapping": {} }))
    } else {
        json!({ "tools": [], "capability_tool_mapping": {} })
    };

    let arr = root["tools"].as_array().cloned().unwrap_or_default();
    let mut tools_vec = arr;

    // Upsert
    let mut found = false;
    for t in tools_vec.iter_mut() {
        if t["id"].as_str() == Some(&tool.id) {
            *t = json!({
                "id": tool.id,
                "name": tool.name,
                "category": tool.category,
                "capabilities": tool.capabilities.unwrap_or_default(),
                "input_formats": tool.input_formats.unwrap_or_default(),
                "output_formats": tool.output_formats.unwrap_or_default(),
                "is_available": false,
                "requires_gpu": tool.requires_gpu.unwrap_or(false),
                "requires_network": tool.requires_network.unwrap_or(false)
            });
            found = true;
            break;
        }
    }
    if !found {
        tools_vec.push(json!({
            "id": tool.id,
            "name": tool.name,
            "category": tool.category,
            "capabilities": tool.capabilities.unwrap_or_default(),
            "input_formats": tool.input_formats.unwrap_or_default(),
            "output_formats": tool.output_formats.unwrap_or_default(),
            "is_available": false,
            "requires_gpu": tool.requires_gpu.unwrap_or(false),
            "requires_network": tool.requires_network.unwrap_or(false)
        }));
    }

    root["tools"] = json!(tools_vec);
    std::fs::write(&tools_file, serde_json::to_string_pretty(&root).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;

    Ok(json!({ "ok": true }))
}

#[tauri::command]
pub fn tools_get_for_capability(capability: String) -> Result<serde_json::Value, String> {
    // Get tools that can handle a specific capability
    let mut matching_tools = Vec::new();
    
    // Load tool definitions
    if let Ok(response) = tools_list() {
        if let Some(tools) = response["tools"].as_array() {
            for tool in tools {
                if let Some(caps) = tool["capabilities"].as_array() {
                    for cap in caps {
                        if let Some(cap_str) = cap.as_str() {
                            if cap_str.to_lowercase().contains(&capability.to_lowercase()) {
                                matching_tools.push(tool.clone());
                                break;
                            }
                        }
                    }
                }
            }
        }
    }
    
    Ok(json!({
        "tools": matching_tools
    }))
}

// Helper structures and functions

struct InstallInfo {
    windows: &'static str,
    macos: &'static str,
    linux: &'static str,
    url: &'static str,
}

fn check_tool_availability(tool_id: &str) -> bool {
    let executables = match tool_id {
        "ffmpeg" => vec!["ffmpeg"],
        "blender" => vec!["blender"],
        "imagemagick" => vec!["magick", "convert"],
        "pandoc" => vec!["pandoc"],
        "sox" => vec!["sox"],
        "git" => vec!["git"],
        "docker" => vec!["docker"],
        "python" => vec!["python", "python3"],
        "nodejs" => vec!["node", "nodejs"],
        _ => vec![tool_id],
    };
    
    for exe in executables {
        if which::which(exe).is_ok() {
            return true;
        }
    }
    
    false
}

fn extract_version(output: &str) -> Option<String> {
    // Simple version extraction using regex
    let re = regex::Regex::new(r"(\d+\.\d+(?:\.\d+)?)")
        .ok()?;
    re.captures(output)
        .and_then(|cap| cap.get(1))
        .map(|m| m.as_str().to_string())
}

// Removed get_default_tools() - we should not populate with fake/default data
// Tools should only come from actual tool_definitions.json or detected tools