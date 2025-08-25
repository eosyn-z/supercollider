use serde_json::{json, Value};
use std::sync::Arc;
use once_cell::sync::Lazy;
use tokio::sync::RwLock;
use crate::state::AppState;
use crate::services::task_runner::TaskRunner;

// Global task runner instance
static TASK_RUNNER: Lazy<Arc<RwLock<Option<Arc<TaskRunner>>>>> = Lazy::new(|| {
    Arc::new(RwLock::new(None))
});

pub async fn init_task_runner(state: Arc<AppState>) {
    let runner = Arc::new(TaskRunner::new(state));
    
    // Set default API keys from environment variables
    if let Ok(openai_key) = std::env::var("OPENAI_API_KEY") {
        runner.set_api_key("openai".to_string(), openai_key).await;
    }
    if let Ok(anthropic_key) = std::env::var("ANTHROPIC_API_KEY") {
        runner.set_api_key("anthropic".to_string(), anthropic_key).await;
    }
    
    let mut runner_lock = TASK_RUNNER.write().await;
    *runner_lock = Some(runner);
}

async fn get_runner() -> Result<Arc<TaskRunner>, String> {
    let runner_lock = TASK_RUNNER.read().await;
    runner_lock.as_ref()
        .map(|r| Arc::clone(r))
        .ok_or_else(|| "Task runner not initialized".to_string())
}

#[tauri::command]
pub async fn execute_project(project_id: String) -> Result<Value, String> {
    let runner = get_runner().await?;
    
    // Run project in background
    let runner_clone = Arc::clone(&runner);
    tokio::spawn(async move {
        if let Err(e) = runner_clone.run_project(project_id).await {
            eprintln!("Project execution failed: {}", e);
        }
    });
    
    Ok(json!({"ok": true, "message": "Project execution started"}))
}

#[tauri::command]
pub async fn execute_task(project_id: String, task: Value) -> Result<Value, String> {
    let runner = get_runner().await?;
    
    // Run task asynchronously
    runner.run_task_async(project_id, task).await;
    
    Ok(json!({"ok": true, "message": "Task execution started"}))
}

#[tauri::command]
pub async fn cancel_task(task_id: String) -> Result<Value, String> {
    let runner = get_runner().await?;
    
    runner.cancel_task(&task_id).await
        .map_err(|e| e.to_string())?;
    
    Ok(json!({"ok": true}))
}

#[tauri::command]
pub async fn set_api_key(provider: String, key: String) -> Result<Value, String> {
    let runner = get_runner().await?;
    
    runner.set_api_key(provider.clone(), key.clone()).await;
    
    // Also save to environment for persistence
    std::env::set_var(format!("{}_API_KEY", provider.to_uppercase()), &key);
    
    Ok(json!({"ok": true, "message": format!("API key set for {}", provider)}))
}

#[tauri::command]
pub async fn test_api_connection(provider: String) -> Result<Value, String> {
    let runner = get_runner().await?;
    
    // Create a simple test task
    let test_task = json!({
        "task_id": "test-connection",
        "preamble": "Say 'Hello' in one word",
        "input": "Test",
        "capability": "text",
        "model": match provider.as_str() {
            "openai" => "gpt-3.5-turbo",
            "anthropic" => "claude-3-haiku-20240307",
            _ => "gpt-3.5-turbo"
        }
    });
    
    match runner.run_task("test".to_string(), test_task).await {
        Ok(_) => Ok(json!({"ok": true, "message": format!("{} connection successful", provider)})),
        Err(e) => Ok(json!({"ok": false, "error": e.to_string()}))
    }
}