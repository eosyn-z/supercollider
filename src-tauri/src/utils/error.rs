use thiserror::Error;
use serde::Serialize;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Storage error: {0}")]
    Storage(#[from] std::io::Error),
    
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
    
    #[error("Agent not found: {0}")]
    AgentNotFound(String),
    
    #[error("Project not found: {0}")]
    ProjectNotFound(String),
    
    #[error("Task not found: {0}")]
    TaskNotFound(String),
    
    #[error("Invalid state transition: {0}")]
    InvalidStateTransition(String),
    
    #[error("Dependency cycle detected")]
    DependencyCycle,
    
    #[error("No capable agent available for task")]
    NoCapableAgent,
    
    #[error("Token limit exceeded: used {used}, limit {limit}")]
    TokenLimitExceeded { used: u32, limit: u32 },
    
    #[error("Clarity score too low: {score}")]
    LowClarityScore { score: f32 },
    
    #[error("External API error: {0}")]
    ExternalApi(String),
    
    #[error("Configuration error: {0}")]
    Configuration(String),
    
    #[error("General error: {0}")]
    General(#[from] anyhow::Error),
}

#[derive(Serialize)]
pub struct ErrorResponse {
    pub ok: bool,
    pub error: String,
    pub error_type: String,
}

impl From<AppError> for ErrorResponse {
    fn from(error: AppError) -> Self {
        ErrorResponse {
            ok: false,
            error: error.to_string(),
            error_type: match error {
                AppError::Storage(_) => "storage",
                AppError::Serialization(_) => "serialization",
                AppError::AgentNotFound(_) => "agent_not_found",
                AppError::ProjectNotFound(_) => "project_not_found",
                AppError::TaskNotFound(_) => "task_not_found",
                AppError::InvalidStateTransition(_) => "invalid_state",
                AppError::DependencyCycle => "dependency_cycle",
                AppError::NoCapableAgent => "no_capable_agent",
                AppError::TokenLimitExceeded { .. } => "token_limit",
                AppError::LowClarityScore { .. } => "low_clarity",
                AppError::ExternalApi(_) => "external_api",
                AppError::Configuration(_) => "configuration",
                AppError::General(_) => "general",
            }.to_string(),
        }
    }
}

impl From<AppError> for String {
    fn from(error: AppError) -> Self {
        error.to_string()
    }
}

pub type AppResult<T> = Result<T, AppError>;