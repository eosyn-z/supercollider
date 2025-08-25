use crate::models::{Project, ProjectType, ProjectStatus, Task, TaskStatus, Capability};
use crate::state::AppState;
use serde::{Deserialize, Serialize};
use serde_json::json;
use chrono::Utc;
use uuid::Uuid;
use tauri::State;
use crate::services::simple_executor::{SimpleExecutor, TaskExecution};

#[derive(Deserialize)]
pub struct ProjectStartPayload {
    pub r#type: String,
    pub prompt: String,
    pub config_override: Option<serde_json::Value>,
}

#[derive(Deserialize)]
pub struct ProjectStartRequest {
    pub project: ProjectStartPayload,
}

#[derive(Serialize)]
pub struct ProjectStartResponse {
    pub ok: bool,
    pub project_id: Option<String>,
    pub error: Option<String>,
    pub clarity_score: Option<f32>,
    pub questions: Option<Vec<String>>,
}

#[tauri::command]
pub async fn run_start(
    state: tauri::State<'_, AppState>,
    project: ProjectStartRequest,
) -> Result<ProjectStartResponse, String> {
    let project_id = format!("proj-{}", Uuid::new_v4());
    
    // Parse project type
    let project_type = match project.project.r#type.as_str() {
        "coding_project" => ProjectType::CodingProject,
        "data_analysis" => ProjectType::DataAnalysis,
        "research" => ProjectType::Research,
        "writing" => ProjectType::Writing,
        "design" => ProjectType::Design,
        "marketing" => ProjectType::Marketing,
        _ => ProjectType::Custom,
    };
    
    // Don't generate fake clarity scores - only calculate if we have actual analysis
    // For now, skip clarification check until properly implemented
    let clarity_score = 1.0; // Assume clear until we implement proper analysis
    
    // Create project
    let new_project = Project {
        id: project_id.clone(),
        project_type,
        prompt: project.project.prompt.clone(),
        initial_prompt: Some(project.project.prompt.clone()),
        status: ProjectStatus::Queued,
        created_at: Utc::now(),
        updated_at: Utc::now(),
        config_override: project.project.config_override,
        clarity_score,
        tasks_count: 0,
        completed_tasks: 0,
        elaboration: None,
        shredder_atoms: vec![],
        shredder_atomic_task_types: vec![],
        shredder_questions: vec![],
        shredder_raw: None,
    };
    
    // Store project in state
    {
        let mut projects = state.projects.write();
        projects.insert(project_id.clone(), new_project.clone());
    }
    
    // Persist to storage
    if let Err(e) = state.storage.save_json(
        &format!("project_{}.json", project_id),
        &new_project,
    ) {
        log::error!("Failed to save project: {}", e);
        return Err(format!("Failed to save project: {}", e));
    }
    
    // Generate basic tasks for the project
    generate_tasks_for_project(&state, &project_id, &new_project)?;
    
    Ok(ProjectStartResponse {
        ok: true,
        project_id: Some(project_id),
        error: None,
        clarity_score: Some(clarity_score),
        questions: None,
    })
}

#[tauri::command]
pub fn projects_list(state: tauri::State<AppState>) -> Result<serde_json::Value, String> {
    let projects = state.projects.read();
    let list: Vec<&Project> = projects.values().collect();
    
    Ok(json!({
        "ok": true,
        "projects": list
    }))
}

#[tauri::command]
pub fn projects_cancel(
    state: tauri::State<AppState>,
    project_id: String,
) -> Result<serde_json::Value, String> {
    // Update project status
    let mut projects = state.projects.write();
    
    if let Some(project) = projects.get_mut(&project_id) {
        project.status = ProjectStatus::Cancelled;
        project.updated_at = Utc::now();
        
        // Persist changes
        if let Err(e) = state.storage.save_json(
            &format!("project_{}.json", project_id),
            &project,
        ) {
            log::error!("Failed to save project: {}", e);
        }
        
        Ok(json!({ "ok": true }))
    } else {
        Err(format!("Project '{}' not found", project_id))
    }
}

#[tauri::command]
pub fn projects_delete(
    state: tauri::State<AppState>,
    project_id: String,
) -> Result<serde_json::Value, String> {
    // Remove from memory
    state.projects.write().remove(&project_id);
    state.tasks.write().remove(&project_id);
    
    // Remove from storage
    if let Err(e) = state.storage.delete(&format!("project_{}.json", project_id)) {
        log::error!("Failed to delete project file: {}", e);
    }
    
    Ok(json!({ "ok": true }))
}

#[tauri::command]
pub fn projects_status(
    state: tauri::State<AppState>,
    project_id: String,
) -> Result<serde_json::Value, String> {
    let projects = state.projects.read();
    
    if let Some(project) = projects.get(&project_id) {
        // Get task statistics
        let tasks = state.tasks.read();
        let project_tasks = tasks.get(&project_id);
        
        let tasks_summary = if let Some(tasks) = project_tasks {
            json!({
                "total": tasks.len(),
                "queued": tasks.iter().filter(|t| matches!(t.status, crate::models::TaskStatus::Queued)).count(),
                "running": tasks.iter().filter(|t| matches!(t.status, crate::models::TaskStatus::Running)).count(),
                "completed": tasks.iter().filter(|t| matches!(t.status, crate::models::TaskStatus::Completed)).count(),
                "failed": tasks.iter().filter(|t| matches!(t.status, crate::models::TaskStatus::Failed)).count(),
                "blocked": tasks.iter().filter(|t| matches!(t.status, crate::models::TaskStatus::Blocked)).count(),
                "waiting_clarification": tasks.iter().filter(|t| matches!(t.status, crate::models::TaskStatus::WaitingClarification)).count(),
            })
        } else {
            json!({
                "total": 0,
                "queued": 0,
                "running": 0,
                "completed": 0,
                "failed": 0,
                "blocked": 0,
                "waiting_clarification": 0,
            })
        };
        
        Ok(json!({
            "ok": true,
            "status": project.status,
            "tasks_summary": tasks_summary,
            "clarity_score": project.clarity_score,
            "progress": 0.0,
        }))
    } else {
        Err(format!("Project '{}' not found", project_id))
    }
}

#[tauri::command]
pub fn projects_logs(
    state: tauri::State<AppState>,
    project_id: String,
    _tail: Option<u32>,
) -> Result<serde_json::Value, String> {
    // TODO: Implement log reading when we have actual execution
    Ok(json!({
        "ok": true,
        "lines": []
    }))
}

#[tauri::command]
pub async fn shredder_analyze(
    state: tauri::State<'_, AppState>,
    project_id: String,
    model: Option<String>,
    provider: Option<String>,
) -> Result<serde_json::Value, String> {
    let project = {
        let projects = state.projects.read();
        projects.get(&project_id).cloned()
    }.ok_or_else(|| format!("Project '{}' not found", project_id))?;

    // Build tool list from TOOLS/tool_definitions.json
    let tools_path = std::env::current_dir().unwrap_or_default().join("TOOLS").join("tool_definitions.json");
    let tool_list: Vec<String> = if tools_path.exists() {
        if let Ok(content) = std::fs::read_to_string(&tools_path) {
            if let Ok(val) = serde_json::from_str::<serde_json::Value>(&content) {
                val["tools"].as_array().map(|arr| {
                    arr.iter().filter_map(|t| t["id"].as_str().map(|s| s.to_string())).collect()
                }).unwrap_or_default()
            } else { vec![] }
        } else { vec![] }
    } else { vec![] };

    let capabilities = vec!["text", "code", "image", "sound", "video"]; 
    let workflow_order = vec!["analysis", "planning", "implementation", "validation", "documentation", "review"]; 

    let instruction = format!(
        concat!(
            "What questions do you need to ask the user in order to accomplish the prompt as required? ",
            "Your tools are [{}] and you have access to [{}], you will generate in [{}]. ",
            "Generate tasks OR questions according to the atomic tasks following the given format so that we can properly ",
            "prompt the user to request additional context or begin shredding.\n\n",
            "Return strict JSON with keys: atoms (string[]), atomic_task_types (string[]), questions (string[]), ",
            "tasks (array of objects: {{task_type, preamble, capability, dependencies?: string[]}})."
        ),
        tool_list.join(", "),
        capabilities.join(", "),
        workflow_order.join(" -> ")
    );

    let exec = SimpleExecutor::new();
    let task = TaskExecution {
        task_id: format!("analyze-{}", project_id),
        preamble: instruction,
        input: serde_json::json!({ "prompt": project.prompt }),
        capability: "text".to_string(),
        tool: None,
        api_key: provider.as_ref().and_then(|p| {
            let key_name = format!("{}_API_KEY", p.to_uppercase());
            std::env::var(key_name).ok()
        }),
        model,
        max_retries: None,
        timeout_secs: None,
        full_context: None,
        related_outputs: None,
        retry_count: 0,
        requires_user_input: false,
    };

    let result = exec.execute_task(task).await.map_err(|e| e.to_string())?;
    if let Some(output) = result.output {
        if let Some(content) = output.get("content").and_then(|c| c.as_str()) {
            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(content) {
                let _ = state.storage.save_project_data(&project_id, "atoms.json", &parsed["atoms"]);
                let _ = state.storage.save_project_data(&project_id, "atomic_task_types.json", &parsed["atomic_task_types"]);
                let _ = state.storage.save_project_data(&project_id, "clarification_questions.json", &parsed["questions"]);
                // Also persist into project struct for hot load/unload
                {
                    let mut projects = state.projects.write();
                    if let Some(p) = projects.get_mut(&project_id) {
                        p.elaboration = output.get("elaboration").and_then(|v| v.as_str()).map(|s| s.to_string());
                        p.shredder_atoms = parsed.get("atoms").and_then(|v| v.as_array()).map(|a| a.iter().filter_map(|x| x.as_str().map(|s| s.to_string())).collect()).unwrap_or_default();
                        p.shredder_atomic_task_types = parsed.get("atomic_task_types").and_then(|v| v.as_array()).map(|a| a.iter().filter_map(|x| x.as_str().map(|s| s.to_string())).collect()).unwrap_or_default();
                        p.shredder_questions = parsed.get("questions").and_then(|v| v.as_array()).map(|a| a.iter().filter_map(|x| x.as_str().map(|s| s.to_string())).collect()).unwrap_or_default();
                        p.shredder_raw = Some(parsed.clone());
                        p.updated_at = Utc::now();
                        let _ = state.storage.save_json(&format!("project_{}.json", project_id), &*p);
                    }
                }
                return Ok(serde_json::json!({
                    "ok": true,
                    "atoms": parsed.get("atoms").cloned().unwrap_or(serde_json::json!([])),
                    "atomic_task_types": parsed.get("atomic_task_types").cloned().unwrap_or(serde_json::json!([])),
                    "questions": parsed.get("questions").cloned().unwrap_or(serde_json::json!([])),
                    "tasks": parsed.get("tasks").cloned().unwrap_or(serde_json::json!([])),
                }));
            }
        }
        return Ok(serde_json::json!({ "ok": true, "raw": output }));
    }
    Err(result.error.unwrap_or_else(|| "Analysis failed".to_string()))
}

#[tauri::command]
pub fn shredder_apply(
    state: tauri::State<AppState>,
    project_id: String,
    tasks: serde_json::Value,
) -> Result<serde_json::Value, String> {
    let arr = tasks.as_array().ok_or_else(|| "Invalid tasks payload".to_string())?;

    let mut new_tasks: Vec<Task> = Vec::new();
    let mut id_map: std::collections::HashMap<String, String> = std::collections::HashMap::new();

    for (idx, t) in arr.iter().enumerate() {
        let task_type = t["task_type"].as_str().unwrap_or("task").to_string();
        let preamble = t["preamble"].as_str().unwrap_or("").to_string();
        let capability_str = t["capability"].as_str().unwrap_or("text");
        let capability = match capability_str {
            "code" => Capability::Code,
            "image" => Capability::Image,
            "sound" => Capability::Sound,
            "video" => Capability::Video,
            _ => Capability::Text,
        };

        let new_id = format!("task-{}", Uuid::new_v4());
        id_map.insert(format!("{}", idx), new_id.clone());

        let task = Task {
            id: new_id.clone(),
            project_id: project_id.clone(),
            task_type,
            capability,
            status: TaskStatus::Queued,
            dependencies: vec![],
            input_chain: vec![],
            input: json!({ "prompt": "" }),
            output: None,
            preamble: Some(preamble),
            token_limit: 2000,
            priority_override: None,
            approval_required: false,
            created_at: Utc::now(),
            started_at: None,
            completed_at: None,
            error: None,
            retry_count: 0,
            updated_at: Utc::now(),
            metadata: None,
            user_edited: false,
            oneshot_count: 0,
            last_agent: None,
            last_agent_key_hint: None,
        };
        new_tasks.push(task);
    }

    for (idx, t) in arr.iter().enumerate() {
        if let Some(deps) = t.get("dependencies").and_then(|d| d.as_array()) {
            for dep in deps {
                if let Some(dep_str) = dep.as_str() {
                    let dep_id = id_map.get(dep_str).cloned().unwrap_or_else(|| dep_str.to_string());
                    if let Some(task_mut) = new_tasks.get_mut(idx) {
                        task_mut.dependencies.push(dep_id.clone());
                        task_mut.input_chain.push(dep_id);
                        task_mut.status = TaskStatus::Blocked;
                    }
                }
            }
        }
    }

    {
        let mut tasks_map = state.tasks.write();
        let entry = tasks_map.entry(project_id.clone()).or_default();
        for t in &new_tasks {
            entry.push(t.clone());
            let _ = state.storage.save_json(&format!("task_{}_{}.json", project_id, t.id), t);
        }
    }

    Ok(json!({ "ok": true, "created": new_tasks.len() }))
}

// Helper function to generate basic tasks for a project
fn generate_tasks_for_project(
    state: &State<AppState>,
    project_id: &str,
    project: &Project
) -> Result<(), String> {
    let mut tasks = Vec::new();
    
    // Generate tasks based on project type
    match project.project_type {
        ProjectType::CodingProject => {
            // Create analysis and implementation tasks
            tasks.push(Task {
                id: format!("task-{}", Uuid::new_v4()),
                project_id: project_id.to_string(),
                task_type: "analysis".to_string(),
                capability: Capability::Text,
                status: TaskStatus::Queued,
                dependencies: vec![],
                input_chain: vec![],
                input: json!({ "prompt": project.prompt.clone() }),
                output: None,
                preamble: Some("Analyze the requirements and create a plan for: ".to_string()),
                metadata: Some(json!({ "step": "planning" })),
                updated_at: Utc::now(),
                token_limit: 2000,
                priority_override: None,
                approval_required: false,
                created_at: Utc::now(),
                started_at: None,
                completed_at: None,
                error: None,
                retry_count: 0,
                user_edited: false,
                oneshot_count: 0,
                last_agent: None,
                last_agent_key_hint: None,
            });
            
            tasks.push(Task {
                id: format!("task-{}", Uuid::new_v4()),
                project_id: project_id.to_string(),
                task_type: "implementation".to_string(),
                capability: Capability::Code,
                status: TaskStatus::Queued,
                dependencies: vec![tasks[0].id.clone()],
                input_chain: vec![],
                input: json!({ "prompt": project.prompt.clone() }),
                output: None,
                preamble: Some("Implement the following: ".to_string()),
                metadata: Some(json!({ "step": "coding" })),
                updated_at: Utc::now(),
                token_limit: 4000,
                priority_override: None,
                approval_required: false,
                created_at: Utc::now(),
                started_at: None,
                completed_at: None,
                error: None,
                retry_count: 0,
                user_edited: false,
                oneshot_count: 0,
                last_agent: None,
                last_agent_key_hint: None,
            });
        },
        ProjectType::DataAnalysis => {
            // Create data processing task
            tasks.push(Task {
                id: format!("task-{}", Uuid::new_v4()),
                project_id: project_id.to_string(),
                task_type: "data_processing".to_string(),
                capability: Capability::Text,
                status: TaskStatus::Queued,
                dependencies: vec![],
                input_chain: vec![],
                input: json!({ "prompt": project.prompt.clone() }),
                output: None,
                preamble: Some("Analyze and process the following data request: ".to_string()),
                metadata: Some(json!({ "step": "analysis" })),
                updated_at: Utc::now(),
                token_limit: 3000,
                priority_override: None,
                approval_required: false,
                created_at: Utc::now(),
                started_at: None,
                completed_at: None,
                error: None,
                retry_count: 0,
                user_edited: false,
                oneshot_count: 0,
                last_agent: None,
                last_agent_key_hint: None,
            });
        },
        _ => {
            // Default single task for other project types
            tasks.push(Task {
                id: format!("task-{}", Uuid::new_v4()),
                project_id: project_id.to_string(),
                task_type: "general".to_string(),
                capability: Capability::Text,
                status: TaskStatus::Queued,
                dependencies: vec![],
                input_chain: vec![],
                input: json!({ "prompt": project.prompt.clone() }),
                output: None,
                preamble: Some("Process the following request: ".to_string()),
                metadata: Some(json!({ "step": "processing" })),
                updated_at: Utc::now(),
                token_limit: 2000,
                priority_override: None,
                approval_required: false,
                created_at: Utc::now(),
                started_at: None,
                completed_at: None,
                error: None,
                retry_count: 0,
                user_edited: false,
                oneshot_count: 0,
                last_agent: None,
                last_agent_key_hint: None,
            });
        }
    }
    
    // Store tasks in state
    {
        let mut tasks_map = state.tasks.write();
        tasks_map.insert(project_id.to_string(), tasks.clone());
    }
    
    // Save tasks to storage
    for task in &tasks {
        if let Err(e) = state.storage.save_json(
            &format!("task_{}_{}.json", project_id, task.id),
            &task,
        ) {
            log::error!("Failed to save task: {}", e);
        }
    }
    
    Ok(())
}