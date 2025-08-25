use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: String,
    pub project_type: ProjectType,
    pub prompt: String,
    // Original user-entered prompt to preserve source even if prompt mutates
    #[serde(default)]
    pub initial_prompt: Option<String>,
    pub status: ProjectStatus,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub config_override: Option<serde_json::Value>,
    pub clarity_score: f32,
    pub tasks_count: usize,
    pub completed_tasks: usize,
    // Shredder/analysis associations for hot load/unload
    #[serde(default)]
    pub elaboration: Option<String>,
    #[serde(default)]
    pub shredder_atoms: Vec<String>,
    #[serde(default)]
    pub shredder_atomic_task_types: Vec<String>,
    #[serde(default)]
    pub shredder_questions: Vec<String>,
    #[serde(default)]
    pub shredder_raw: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProjectType {
    CodingProject,
    DataAnalysis,
    Research,
    Writing,
    Design,
    Marketing,
    Custom,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ProjectStatus {
    Queued,
    Running,
    Paused,
    Completed,
    Failed,
    Cancelled,
    WaitingClarification,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Task {
    pub id: String,
    pub project_id: String,
    pub task_type: String,
    pub capability: Capability,
    pub status: TaskStatus,
    pub dependencies: Vec<String>,
    pub input_chain: Vec<String>,
    pub input: serde_json::Value,
    pub output: Option<serde_json::Value>,
    pub preamble: Option<String>,
    pub metadata: Option<serde_json::Value>,
    pub updated_at: DateTime<Utc>,
    pub token_limit: u32,
    pub priority_override: Option<i32>,
    pub approval_required: bool,
    pub created_at: DateTime<Utc>,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub error: Option<String>,
    pub retry_count: u32,
    #[serde(default)]
    pub user_edited: bool,
    #[serde(default)]
    pub oneshot_count: u32,
    #[serde(default)]
    pub last_agent: Option<String>,
    #[serde(default)]
    pub last_agent_key_hint: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TaskStatus {
    Queued,
    Running,
    Completed,
    Failed,
    Blocked,
    WaitingClarification,
    Paused,
    Cancelled,
    WaitingApproval,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum Capability {
    Text,
    Code,
    Image,
    Sound,
    Video,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Agent {
    pub name: String,
    pub capabilities: Vec<Capability>,
    pub endpoint_url: Option<String>,
    pub auth: Option<AgentAuth>,
    pub enabled: bool,
    pub priority: i32,
    pub health: AgentHealth,
    pub local: bool,
    pub max_concurrent_tasks: usize,
    pub token_limit: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentAuth {
    pub auth_type: String,
    pub api_key: Option<String>,
    pub bearer_token: Option<String>,
    pub custom_headers: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentHealth {
    pub status: HealthStatus,
    pub last_check: DateTime<Utc>,
    pub latency_ms: Option<u32>,
    pub error_rate: f32,
    pub success_count: u32,
    pub failure_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum HealthStatus {
    Healthy,
    Degraded,
    Unhealthy,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub theme: String,
    pub auto_start_queue: bool,
    pub notifications_enabled: bool,
    pub daily_token_budget: Option<u32>,
    pub agent_priorities: HashMap<Capability, Vec<String>>,
    pub default_token_limits: HashMap<Capability, u32>,
    pub storage_path: String,
    pub backup_enabled: bool,
    pub backup_interval_hours: u32,
    pub ignore_task_token_limits: bool,
}

impl Default for AppConfig {
    fn default() -> Self {
        let mut agent_priorities = HashMap::new();
        agent_priorities.insert(Capability::Text, vec!["LocalTextAgent".to_string()]);
        agent_priorities.insert(Capability::Code, vec!["LocalCodeAgent".to_string()]);
        
        let mut default_token_limits = HashMap::new();
        default_token_limits.insert(Capability::Text, 4000);
        default_token_limits.insert(Capability::Code, 8000);
        default_token_limits.insert(Capability::Image, 2000);
        default_token_limits.insert(Capability::Sound, 1000);
        default_token_limits.insert(Capability::Video, 1000);
        
        Self {
            theme: "system".to_string(),
            auto_start_queue: false,
            notifications_enabled: true,
            daily_token_budget: Some(100000),
            agent_priorities,
            default_token_limits,
            storage_path: String::new(),
            backup_enabled: true,
            backup_interval_hours: 24,
            ignore_task_token_limits: false,
        }
    }
}