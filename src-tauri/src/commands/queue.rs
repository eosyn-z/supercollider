use serde_json::json;
use std::fs;
use std::path::PathBuf;
use tauri::State;
use crate::state::AppState;
use crate::models::{Project, ProjectStatus};
use chrono::Utc;

#[tauri::command]
pub fn queue_start(state: State<AppState>) -> Result<serde_json::Value, String> {
    // Move all queued projects to running and persist; execution is triggered asynchronously elsewhere
    let ids_to_start: Vec<String> = {
        let projects = state.projects.read();
        projects
            .values()
            .filter(|p| matches!(p.status, ProjectStatus::Queued))
            .map(|p| p.id.clone())
            .collect()
    };

    {
        let mut projects = state.projects.write();
        for id in ids_to_start.iter() {
            if let Some(p) = projects.get_mut(id) {
                p.status = ProjectStatus::Running;
                p.updated_at = Utc::now();
                let _ = state.storage.save_json(&format!("project_{}.json", p.id), &*p);
            }
        }
    }

    // Fire-and-forget execution kickoff
    for id in ids_to_start.into_iter() {
        tauri::async_runtime::spawn(async move {
            let _ = crate::commands::execution::execute_project(id).await;
        });
    }

    Ok(json!({"ok": true}))
}

#[tauri::command]
pub fn queue_pause(state: State<AppState>) -> Result<serde_json::Value, String> {
    let mut projects = state.projects.write();
    for (_id, p) in projects.iter_mut() {
        if matches!(p.status, ProjectStatus::Running) {
            p.status = ProjectStatus::Paused;
            p.updated_at = Utc::now();
            let _ = state.storage.save_json(&format!("project_{}.json", p.id), &*p);
        }
    }
    Ok(json!({"ok": true}))
}

#[tauri::command]
pub fn queue_resume(state: State<AppState>) -> Result<serde_json::Value, String> {
    let ids_to_resume: Vec<String> = {
        let projects = state.projects.read();
        projects
            .values()
            .filter(|p| matches!(p.status, ProjectStatus::Paused))
            .map(|p| p.id.clone())
            .collect()
    };

    {
        let mut projects = state.projects.write();
        for id in ids_to_resume.iter() {
            if let Some(p) = projects.get_mut(id) {
                p.status = ProjectStatus::Running;
                p.updated_at = Utc::now();
                let _ = state.storage.save_json(&format!("project_{}.json", p.id), &*p);
            }
        }
    }

    for id in ids_to_resume.into_iter() {
        tauri::async_runtime::spawn(async move {
            let _ = crate::commands::execution::execute_project(id).await;
        });
    }

    Ok(json!({"ok": true}))
}

#[tauri::command]
pub fn queue_cancel(state: State<AppState>, project_id: String) -> Result<serde_json::Value, String> {
    let mut projects = state.projects.write();
    if let Some(p) = projects.get_mut(&project_id) {
        p.status = ProjectStatus::Cancelled;
        p.updated_at = Utc::now();
        let _ = state.storage.save_json(&format!("project_{}.json", p.id), &*p);
    }
    Ok(json!({"ok": true}))
}

#[tauri::command]
pub fn queue_reorder(_project_id: String, _position: u32) -> Result<serde_json::Value, String> {
    // No persisted queue ordering yet; UI can treat success as acknowledgement.
    Ok(json!({"ok": true, "queue": []}))
}

#[tauri::command]
pub fn queue_load_saved_projects(
    state: State<AppState>,
    limit: Option<usize>
) -> Result<serde_json::Value, String> {
    // Get the saved projects directory
    let saved_projects_dir = std::env::current_dir()
        .unwrap_or_default()
        .join("saved_projects");
    
    if !saved_projects_dir.exists() {
        return Ok(json!({
            "ok": true,
            "loaded": 0,
            "message": "No saved projects directory found"
        }));
    }
    
    let mut loaded_count = 0;
    let max_load = limit.unwrap_or(10); // Default to loading 10 projects
    
    // Read all JSON files from saved_projects directory
    let entries = fs::read_dir(&saved_projects_dir)
        .map_err(|e| format!("Failed to read saved projects directory: {}", e))?;
    
    let mut projects_to_load = Vec::new();
    
    for entry in entries {
        if let Ok(entry) = entry {
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) == Some("json") {
                // Try to read and parse the project file
                if let Ok(content) = fs::read_to_string(&path) {
                    if let Ok(mut project) = serde_json::from_str::<Project>(&content) {
                        // Update project status to queued
                        project.status = ProjectStatus::Queued;
                        project.updated_at = Utc::now();
                        projects_to_load.push(project);
                        
                        if projects_to_load.len() >= max_load {
                            break;
                        }
                    }
                }
            }
        }
    }
    
    // Add projects to the queue
    {
        let mut projects = state.projects.write();
        for project in projects_to_load.iter() {
            projects.insert(project.id.clone(), project.clone());
            loaded_count += 1;
            
            // Also save to storage
            if let Err(e) = state.storage.save_json(
                &format!("project_{}.json", project.id),
                &project,
            ) {
                log::error!("Failed to save project to storage: {}", e);
            }
        }
    }
    
    Ok(json!({
        "ok": true,
        "loaded": loaded_count,
        "message": format!("Loaded {} saved projects into queue", loaded_count)
    }))
}

#[tauri::command]
pub fn queue_process_lazy(
    state: State<AppState>
) -> Result<serde_json::Value, String> {
    // Check if queue is empty
    let projects = state.projects.read();
    let queued_count = projects.values()
        .filter(|p| matches!(p.status, ProjectStatus::Queued))
        .count();
    let running_count = projects.values()
        .filter(|p| matches!(p.status, ProjectStatus::Running))
        .count();
    drop(projects);
    
    if running_count > 0 {
        return Ok(json!({
            "ok": false,
            "message": "Queue is currently processing projects"
        }));
    }
    
    if queued_count == 0 {
        // Queue is empty, load saved projects
        queue_load_saved_projects(state.clone(), Some(5))?;
        
        // Start processing the queue
        let _ = queue_start(state);
        
        Ok(json!({
            "ok": true,
            "message": "Loaded saved projects and started processing"
        }))
    } else {
        Ok(json!({
            "ok": false,
            "message": "Queue already has projects"
        }))
    }
}

#[tauri::command]
pub fn queue_get_status(state: State<AppState>) -> Result<serde_json::Value, String> {
    let projects = state.projects.read();
    
    let queued = projects.values()
        .filter(|p| matches!(p.status, ProjectStatus::Queued))
        .count();
    let running = projects.values()
        .filter(|p| matches!(p.status, ProjectStatus::Running))
        .count();
    let completed = projects.values()
        .filter(|p| matches!(p.status, ProjectStatus::Completed))
        .count();
    let failed = projects.values()
        .filter(|p| matches!(p.status, ProjectStatus::Failed))
        .count();
    
    Ok(json!({
        "ok": true,
        "status": {
            "queued": queued,
            "running": running,
            "completed": completed,
            "failed": failed,
            "total": projects.len()
        }
    }))
}