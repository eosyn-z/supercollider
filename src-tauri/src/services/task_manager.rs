use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use anyhow::{Context, Result};
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Task {
    pub task_id: String,
    #[serde(rename = "type")]
    pub task_type: String,
    pub capability: String,
    pub description: String,
    pub preamble: String,
    pub token_limit: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dependencies: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub input_chain: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_priority: Option<u8>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub priority_override: Option<u8>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub manual_agent_override: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub approval_required: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub clarity_prompt: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub template_source: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub modified: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_modified: Option<DateTime<Utc>>,
}

pub struct TaskManager {
    base_path: PathBuf,
    defaults_path: PathBuf,
    tasks_path: PathBuf,
    defaults_cache: HashMap<String, Task>,
}

impl TaskManager {
    pub fn new(base_path: PathBuf) -> Result<Self> {
        let defaults_path = base_path.join("TASKDEFAULTS");
        let tasks_path = base_path.join("TASKS");
        
        // Ensure directories exist
        fs::create_dir_all(&defaults_path)?;
        fs::create_dir_all(&tasks_path)?;
        
        let mut manager = Self {
            base_path,
            defaults_path,
            tasks_path,
            defaults_cache: HashMap::new(),
        };
        
        manager.load_defaults()?;
        Ok(manager)
    }
    
    /// Load all default templates from TASKDEFAULTS folder
    pub fn load_defaults(&mut self) -> Result<()> {
        self.defaults_cache.clear();
        
        // Read all JSON files in TASKDEFAULTS
        for entry in fs::read_dir(&self.defaults_path)? {
            let entry = entry?;
            let path = entry.path();
            
            if path.extension().and_then(|s| s.to_str()) == Some("json") {
                let content = fs::read_to_string(&path)
                    .context(format!("Failed to read {:?}", path))?;
                
                let templates: HashMap<String, Task> = serde_json::from_str(&content)
                    .context(format!("Failed to parse {:?}", path))?;
                
                self.defaults_cache.extend(templates);
            }
        }
        
        Ok(())
    }
    
    /// Get all default templates
    pub fn get_defaults(&self) -> &HashMap<String, Task> {
        &self.defaults_cache
    }
    
    /// Get a specific default template
    pub fn get_default(&self, template_id: &str) -> Option<&Task> {
        self.defaults_cache.get(template_id)
    }
    
    /// Save a task to the TASKS folder
    pub fn save_task(&self, project_id: &str, task: &Task) -> Result<String> {
        let project_path = self.tasks_path.join(project_id);
        fs::create_dir_all(&project_path)?;
        
        let file_path = project_path.join(format!("{}.json", task.task_id));
        
        // Mark as modified if it differs from default
        let mut task_to_save = task.clone();
        if let Some(template_source) = &task.template_source {
            if let Some(default) = self.defaults_cache.get(template_source) {
                if !tasks_equal(&task_to_save, default) {
                    task_to_save.modified = Some(true);
                    task_to_save.last_modified = Some(Utc::now());
                }
            }
        }
        
        let content = serde_json::to_string_pretty(&task_to_save)?;
        fs::write(&file_path, content)?;
        
        Ok(task_to_save.task_id.clone())
    }
    
    /// Load a task from the TASKS folder
    pub fn load_task(&self, project_id: &str, task_id: &str) -> Result<Task> {
        let file_path = self.tasks_path
            .join(project_id)
            .join(format!("{}.json", task_id));
        
        let content = fs::read_to_string(&file_path)
            .context(format!("Failed to read task {:?}", file_path))?;
        
        let task: Task = serde_json::from_str(&content)
            .context(format!("Failed to parse task {:?}", file_path))?;
        
        Ok(task)
    }
    
    /// List all tasks for a project
    pub fn list_project_tasks(&self, project_id: &str) -> Result<Vec<Task>> {
        let project_path = self.tasks_path.join(project_id);
        
        if !project_path.exists() {
            return Ok(Vec::new());
        }
        
        let mut tasks = Vec::new();
        
        for entry in fs::read_dir(&project_path)? {
            let entry = entry?;
            let path = entry.path();
            
            if path.extension().and_then(|s| s.to_str()) == Some("json") {
                let content = fs::read_to_string(&path)?;
                if let Ok(task) = serde_json::from_str::<Task>(&content) {
                    tasks.push(task);
                }
            }
        }
        
        Ok(tasks)
    }
    
    /// List all tasks across all projects
    pub fn list_all_tasks(&self) -> Result<Vec<Task>> {
        let mut all_tasks = Vec::new();
        
        if !self.tasks_path.exists() {
            return Ok(all_tasks);
        }
        
        for entry in fs::read_dir(&self.tasks_path)? {
            let entry = entry?;
            let path = entry.path();
            
            if path.is_dir() {
                if let Some(project_id) = path.file_name().and_then(|s| s.to_str()) {
                    let project_tasks = self.list_project_tasks(project_id)?;
                    all_tasks.extend(project_tasks);
                }
            }
        }
        
        Ok(all_tasks)
    }
    
    /// Update a task
    pub fn update_task(&self, project_id: &str, task_id: &str, partial: serde_json::Value) -> Result<()> {
        let mut task = self.load_task(project_id, task_id)?;
        
        // Merge partial update into existing task
        if let Ok(partial_task) = serde_json::from_value::<Task>(partial.clone()) {
            // Update fields that are present in partial
            if partial["description"].is_string() {
                task.description = partial_task.description;
            }
            if partial["preamble"].is_string() {
                task.preamble = partial_task.preamble;
            }
            if partial["token_limit"].is_number() {
                task.token_limit = partial_task.token_limit;
            }
            // ... update other fields as needed
            
            task.modified = Some(true);
            task.last_modified = Some(Utc::now());
        }
        
        self.save_task(project_id, &task)?;
        Ok(())
    }
    
    /// Delete a task
    pub fn delete_task(&self, project_id: &str, task_id: &str) -> Result<()> {
        let file_path = self.tasks_path
            .join(project_id)
            .join(format!("{}.json", task_id));
        
        if file_path.exists() {
            fs::remove_file(&file_path)?;
        }
        
        Ok(())
    }
    
    /// Reset a task to its default template
    pub fn reset_to_default(&self, project_id: &str, task_id: &str) -> Result<()> {
        let task = self.load_task(project_id, task_id)?;
        
        if let Some(template_source) = &task.template_source {
            if let Some(default_template) = self.defaults_cache.get(template_source) {
                let mut reset_task = default_template.clone();
                reset_task.task_id = task_id.to_string();
                reset_task.modified = Some(false);
                reset_task.last_modified = None;
                reset_task.template_source = Some(template_source.clone());
                
                self.save_task(project_id, &reset_task)?;
            }
        }
        
        Ok(())
    }
}

/// Helper function to compare tasks
fn tasks_equal(task1: &Task, task2: &Task) -> bool {
    task1.description == task2.description &&
    task1.preamble == task2.preamble &&
    task1.token_limit == task2.token_limit &&
    task1.capability == task2.capability &&
    task1.task_type == task2.task_type
}