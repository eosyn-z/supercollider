#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Serialize, Deserialize};
use serde_json::json;
use std::sync::Arc;
use std::path::PathBuf;

mod state;
mod models;
mod storage;
mod services;
mod commands;
mod utils;

use state::AppState;


// Response types
#[derive(Serialize)]
struct OkResponse { ok: bool }

#[tauri::command]
fn notifications_test() -> Result<serde_json::Value, String> { 
    Ok(json!({"ok": true})) 
}

// Agents - moved to commands/agents.rs

// Projects - moved to commands/projects.rs

// Config - moved to commands/config.rs

// Queue - moved to commands/queue.rs

// Clarify - placeholder for now
#[tauri::command]
fn clarify_submit(_project_id: String, _answers: Vec<String>) -> Result<OkResponse, String> {
    // TODO: Implement clarification handling when needed
    Ok(OkResponse { ok: true })
}

// Templates - moved to commands/templates.rs

// Terminal exec (disabled placeholder)
#[tauri::command]
fn terminal_exec(_cmd: String, _args: Vec<String>, _stdin: Option<String>) -> Result<serde_json::Value, String> {
    Ok(json!({"ok": false, "error": "process execution disabled in stub"}))
}

// Tasks - moved to commands/tasks.rs (remove stubs)

fn main() {
    // Initialize tracing with environment filter
    use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
    
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "supercollider=debug,info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();
    
    tauri::Builder::default()
        .manage(AppState::default())
        .setup(|_app| {
            // Initialize the simple task runner with a new AppState instance
            // This is OK since the task runner will use its own state instance
            let runner_state = Arc::new(AppState::default());
            
            tauri::async_runtime::block_on(async {
                commands::execution::init_task_runner(runner_state).await;
            });
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            notifications_test,
            commands::agents::agents_register, 
            commands::agents::agents_test, 
            commands::agents::agents_list, 
            commands::agents::agents_enable, 
            commands::agents::agents_delete,
            commands::agents::agents_register_free_defaults,
            commands::agents::agents_import_from_previous,
            commands::projects::run_start, 
            commands::projects::projects_list, 
            commands::projects::projects_cancel, 
            commands::projects::projects_delete, 
            commands::projects::projects_status, 
            commands::projects::projects_logs,
            commands::projects::shredder_analyze,
            commands::projects::shredder_apply,
            commands::config::config_update, 
            commands::queue::queue_start, 
            commands::queue::queue_pause, 
            commands::queue::queue_resume, 
            commands::queue::queue_cancel, 
            commands::queue::queue_reorder,
            commands::queue::queue_load_saved_projects,
            commands::queue::queue_process_lazy,
            commands::queue::queue_get_status,
            clarify_submit,
            commands::templates::templates_list, 
            commands::templates::templates_get, 
            commands::templates::templates_save, 
            commands::templates::templates_delete,
            terminal_exec,
            commands::tasks::tasks_create, 
            commands::tasks::tasks_create_simple,
            commands::tasks::tasks_update, 
            commands::tasks::tasks_delete, 
            commands::tasks::tasks_list,
            commands::tasks::tasks_list_all,
            commands::tasks::load_task_defaults,
            commands::tasks::reset_task_to_default,
            commands::execution::execute_project,
            commands::execution::execute_task,
            commands::execution::cancel_task,
            commands::execution::set_api_key,
            commands::execution::test_api_connection,
            commands::tools::tools_list,
            commands::tools::tools_detect,
            commands::tools::tools_validate,
            commands::tools::tools_install,
            commands::tools::tools_register_manual,
            commands::tools::tools_get_for_capability,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
