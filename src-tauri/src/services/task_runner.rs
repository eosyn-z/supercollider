use std::sync::Arc;
use std::collections::HashMap;
use tokio::sync::RwLock;
use serde_json::{json, Value};
use anyhow::Result;
use crate::models::{ProjectStatus, TaskStatus};
use crate::state::AppState;
use super::simple_executor::{SimpleExecutor, TaskExecution, ToolConfig};

pub struct TaskRunner {
    executor: Arc<RwLock<SimpleExecutor>>,
    state: Arc<AppState>,
    running_tasks: Arc<RwLock<HashMap<String, tokio::task::JoinHandle<()>>>>,
}

impl TaskRunner {
    pub fn new(state: Arc<AppState>) -> Self {
        Self {
            executor: Arc::new(RwLock::new(SimpleExecutor::new())),
            state,
            running_tasks: Arc::new(RwLock::new(HashMap::new())),
        }
    }
    
    pub async fn set_api_key(&self, provider: String, key: String) {
        let mut executor = self.executor.write().await;
        executor.set_api_key(provider, key).await;
    }
    
    pub async fn run_project(&self, project_id: String) -> Result<()> {
        // Update project status
        {
            let mut projects = self.state.projects.write();
            if let Some(project) = projects.get_mut(&project_id) {
                project.status = ProjectStatus::Running;
            }
        }
        
        // Get all tasks for the project
        let tasks = {
            let tasks_map = self.state.tasks.read();
            tasks_map.get(&project_id)
                .map(|tasks| {
                    // Convert Task structs to JSON Values
                    tasks.iter()
                        .map(|task| serde_json::to_value(task).unwrap_or(json!({})))
                        .collect::<Vec<Value>>()
                })
                .unwrap_or_default()
        };
        
        // Process tasks sequentially (respecting dependencies)
        for task_value in tasks {
            // Extract task info from JSON
            let task_id = task_value["task_id"].as_str().unwrap_or("").to_string();
            if task_id.is_empty() {
                continue;
            }
            
            // Check dependencies
            if !self.check_dependencies(&project_id, &task_value).await {
                self.update_task_status(&project_id, &task_id, TaskStatus::Blocked).await;
                continue;
            }
            
            // Run the task
            self.run_task(project_id.clone(), task_value).await?;
        }
        
        // Update project status to completed
        {
            let mut projects = self.state.projects.write();
            if let Some(project) = projects.get_mut(&project_id) {
                project.status = ProjectStatus::Completed;
            }
        }
        
        Ok(())
    }
    
    pub async fn run_task(&self, project_id: String, task: Value) -> Result<()> {
        let task_id = task["task_id"].as_str().unwrap_or("").to_string();
        
        // Update task status to running
        self.update_task_status(&project_id, &task_id, TaskStatus::Running).await;
        
        // Build task execution request
        let execution = TaskExecution {
            task_id: task_id.clone(),
            preamble: task["preamble"].as_str().unwrap_or("").to_string(),
            input: task["input"].clone(),
            capability: task["capability"].as_str().unwrap_or("text").to_string(),
            tool: self.extract_tool_config(&task),
            api_key: None, // Will use default from executor
            model: task["model"].as_str().map(|s| s.to_string()),
            max_retries: None,
            timeout_secs: None,
            full_context: None,
            related_outputs: None,
            retry_count: 0,
            requires_user_input: false,
        };
        
        // Execute the task
        let executor = self.executor.clone();
        let result = executor.read().await.execute_task(execution).await;
        
        match result {
            Ok(execution_result) => {
                if execution_result.success {
                    // Store output
                    self.update_task_output(&project_id, &task_id, execution_result.output).await;
                    self.update_task_status(&project_id, &task_id, TaskStatus::Completed).await;
                    // Increment oneshot if task was not user_edited and had no prior retries/errors
                    {
                        let mut tasks = self.state.tasks.write();
                        if let Some(project_tasks) = tasks.get_mut(&project_id) {
                            if let Some(task) = project_tasks.iter_mut().find(|t| t.id == task_id) {
                                if !task.user_edited && task.retry_count == 0 && task.error.is_none() {
                                    task.oneshot_count = task.oneshot_count.saturating_add(1);
                                }
                                // No agent info in simple runner; leave last_agent as-is
                                let _ = self.state.storage.save_json(
                                    &format!("task_{}_{}.json", project_id, task_id),
                                    &task,
                                );
                            }
                        }
                    }
                } else {
                    // Store error
                    self.update_task_error(&project_id, &task_id, execution_result.error).await;
                    self.update_task_status(&project_id, &task_id, TaskStatus::Failed).await;
                }
            }
            Err(e) => {
                self.update_task_error(&project_id, &task_id, Some(e.to_string())).await;
                self.update_task_status(&project_id, &task_id, TaskStatus::Failed).await;
            }
        }
        
        Ok(())
    }
    
    pub async fn run_task_async(&self, project_id: String, task: Value) {
        let task_id = task["task_id"].as_str().unwrap_or("").to_string();
        let runner = self.clone();
        let handle = tokio::spawn(async move {
            if let Err(e) = runner.run_task(project_id, task).await {
                eprintln!("Task execution failed: {}", e);
            }
        });
        
        self.running_tasks.write().await.insert(task_id, handle);
    }
    
    pub async fn cancel_task(&self, task_id: &str) -> Result<()> {
        let mut running = self.running_tasks.write().await;
        if let Some(handle) = running.remove(task_id) {
            handle.abort();
        }
        Ok(())
    }
    
    async fn check_dependencies(&self, project_id: &str, task: &Value) -> bool {
        let dependencies = task["dependencies"]
            .as_array()
            .map(|arr| arr.iter().filter_map(|v| v.as_str()).collect::<Vec<_>>())
            .unwrap_or_default();
        
        if dependencies.is_empty() {
            return true;
        }
        
        let tasks = self.state.tasks.read();
        if let Some(project_tasks) = tasks.get(project_id) {
            for dep_id in dependencies {
                let dep_completed = project_tasks.iter().any(|t| {
                    t.id == dep_id && t.status == TaskStatus::Completed
                });
                
                if !dep_completed {
                    return false;
                }
            }
        }
        
        true
    }
    
    fn extract_tool_config(&self, task: &Value) -> Option<ToolConfig> {
        task["metadata"]["tool"].as_object().map(|tool_obj| {
            ToolConfig {
                name: tool_obj["name"].as_str().unwrap_or("").to_string(),
                command: tool_obj["command"].as_str().unwrap_or("").to_string(),
                args_template: tool_obj["argsTemplate"]
                    .as_array()
                    .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
                    .unwrap_or_default(),
            }
        })
    }
    
    async fn update_task_status(&self, project_id: &str, task_id: &str, status: TaskStatus) {
        let mut tasks = self.state.tasks.write();
        if let Some(project_tasks) = tasks.get_mut(project_id) {
            for task in project_tasks.iter_mut() {
                if task.id == task_id {
                    task.status = status;
                    task.updated_at = chrono::Utc::now();
                    break;
                }
            }
        }
    }
    
    async fn update_task_output(&self, project_id: &str, task_id: &str, output: Option<Value>) {
        let mut tasks = self.state.tasks.write();
        if let Some(project_tasks) = tasks.get_mut(project_id) {
            for task in project_tasks.iter_mut() {
                if task.id == task_id {
                    task.output = output;
                    task.completed_at = Some(chrono::Utc::now());
                    break;
                }
            }
        }
    }
    
    async fn update_task_error(&self, project_id: &str, task_id: &str, error: Option<String>) {
        let mut tasks = self.state.tasks.write();
        if let Some(project_tasks) = tasks.get_mut(project_id) {
            for task in project_tasks.iter_mut() {
                if task.id == task_id {
                    task.error = error;
                    task.status = TaskStatus::Failed;
                    break;
                }
            }
        }
    }
}

impl Clone for TaskRunner {
    fn clone(&self) -> Self {
        Self {
            executor: Arc::clone(&self.executor),
            state: Arc::clone(&self.state),
            running_tasks: Arc::clone(&self.running_tasks),
        }
    }
}