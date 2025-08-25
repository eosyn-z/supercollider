use crate::models::{Agent, AgentHealth, HealthStatus, Capability};
use crate::state::AppState;
use crate::utils::AppResult;
use serde::{Deserialize, Serialize};
use serde_json::json;
use chrono::Utc;
use std::fs;
use std::path::PathBuf;

#[derive(Deserialize)]
pub struct AgentRegisterRequest {
    pub agent: Agent,
}

#[derive(Serialize)]
pub struct AgentResponse {
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub agent: Option<Agent>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Serialize)]
pub struct AgentsListResponse {
    pub ok: bool,
    pub agents: Vec<Agent>,
}

#[tauri::command]
pub fn agents_register(
    state: tauri::State<AppState>,
    payload: AgentRegisterRequest,
) -> Result<serde_json::Value, String> {
    let mut agent = payload.agent;
    
    // Initialize health if not provided
    if agent.health.status == HealthStatus::Unknown {
        agent.health = AgentHealth {
            status: HealthStatus::Unknown,
            last_check: Utc::now(),
            latency_ms: None,
            error_rate: 0.0,
            success_count: 0,
            failure_count: 0,
        };
    }
    
    // Add or update agent
    {
        let mut agents = state.agents.write();
        
        // Check if agent with same name exists
        if let Some(existing) = agents.iter_mut().find(|a| a.name == agent.name) {
            *existing = agent.clone();
        } else {
            agents.push(agent.clone());
        }
    }
    
    // Persist to storage
    let agents = state.agents.read().clone();
    if let Err(e) = state.storage.save_json("agents.json", &agents) {
        log::error!("Failed to save agents: {}", e);
    }
    
    Ok(json!({
        "ok": true,
        "agent": agent
    }))
}

#[tauri::command]
pub fn agents_list(state: tauri::State<AppState>) -> Result<AgentsListResponse, String> {
    let agents = state.agents.read();
    Ok(AgentsListResponse {
        ok: true,
        agents: agents.clone(),
    })
}

#[tauri::command]
pub fn agents_enable(
    state: tauri::State<AppState>,
    name: String,
    enabled: bool,
) -> Result<serde_json::Value, String> {
    let mut agents = state.agents.write();
    
    if let Some(agent) = agents.iter_mut().find(|a| a.name == name) {
        agent.enabled = enabled;
        
        // Persist changes
        if let Err(e) = state.storage.save_json("agents.json", &agents.clone()) {
            log::error!("Failed to save agents: {}", e);
        }
        
        Ok(json!({ "ok": true }))
    } else {
        Err(format!("Agent '{}' not found", name))
    }
}

#[tauri::command]
pub fn agents_delete(
    state: tauri::State<AppState>,
    name: String,
) -> Result<serde_json::Value, String> {
    let mut agents = state.agents.write();
    let initial_count = agents.len();
    
    agents.retain(|a| a.name != name);
    
    if agents.len() < initial_count {
        // Persist changes
        if let Err(e) = state.storage.save_json("agents.json", &agents.clone()) {
            log::error!("Failed to save agents: {}", e);
        }
        
        Ok(json!({ "ok": true }))
    } else {
        Err(format!("Agent '{}' not found", name))
    }
}

#[tauri::command]
pub fn agents_test(
    state: tauri::State<AppState>,
    name: String,
) -> Result<serde_json::Value, String> {
    let mut agents = state.agents.write();
    
    if let Some(agent) = agents.iter_mut().find(|a| a.name == name) {
        // Simulate health check
        let latency_ms = if agent.local { 0 } else { 50 + (rand::random::<u32>() % 100) };
        
        agent.health = AgentHealth {
            status: HealthStatus::Healthy,
            last_check: Utc::now(),
            latency_ms: Some(latency_ms),
            error_rate: 0.0,
            success_count: agent.health.success_count + 1,
            failure_count: agent.health.failure_count,
        };
        
        // Persist changes
        if let Err(e) = state.storage.save_json("agents.json", &agents.clone()) {
            log::error!("Failed to save agents: {}", e);
        }
        
        Ok(json!({
            "ok": true,
            "latency_ms": latency_ms,
            "health": "healthy"
        }))
    } else {
        Err(format!("Agent '{}' not found", name))
    }
}

#[derive(Deserialize)]
pub struct ImportAgentsRequest {
    pub previous_root: String,
}

#[tauri::command]
pub fn agents_register_free_defaults(state: tauri::State<AppState>) -> Result<serde_json::Value, String> {
    // Register a set of local "free" agents for text and code
    let mut agents = state.agents.write();
    let now = Utc::now();
    let free_text = crate::models::Agent {
        name: "FreeTextAgent".to_string(),
        capabilities: vec![crate::models::Capability::Text],
        endpoint_url: None,
        auth: None,
        enabled: true,
        priority: 0,
        health: crate::models::AgentHealth {
            status: crate::models::HealthStatus::Healthy,
            last_check: now,
            latency_ms: Some(0),
            error_rate: 0.0,
            success_count: 0,
            failure_count: 0,
        },
        local: true,
        max_concurrent_tasks: 2,
        token_limit: Some(4000),
    };
    let free_code = crate::models::Agent {
        name: "FreeCodeAgent".to_string(),
        capabilities: vec![crate::models::Capability::Code],
        endpoint_url: None,
        auth: None,
        enabled: true,
        priority: 0,
        health: crate::models::AgentHealth {
            status: crate::models::HealthStatus::Healthy,
            last_check: now,
            latency_ms: Some(0),
            error_rate: 0.0,
            success_count: 0,
            failure_count: 0,
        },
        local: true,
        max_concurrent_tasks: 2,
        token_limit: Some(8000),
    };
    // De-duplicate by name
    if !agents.iter().any(|a| a.name == free_text.name) { agents.push(free_text); }
    if !agents.iter().any(|a| a.name == free_code.name) { agents.push(free_code); }
    // Persist
    if let Err(e) = state.storage.save_json("agents.json", &agents.clone()) {
        log::error!("Failed to save agents: {}", e);
    }
    Ok(json!({ "ok": true }))
}

#[tauri::command]
pub fn agents_import_from_previous(state: tauri::State<AppState>, payload: ImportAgentsRequest) -> Result<serde_json::Value, String> {
    // Try to read agents.json from prior project root
    let prev = PathBuf::from(&payload.previous_root).join("src-tauri").join("data").join("agents.json");
    // Also try top-level agents.json
    let alt = PathBuf::from(&payload.previous_root).join("agents.json");
    let path = if prev.exists() { prev } else { alt };
    if !path.exists() {
        return Err(format!("No agents.json found under previous root: {}", payload.previous_root));
    }
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let prior_agents: Vec<crate::models::Agent> = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    let mut agents = state.agents.write();
    for a in prior_agents {
        if !agents.iter().any(|x| x.name == a.name) {
            agents.push(a);
        }
    }
    if let Err(e) = state.storage.save_json("agents.json", &agents.clone()) {
        log::error!("Failed to save agents: {}", e);
    }
    Ok(json!({ "ok": true, "count": agents.len() }))
}