use serde_json::json;
use tauri::State;
use crate::state::AppState;
use crate::models::{Task, TaskStatus, Capability};
use uuid::Uuid;
use chrono::Utc;
use serde::Deserialize;

#[tauri::command]
pub fn tasks_create(
    state: State<AppState>,
    project_id: String,
    task: serde_json::Value,
) -> Result<serde_json::Value, String> {
    // Convert JSON to Task model
    let task_model: Task = match serde_json::from_value(task.clone()) {
        Ok(t) => t,
        Err(e) => {
            // If we can't parse the task, return an error instead of creating with defaults
            return Err(format!("Invalid task data: {}", e));
        }
    };
    let mut task_model = task_model;
    // Ensure new fields have sane defaults if coming from older UI payloads
    if task_model.preamble.is_none() {
        if let Some(pre) = task["preamble"].as_str() {
            task_model.preamble = Some(pre.to_string());
        }
    }
    if task_model.metadata.is_none() && task.get("metadata").is_some() {
        task_model.metadata = task.get("metadata").cloned();
    }
    task_model.user_edited = task.get("modified").and_then(|v| v.as_bool()).unwrap_or(false);
    
    // Store in state
    let mut tasks_map = state.tasks.write();
    let entry = tasks_map.entry(project_id.clone()).or_default();
    entry.push(task_model.clone());
    
    // Save to storage
    if let Err(e) = state.storage.save_json(
        &format!("task_{}_{}.json", project_id, task_model.id),
        &task_model,
    ) {
        log::error!("Failed to save task: {}", e);
    }
    
    Ok(json!({"ok": true, "task_id": task_model.id}))
}

#[derive(Deserialize)]
pub struct SimpleTaskInput {
    pub task_type: String,
    pub capability: String,
    pub preamble: Option<String>,
    pub token_limit: Option<u32>,
    pub dependencies: Option<Vec<String>>, // task ids
    pub input_chain: Option<Vec<String>>,
    pub approval_required: Option<bool>,
    pub clarity_prompt: Option<String>,
    pub metadata: Option<serde_json::Value>,
}

#[tauri::command]
pub fn tasks_create_simple(
    state: State<AppState>,
    project_id: String,
    input: SimpleTaskInput,
) -> Result<serde_json::Value, String> {
    // Parse capability from snake_case string
    let capability: Capability = serde_json::from_value(json!(input.capability))
        .map_err(|e| format!("Invalid capability '{}': {}", input.capability, e))?;

    let id = format!("task-{}", Uuid::new_v4());
    let now = Utc::now();

    let task = Task {
        id: id.clone(),
        project_id: project_id.clone(),
        task_type: input.task_type,
        capability,
        status: TaskStatus::Queued,
        dependencies: input.dependencies.unwrap_or_default(),
        input_chain: input.input_chain.unwrap_or_default(),
        input: json!({}),
        output: None,
        preamble: input.preamble,
        metadata: input.metadata,
        updated_at: now,
        token_limit: input.token_limit.unwrap_or(2000),
        priority_override: None,
        approval_required: input.approval_required.unwrap_or(false),
        created_at: now,
        started_at: None,
        completed_at: None,
        error: None,
        retry_count: 0,
        user_edited: false,
        oneshot_count: 0,
        last_agent: None,
        last_agent_key_hint: None,
    };

    // Store in state
    {
        let mut tasks_map = state.tasks.write();
        let entry = tasks_map.entry(project_id.clone()).or_default();
        entry.push(task.clone());
    }

    // Persist
    if let Err(e) = state.storage.save_json(
        &format!("task_{}_{}.json", project_id, id),
        &task,
    ) {
        log::error!("Failed to save task: {}", e);
    }

    Ok(json!({"ok": true, "task_id": id}))
}

#[tauri::command]
pub fn tasks_update(
    state: State<AppState>,
    project_id: String,
    task_id: String,
    partial: serde_json::Value,
) -> Result<serde_json::Value, String> {
    let mut tasks_map = state.tasks.write();
    
    if let Some(tasks) = tasks_map.get_mut(&project_id) {
        for task in tasks.iter_mut() {
            if task.id == task_id {
                // Update fields from partial
                if let Some(status) = partial["status"].as_str() {
                    task.status = serde_json::from_value(json!(status)).unwrap_or(TaskStatus::Queued);
                }
                if let Some(output) = partial.get("output") {
                    task.output = Some(output.clone());
                }
                if let Some(error) = partial["error"].as_str() {
                    task.error = Some(error.to_string());
                }
                if let Some(preamble) = partial["preamble"].as_str() {
                    task.preamble = Some(preamble.to_string());
                    task.user_edited = true;
                }
                if let Some(token_limit) = partial["token_limit"].as_u64() {
                    task.token_limit = token_limit as u32;
                    task.user_edited = true;
                }
                if partial.get("metadata").is_some() {
                    task.metadata = partial.get("metadata").cloned();
                    task.user_edited = true;
                }
                task.updated_at = Utc::now();
                
                // Save to storage
                if let Err(e) = state.storage.save_json(
                    &format!("task_{}_{}.json", project_id, task_id),
                    &task,
                ) {
                    log::error!("Failed to save task: {}", e);
                }
                
                return Ok(json!({"ok": true}));
            }
        }
    }
    
    Err(format!("Task '{}' not found in project '{}'", task_id, project_id))
}

#[tauri::command]
pub fn tasks_delete(
    state: State<AppState>,
    project_id: String,
    task_id: String,
) -> Result<serde_json::Value, String> {
    // Remove from state
    if let Some(tasks) = state.tasks.write().get_mut(&project_id) {
        tasks.retain(|t| t.id != task_id);
    }
    
    // Delete from storage
    if let Err(e) = state.storage.delete(&format!("task_{}_{}.json", project_id, task_id)) {
        log::error!("Failed to delete task file: {}", e);
    }
    
    Ok(json!({"ok": true}))
}

#[tauri::command]
pub fn tasks_list(
    state: State<AppState>,
    project_id: String,
) -> Result<serde_json::Value, String> {
    let tasks = state.tasks.read();
    let list = tasks.get(&project_id).cloned().unwrap_or_default();
    
    // Convert to JSON values
    let task_values: Vec<serde_json::Value> = list
        .iter()
        .map(|t| {
            let mut v = serde_json::to_value(t).unwrap_or(json!({}));
            // Surface oneshot statistic explicitly for UI convenience
            if let Some(map) = v.as_object_mut() {
                map.insert("oneshot_count".to_string(), json!(t.oneshot_count));
                map.insert("user_edited".to_string(), json!(t.user_edited));
                map.insert("last_agent".to_string(), json!(t.last_agent));
                map.insert("last_agent_key_hint".to_string(), json!(t.last_agent_key_hint));
            }
            v
        })
        .collect();
    
    Ok(json!({"ok": true, "tasks": task_values}))
}

#[tauri::command]
pub fn tasks_list_all(state: State<AppState>) -> Result<serde_json::Value, String> {
    let tasks = state.tasks.read();
    let mut all: Vec<serde_json::Value> = Vec::new();
    for (_pid, list) in tasks.iter() {
        for t in list {
            all.push(serde_json::to_value(t).unwrap_or(json!({})));
        }
    }
    Ok(json!({"ok": true, "tasks": all}))
}

#[tauri::command]
pub fn load_task_defaults() -> Result<serde_json::Value, String> {
    // Load task default templates from TASKDEFAULTS directory
    let base = std::env::current_dir().unwrap_or_default().join("TASKDEFAULTS");
    if !base.exists() { return Ok(json!({})); }
    let mut merged = serde_json::Map::new();
    if let Ok(entries) = std::fs::read_dir(&base) {
        for entry in entries.flatten() {
            if entry.path().extension().and_then(|s| s.to_str()) == Some("json") {
                if let Ok(text) = std::fs::read_to_string(entry.path()) {
                    if let Ok(val) = serde_json::from_str::<serde_json::Value>(&text) {
                        if let Some(obj) = val.as_object() {
                            for (k, v) in obj {
                                merged.insert(k.clone(), v.clone());
                            }
                        }
                    }
                }
            }
        }
    }
    Ok(serde_json::Value::Object(merged))
}

#[tauri::command]
pub fn reset_task_to_default(
    state: State<AppState>,
    project_id: String,
    task_id: String,
    template_source: String,
) -> Result<serde_json::Value, String> {
    // Load defaults and find the template
    let defaults = load_task_defaults()?;
    let template = defaults.get(&template_source)
        .ok_or_else(|| format!("Template '{}' not found", template_source))?;
    // Update task in state
    let mut tasks = state.tasks.write();
    if let Some(project_tasks) = tasks.get_mut(&project_id) {
        if let Some(task) = project_tasks.iter_mut().find(|t| t.id == task_id) {
            if let Ok(mut updated) = serde_json::from_value::<Task>(template.clone()) {
                // preserve identity and project id
                updated.id = task.id.clone();
                updated.project_id = task.project_id.clone();
                updated.updated_at = Utc::now();
                *task = updated;
                // persist
                if let Err(e) = state.storage.save_json(&format!("task_{}_{}.json", project_id, task_id), &*task) {
                    log::error!("Failed to save task: {}", e);
                }
                return Ok(json!({"ok": true}));
            }
        }
    }
    Err(format!("Task '{}' not found in project '{}'", task_id, project_id))
}