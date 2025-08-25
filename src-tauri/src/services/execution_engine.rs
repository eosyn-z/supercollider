use std::sync::Arc;
use tokio::sync::mpsc;
use parking_lot::RwLock;
use uuid::Uuid;
use chrono::Utc;
use serde_json::json;
use crate::models::{Project, ProjectStatus, Task, TaskStatus};
use crate::state::AppState;
use crate::services::{TaskScheduler, TaskShredder, AgentPool, ContextPool, ContextEntry, ContextType};

pub struct ExecutionEngine {
    state: Arc<AppState>,
    scheduler: Arc<TaskScheduler>,
    shredder: Arc<TaskShredder>,
    agent_pool: Arc<AgentPool>,
    context_pool: Arc<ContextPool>,
    event_tx: mpsc::Sender<ExecutionEvent>,
    event_rx: Arc<RwLock<mpsc::Receiver<ExecutionEvent>>>,
}

#[derive(Debug, Clone)]
pub enum ExecutionEvent {
    ProjectStarted(String),
    ProjectCompleted(String),
    ProjectFailed(String, String),
    TaskStarted(String, String), // project_id, task_id
    TaskCompleted(String, String),
    TaskFailed(String, String, String), // project_id, task_id, error
    ClarificationNeeded(String, Vec<String>), // project_id, questions
    ApprovalNeeded(String, String), // project_id, task_id
}

impl ExecutionEngine {
    pub fn new(state: Arc<AppState>) -> Self {
        let (event_tx, event_rx) = mpsc::channel(1000);
        
        let scheduler = Arc::new(TaskScheduler::new(Arc::clone(&state)));
        let shredder = Arc::new(TaskShredder::new(Arc::clone(&state)));
        let agent_pool = Arc::new(AgentPool::new(Arc::clone(&state)));
        let context_pool = Arc::new(ContextPool::new());
        
        Self {
            state,
            scheduler,
            shredder,
            agent_pool,
            context_pool,
            event_tx,
            event_rx: Arc::new(RwLock::new(event_rx)),
        }
    }
    
    pub async fn initialize(&self) -> anyhow::Result<()> {
        // Initialize agent pool
        self.agent_pool.initialize().await?;
        
        // Start scheduler
        let scheduler = Arc::clone(&self.scheduler);
        tokio::spawn(async move {
            scheduler.run().await;
        });
        
        // Start event processor
        let engine = self.clone();
        tokio::spawn(async move {
            engine.process_events().await;
        });
        
        // Start context cleanup
        let context_pool = Arc::clone(&self.context_pool);
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(300));
            loop {
                interval.tick().await;
                context_pool.cleanup_expired();
            }
        });
        
        Ok(())
    }
    
    pub async fn start_project(&self, project: Project) -> anyhow::Result<String> {
        let project_id = project.id.clone();
        
        // Save project to state
        {
            let mut projects = self.state.projects.write();
            projects.insert(project_id.clone(), project.clone());
        }
        
        // Persist to storage
        self.state.storage.save_json(&format!("project_{}.json", project_id), &project)?;
        
        // Shred project into tasks
        let tasks = self.shredder.shred_project(&project).await?;
        
        // Store tasks
        {
            let mut task_map = self.state.tasks.write();
            task_map.insert(project_id.clone(), tasks.clone());
        }
        
        // Enqueue tasks
        for task in tasks {
            if task.status == TaskStatus::Queued {
                self.scheduler.sender()
                    .send(crate::services::SchedulerCommand::EnqueueTask(
                        project_id.clone(),
                        task.id.clone(),
                    ))
                    .await?;
            }
        }
        
        // Start scheduler
        self.scheduler.sender()
            .send(crate::services::SchedulerCommand::Start)
            .await?;
        
        // Send event
        self.event_tx.send(ExecutionEvent::ProjectStarted(project_id.clone())).await?;
        
        Ok(project_id)
    }
    
    pub async fn pause_project(&self, project_id: &str) -> anyhow::Result<()> {
        let mut projects = self.state.projects.write();
        if let Some(project) = projects.get_mut(project_id) {
            project.status = ProjectStatus::Paused;
        }
        
        self.scheduler.sender()
            .send(crate::services::SchedulerCommand::Pause)
            .await?;
        
        Ok(())
    }
    
    pub async fn resume_project(&self, project_id: &str) -> anyhow::Result<()> {
        let mut projects = self.state.projects.write();
        if let Some(project) = projects.get_mut(project_id) {
            project.status = ProjectStatus::Running;
        }
        
        self.scheduler.sender()
            .send(crate::services::SchedulerCommand::Resume)
            .await?;
        
        Ok(())
    }
    
    pub async fn cancel_project(&self, project_id: &str) -> anyhow::Result<()> {
        let mut projects = self.state.projects.write();
        if let Some(project) = projects.get_mut(project_id) {
            project.status = ProjectStatus::Cancelled;
        }
        
        // Cancel all tasks
        let mut tasks = self.state.tasks.write();
        if let Some(project_tasks) = tasks.get_mut(project_id) {
            for task in project_tasks.iter_mut() {
                if task.status == TaskStatus::Queued || task.status == TaskStatus::Running {
                    task.status = TaskStatus::Cancelled;
                }
            }
        }
        
        // Clear context
        self.context_pool.clear_project_context(project_id);
        
        Ok(())
    }
    
    pub async fn execute_task(&self, project_id: &str, task_id: &str) -> anyhow::Result<()> {
        let (task, agent_name) = {
            let tasks = self.state.tasks.read();
            let task = tasks
                .get(project_id)
                .and_then(|pt| pt.iter().find(|t| t.id == task_id))
                .ok_or_else(|| anyhow::anyhow!("Task not found"))?
                .clone();
            
            // Find suitable agent
            let available_agents = self.agent_pool.get_available_agents(&task.capability);
            let agent_name = available_agents
                .first()
                .ok_or_else(|| anyhow::anyhow!("No available agent for capability"))?
                .clone();
            
            (task, agent_name)
        };
        
        // Send task started event
        self.event_tx.send(ExecutionEvent::TaskStarted(project_id.to_string(), task_id.to_string())).await?;
        
        // Execute task via agent pool
        let response = self.agent_pool.execute_task(&agent_name, &task).await?;
        
        if response.success {
            // Store output in context pool
            let context_entry = ContextEntry {
                id: format!("ctx-{}", Uuid::new_v4()),
                project_id: project_id.to_string(),
                task_id: task_id.to_string(),
                content_type: ContextType::TaskOutput,
                content: response.output.unwrap_or(json!({})),
                metadata: [
                    ("agent".to_string(), json!(agent_name)),
                    ("tokens_used".to_string(), json!(response.tokens_used)),
                    ("execution_time_ms".to_string(), json!(response.execution_time_ms)),
                ].iter().cloned().collect(),
                created_at: Utc::now(),
                updated_at: Utc::now(),
                references: task.input_chain.clone(),
                ttl_seconds: Some(3600),
            };
            
            self.context_pool.add_context(context_entry)?;
            
            // Update task status
            let mut tasks = self.state.tasks.write();
            if let Some(project_tasks) = tasks.get_mut(project_id) {
                if let Some(task) = project_tasks.iter_mut().find(|t| t.id == task_id) {
                    task.output = response.output;
                    task.status = TaskStatus::Completed;
                    task.completed_at = Some(Utc::now());
                    task.last_agent = Some(agent_name.clone());
                    // Store a non-sensitive key hint if available
                    if let Some(agent) = self.agent_pool.get_available_agents(&task.capability).iter().find(|n| *n == &agent_name) {
                        // We don't have API key here; rely on environment provider hint
                        // Try to infer from metadata if present
                        if let Some(meta) = task.metadata.as_ref() {
                            if let Some(provider) = meta.get("provider").and_then(|v| v.as_str()) {
                                task.last_agent_key_hint = Some(provider.to_string());
                            }
                        }
                    }
                    if !task.user_edited && task.retry_count == 0 && task.error.is_none() {
                        task.oneshot_count = task.oneshot_count.saturating_add(1);
                    }
                    let _ = self.state.storage.save_json(
                        &format!("task_{}_{}.json", project_id, task_id),
                        &task,
                    );
                }
            }
            
            // Send completion event
            self.event_tx.send(ExecutionEvent::TaskCompleted(
                project_id.to_string(),
                task_id.to_string(),
            )).await?;
            
            // Notify scheduler
            self.scheduler.sender()
                .send(crate::services::SchedulerCommand::TaskCompleted(
                    project_id.to_string(),
                    task_id.to_string(),
                ))
                .await?;
        } else {
            let error = response.error.unwrap_or_else(|| "Unknown error".to_string());
            
            // Send failure event
            self.event_tx.send(ExecutionEvent::TaskFailed(
                project_id.to_string(),
                task_id.to_string(),
                error.clone(),
            )).await?;
            
            // Notify scheduler
            self.scheduler.sender()
                .send(crate::services::SchedulerCommand::TaskFailed(
                    project_id.to_string(),
                    task_id.to_string(),
                    error,
                ))
                .await?;
        }
        
        Ok(())
    }
    
    pub async fn submit_clarification(&self, project_id: &str, answers: Vec<String>) -> anyhow::Result<()> {
        // Store clarification in context
        let context_entry = ContextEntry {
            id: format!("ctx-{}", Uuid::new_v4()),
            project_id: project_id.to_string(),
            task_id: String::new(),
            content_type: ContextType::Document,
            content: json!({
                "type": "clarification",
                "answers": answers,
            }),
            metadata: [
                ("timestamp".to_string(), json!(Utc::now())),
            ].iter().cloned().collect(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
            references: vec![],
            ttl_seconds: None,
        };
        
        self.context_pool.add_context(context_entry)?;
        
        // Update project status
        let mut projects = self.state.projects.write();
        if let Some(project) = projects.get_mut(project_id) {
            if project.status == ProjectStatus::WaitingClarification {
                project.status = ProjectStatus::Queued;
            }
        }
        
        // Resume scheduler
        self.scheduler.sender()
            .send(crate::services::SchedulerCommand::Resume)
            .await?;
        
        Ok(())
    }
    
    pub async fn approve_task(&self, project_id: &str, task_id: &str, approved: bool) -> anyhow::Result<()> {
        let mut tasks = self.state.tasks.write();
        if let Some(project_tasks) = tasks.get_mut(project_id) {
            if let Some(task) = project_tasks.iter_mut().find(|t| t.id == task_id) {
                if approved {
                    task.status = TaskStatus::Queued;
                    task.approval_required = false;
                    
                    // Re-enqueue task
                    self.scheduler.sender()
                        .send(crate::services::SchedulerCommand::EnqueueTask(
                            project_id.to_string(),
                            task_id.to_string(),
                        ))
                        .await?;
                } else {
                    task.status = TaskStatus::Cancelled;
                }
            }
        }
        
        Ok(())
    }
    
    async fn process_events(&self) {
        loop {
            if let Ok(event) = self.event_rx.write().recv().await {
                match event {
                    ExecutionEvent::ProjectCompleted(project_id) => {
                        // Update project status
                        let mut projects = self.state.projects.write();
                        if let Some(project) = projects.get_mut(&project_id) {
                            project.status = ProjectStatus::Completed;
                            project.updated_at = Utc::now();
                        }
                        
                        // Persist to storage
                        if let Some(project) = projects.get(&project_id) {
                            let _ = self.state.storage.save_json(
                                &format!("project_{}.json", project_id),
                                project,
                            );
                        }
                    }
                    ExecutionEvent::TaskStarted(project_id, task_id) => {
                        // Could emit real-time updates via Tauri events
                        println!("Task started: {} in project {}", task_id, project_id);
                    }
                    ExecutionEvent::TaskCompleted(project_id, task_id) => {
                        // Check if all tasks are complete
                        let all_complete = {
                            let tasks = self.state.tasks.read();
                            tasks.get(&project_id)
                                .map(|pt| pt.iter().all(|t| t.status == TaskStatus::Completed))
                                .unwrap_or(false)
                        };
                        
                        if all_complete {
                            let _ = self.event_tx.send(ExecutionEvent::ProjectCompleted(project_id)).await;
                        }
                    }
                    _ => {
                        // Handle other events
                    }
                }
            }
        }
    }
    
    pub fn get_event_sender(&self) -> mpsc::Sender<ExecutionEvent> {
        self.event_tx.clone()
    }
}

impl Clone for ExecutionEngine {
    fn clone(&self) -> Self {
        Self {
            state: Arc::clone(&self.state),
            scheduler: Arc::clone(&self.scheduler),
            shredder: Arc::clone(&self.shredder),
            agent_pool: Arc::clone(&self.agent_pool),
            context_pool: Arc::clone(&self.context_pool),
            event_tx: self.event_tx.clone(),
            event_rx: Arc::clone(&self.event_rx),
        }
    }
}