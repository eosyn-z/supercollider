use std::collections::{HashMap, VecDeque};
use std::sync::Arc;
use parking_lot::RwLock;
use tokio::sync::mpsc;
use tokio::time::{interval, Duration};
use chrono::Utc;
use crate::models::{Task, TaskStatus, Project, ProjectStatus, Capability};
use crate::state::AppState;
use rand::seq::SliceRandom;
use rand::thread_rng;

pub struct TaskScheduler {
    state: Arc<AppState>,
    queue: Arc<RwLock<VecDeque<String>>>, // Task IDs
    active_tasks: Arc<RwLock<HashMap<String, String>>>, // Task ID -> Agent Name
    tx: mpsc::Sender<SchedulerCommand>,
    rx: Arc<RwLock<mpsc::Receiver<SchedulerCommand>>>,
    free_rotation: Arc<RwLock<HashMap<Capability, usize>>>,
}

#[derive(Debug, Clone)]
pub enum SchedulerCommand {
    Start,
    Pause,
    Resume,
    Stop,
    EnqueueTask(String, String), // project_id, task_id
    TaskCompleted(String, String), // project_id, task_id
    TaskFailed(String, String, String), // project_id, task_id, error
    ReorderQueue(Vec<String>),
}

impl TaskScheduler {
    pub fn new(state: Arc<AppState>) -> Self {
        let (tx, rx) = mpsc::channel(100);
        
        Self {
            state,
            queue: Arc::new(RwLock::new(VecDeque::new())),
            active_tasks: Arc::new(RwLock::new(HashMap::new())),
            tx,
            rx: Arc::new(RwLock::new(rx)),
            free_rotation: Arc::new(RwLock::new(HashMap::new())),
        }
    }
    
    pub fn sender(&self) -> mpsc::Sender<SchedulerCommand> {
        self.tx.clone()
    }
    
    pub async fn run(&self) {
        let mut interval = interval(Duration::from_millis(100));
        let mut is_running = false;
        
        loop {
            interval.tick().await;
            
            // Process commands
            if let Ok(cmd) = self.rx.write().try_recv() {
                match cmd {
                    SchedulerCommand::Start | SchedulerCommand::Resume => {
                        is_running = true;
                    }
                    SchedulerCommand::Pause | SchedulerCommand::Stop => {
                        is_running = false;
                    }
                    SchedulerCommand::EnqueueTask(project_id, task_id) => {
                        self.enqueue_task(&project_id, &task_id);
                    }
                    SchedulerCommand::TaskCompleted(project_id, task_id) => {
                        self.handle_task_completed(&project_id, &task_id).await;
                    }
                    SchedulerCommand::TaskFailed(project_id, task_id, error) => {
                        self.handle_task_failed(&project_id, &task_id, &error).await;
                    }
                    SchedulerCommand::ReorderQueue(new_order) => {
                        let mut queue = self.queue.write();
                        queue.clear();
                        for task_id in new_order {
                            queue.push_back(task_id);
                        }
                    }
                }
            }
            
            if is_running {
                self.process_queue().await;
            }
        }
    }
    
    fn enqueue_task(&self, project_id: &str, task_id: &str) {
        let mut tasks = self.state.tasks.write();
        if let Some(project_tasks) = tasks.get_mut(project_id) {
            for task in project_tasks.iter_mut() {
                if task.id == task_id {
                    task.status = TaskStatus::Queued;
                    break;
                }
            }
        }
        
        let queue_id = format!("{}:{}", project_id, task_id);
        self.queue.write().push_back(queue_id);
    }
    
    async fn process_queue(&self) {
        let max_concurrent = self.get_max_concurrent_tasks();
        let active_count = self.active_tasks.read().len();
        
        if active_count >= max_concurrent {
            return;
        }
        
        let mut queue = self.queue.write();
        while let Some(queue_id) = queue.pop_front() {
            let parts: Vec<&str> = queue_id.split(':').collect();
            if parts.len() != 2 {
                continue;
            }
            
            let project_id = parts[0];
            let task_id = parts[1];
            
            // Check if task is ready (dependencies met)
            if !self.are_dependencies_met(project_id, task_id) {
                queue.push_back(queue_id);
                continue;
            }
            
            // Find suitable agent for task
            if let Some(agent_name) = self.find_suitable_agent(project_id, task_id).await {
                self.active_tasks.write().insert(queue_id.clone(), agent_name.clone());
                self.start_task_execution(project_id, task_id, &agent_name).await;
                
                if self.active_tasks.read().len() >= max_concurrent {
                    break;
                }
            } else {
                // No suitable agent available, re-queue
                queue.push_back(queue_id);
                break;
            }
        }
    }
    
    fn are_dependencies_met(&self, project_id: &str, task_id: &str) -> bool {
        let tasks = self.state.tasks.read();
        if let Some(project_tasks) = tasks.get(project_id) {
            if let Some(task) = project_tasks.iter().find(|t| t.id == task_id) {
                for dep_id in &task.dependencies {
                    if let Some(dep_task) = project_tasks.iter().find(|t| &t.id == dep_id) {
                        if dep_task.status != TaskStatus::Completed {
                            return false;
                        }
                    }
                }
                return true;
            }
        }
        false
    }
    
    async fn find_suitable_agent(&self, project_id: &str, task_id: &str) -> Option<String> {
        let tasks = self.state.tasks.read();
        let agents = self.state.agents.read();
        
        if let Some(project_tasks) = tasks.get(project_id) {
            if let Some(task) = project_tasks.iter().find(|t| t.id == task_id) {
                // Find agents with matching capability
                let suitable_agents: Vec<_> = agents
                    .iter()
                    .filter(|a| a.enabled && a.capabilities.contains(&task.capability))
                    .collect();
                
                if suitable_agents.is_empty() {
                    return None;
                }
                
                // Partition into free vs non-free agents
                let mut free_agents: Vec<_> = suitable_agents
                    .iter()
                    .cloned()
                    .filter(|a| {
                        a.local || a.auth.as_ref().map_or(true, |auth| auth.api_key.is_none() && auth.bearer_token.is_none())
                    })
                    .collect();

                if !free_agents.is_empty() {
                    // If all priorities are zero, pick random
                    let all_zero_priority = free_agents.iter().all(|a| a.priority == 0);
                    if all_zero_priority {
                        let mut rng = thread_rng();
                        free_agents.shuffle(&mut rng);
                        // pick the first with capacity
                        for agent in free_agents {
                            if self.get_agent_load(&agent.name) < agent.max_concurrent_tasks {
                                return Some(agent.name.clone());
                            }
                        }
                    } else {
                        // Cycle through free agents deterministically per capability
                        // Sort by priority desc to honor priority among free agents
                        free_agents.sort_by_key(|a| -a.priority);
                        let mut rotation = self.free_rotation.write();
                        let idx = rotation.entry(task.capability.clone()).or_insert(0);
                        let start = *idx;
                        for offset in 0..free_agents.len() {
                            let i = (start + offset) % free_agents.len();
                            let agent = &free_agents[i];
                            if self.get_agent_load(&agent.name) < agent.max_concurrent_tasks {
                                *idx = (i + 1) % free_agents.len();
                                return Some(agent.name.clone());
                            }
                        }
                    }
                    // If none had capacity, fall through to non-free selection
                }

                // Fallback to existing selection across all suitable agents by load, then priority
                let mut best_agent = suitable_agents[0];
                let mut min_load = self.get_agent_load(&best_agent.name);
                for agent in suitable_agents.iter().skip(1) {
                    let load = self.get_agent_load(&agent.name);
                    if load < min_load || (load == min_load && agent.priority > best_agent.priority) {
                        best_agent = agent;
                        min_load = load;
                    }
                }
                if min_load < best_agent.max_concurrent_tasks {
                    return Some(best_agent.name.clone());
                }
            }
        }
        None
    }
    
    fn get_agent_load(&self, agent_name: &str) -> usize {
        self.active_tasks
            .read()
            .values()
            .filter(|name| *name == agent_name)
            .count()
    }
    
    async fn start_task_execution(&self, project_id: &str, task_id: &str, agent_name: &str) {
        let mut tasks = self.state.tasks.write();
        if let Some(project_tasks) = tasks.get_mut(project_id) {
            for task in project_tasks.iter_mut() {
                if task.id == task_id {
                    task.status = TaskStatus::Running;
                    task.started_at = Some(Utc::now());
                    break;
                }
            }
        }
        
        // Update project status if needed
        let mut projects = self.state.projects.write();
        if let Some(project) = projects.get_mut(project_id) {
            if project.status == ProjectStatus::Queued {
                project.status = ProjectStatus::Running;
            }
        }
        
        // TODO: Actually send task to agent for execution
        // This would involve calling the agent service
    }
    
    async fn handle_task_completed(&self, project_id: &str, task_id: &str) {
        let queue_id = format!("{}:{}", project_id, task_id);
        self.active_tasks.write().remove(&queue_id);
        
        let mut tasks = self.state.tasks.write();
        if let Some(project_tasks) = tasks.get_mut(project_id) {
            for task in project_tasks.iter_mut() {
                if task.id == task_id {
                    task.status = TaskStatus::Completed;
                    task.completed_at = Some(Utc::now());
                    break;
                }
            }
            
            // Check if all tasks are completed
            let all_completed = project_tasks.iter().all(|t| t.status == TaskStatus::Completed);
            if all_completed {
                drop(tasks);
                let mut projects = self.state.projects.write();
                if let Some(project) = projects.get_mut(project_id) {
                    project.status = ProjectStatus::Completed;
                    project.completed_tasks = project_tasks.len();
                }
            }
        }
        
        // Process any unblocked tasks
        self.check_for_unblocked_tasks(project_id);
    }
    
    async fn handle_task_failed(&self, project_id: &str, task_id: &str, error: &str) {
        let queue_id = format!("{}:{}", project_id, task_id);
        self.active_tasks.write().remove(&queue_id);
        
        let mut tasks = self.state.tasks.write();
        if let Some(project_tasks) = tasks.get_mut(project_id) {
            for task in project_tasks.iter_mut() {
                if task.id == task_id {
                    task.status = TaskStatus::Failed;
                    task.error = Some(error.to_string());
                    task.completed_at = Some(Utc::now());
                    
                    // Check retry policy
                    if task.retry_count < 3 {
                        task.retry_count += 1;
                        task.status = TaskStatus::Queued;
                        self.queue.write().push_back(queue_id);
                    }
                    break;
                }
            }
        }
    }
    
    fn check_for_unblocked_tasks(&self, project_id: &str) {
        let tasks = self.state.tasks.read();
        if let Some(project_tasks) = tasks.get(project_id) {
            for task in project_tasks {
                if task.status == TaskStatus::Blocked && self.are_dependencies_met(project_id, &task.id) {
                    let queue_id = format!("{}:{}", project_id, task.id);
                    self.queue.write().push_back(queue_id);
                }
            }
        }
    }
    
    fn get_max_concurrent_tasks(&self) -> usize {
        // This could be configurable
        4
    }
}