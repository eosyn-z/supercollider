use std::sync::Arc;
use std::collections::HashMap;
use parking_lot::RwLock;
use tokio::sync::mpsc;
use tokio::time::{timeout, Duration};
use chrono::Utc;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::json;
use crate::models::{Agent, AgentHealth, HealthStatus, Capability, Task};
use crate::state::AppState;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentRequest {
    pub task_id: String,
    pub task_type: String,
    pub capability: Capability,
    pub input: serde_json::Value,
    pub preamble: String,
    pub token_limit: u32,
    pub context: Vec<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentResponse {
    pub task_id: String,
    pub success: bool,
    pub output: Option<serde_json::Value>,
    pub error: Option<String>,
    pub tokens_used: Option<u32>,
    pub execution_time_ms: u64,
}

pub struct AgentPool {
    state: Arc<AppState>,
    http_client: Client,
    agent_connections: Arc<RwLock<HashMap<String, AgentConnection>>>,
}

struct AgentConnection {
    agent: Agent,
    tx: mpsc::Sender<AgentRequest>,
    rx: Arc<RwLock<mpsc::Receiver<AgentResponse>>>,
    active_tasks: Arc<RwLock<Vec<String>>>,
}

impl AgentPool {
    pub fn new(state: Arc<AppState>) -> Self {
        Self {
            state,
            http_client: Client::builder()
                .timeout(Duration::from_secs(120))
                .build()
                .unwrap(),
            agent_connections: Arc::new(RwLock::new(HashMap::new())),
        }
    }
    
    pub async fn initialize(&self) -> anyhow::Result<()> {
        let agents = self.state.agents.read().clone();
        
        for agent in agents {
            if agent.enabled {
                self.connect_agent(agent).await?;
            }
        }
        
        // Start health check loop
        let pool = self.clone();
        tokio::spawn(async move {
            pool.health_check_loop().await;
        });
        
        Ok(())
    }
    
    async fn connect_agent(&self, agent: Agent) -> anyhow::Result<()> {
        let (tx, rx) = mpsc::channel(100);
        
        let connection = AgentConnection {
            agent: agent.clone(),
            tx,
            rx: Arc::new(RwLock::new(rx)),
            active_tasks: Arc::new(RwLock::new(Vec::new())),
        };
        
        self.agent_connections.write().insert(agent.name.clone(), connection);
        
        // Test connection
        self.test_agent_connection(&agent.name).await?;
        
        Ok(())
    }
    
    pub async fn execute_task(&self, agent_name: &str, task: &Task) -> anyhow::Result<AgentResponse> {
        let connections = self.agent_connections.read();
        let connection = connections
            .get(agent_name)
            .ok_or_else(|| anyhow::anyhow!("Agent {} not found", agent_name))?;
        
        // Build context from input chain
        let context = self.build_task_context(&task).await;
        
        let request = AgentRequest {
            task_id: task.id.clone(),
            task_type: task.task_type.clone(),
            capability: task.capability.clone(),
            input: task.input.clone(),
            preamble: task.preamble.clone(),
            token_limit: task.token_limit,
            context,
        };
        
        // Add to active tasks
        connection.active_tasks.write().push(task.id.clone());
        
        let start_time = std::time::Instant::now();
        
        // Execute based on agent type
        let response = if connection.agent.local {
            self.execute_local_task(&connection.agent, request).await
        } else {
            self.execute_remote_task(&connection.agent, request).await
        };
        
        // Remove from active tasks
        connection.active_tasks.write().retain(|id| id != &task.id);
        
        // Update agent health metrics
        self.update_agent_health(&agent_name, &response, start_time.elapsed().as_millis() as u32).await;
        
        response
    }
    
    async fn execute_local_task(&self, agent: &Agent, request: AgentRequest) -> anyhow::Result<AgentResponse> {
        // For local agents, we simulate execution
        // In a real implementation, this would call local AI models
        
        tokio::time::sleep(Duration::from_millis(500)).await;
        
        let output = match request.capability {
            Capability::Text => {
                json!({
                    "text": format!("Generated text response for task {}", request.task_id),
                    "confidence": 0.95,
                })
            }
            Capability::Code => {
                json!({
                    "code": "// Generated code\nfunction example() {\n  return 'Hello World';\n}",
                    "language": "javascript",
                    "confidence": 0.92,
                })
            }
            Capability::Image => {
                json!({
                    "image_url": "generated_image.png",
                    "format": "png",
                    "dimensions": {"width": 1024, "height": 768},
                })
            }
            _ => json!({"result": "Simulated output"}),
        };
        
        Ok(AgentResponse {
            task_id: request.task_id,
            success: true,
            output: Some(output),
            error: None,
            tokens_used: Some((request.token_limit as f32 * 0.7) as u32),
            execution_time_ms: 500,
        })
    }
    
    async fn execute_remote_task(&self, agent: &Agent, request: AgentRequest) -> anyhow::Result<AgentResponse> {
        let endpoint = agent.endpoint_url.as_ref()
            .ok_or_else(|| anyhow::anyhow!("No endpoint URL for remote agent"))?;
        
        let mut headers = reqwest::header::HeaderMap::new();
        
        // Add authentication headers
        if let Some(auth) = &agent.auth {
            if let Some(api_key) = &auth.api_key {
                headers.insert("X-API-Key", api_key.parse()?);
            }
            if let Some(bearer) = &auth.bearer_token {
                headers.insert("Authorization", format!("Bearer {}", bearer).parse()?);
            }
            for (key, value) in &auth.custom_headers {
                headers.insert(key.as_str(), value.parse()?);
            }
        }
        
        let start_time = std::time::Instant::now();
        
        let response = timeout(
            Duration::from_secs(60),
            self.http_client
                .post(endpoint)
                .headers(headers)
                .json(&request)
                .send()
        ).await??;
        
        if !response.status().is_success() {
            let error = format!("Remote agent returned status {}: {}", 
                response.status(), 
                response.text().await.unwrap_or_default());
            return Ok(AgentResponse {
                task_id: request.task_id,
                success: false,
                output: None,
                error: Some(error),
                tokens_used: None,
                execution_time_ms: start_time.elapsed().as_millis() as u64,
            });
        }
        
        let mut agent_response: AgentResponse = response.json().await?;
        agent_response.execution_time_ms = start_time.elapsed().as_millis() as u64;
        
        Ok(agent_response)
    }
    
    async fn build_task_context(&self, task: &Task) -> Vec<serde_json::Value> {
        let mut context = Vec::new();
        
        if task.input_chain.is_empty() {
            return context;
        }
        
        let tasks = self.state.tasks.read();
        if let Some(project_tasks) = tasks.get(&task.project_id) {
            for chain_task_id in &task.input_chain {
                if let Some(chain_task) = project_tasks.iter().find(|t| &t.id == chain_task_id) {
                    if let Some(output) = &chain_task.output {
                        context.push(json!({
                            "task_id": chain_task.id,
                            "task_type": chain_task.task_type,
                            "output": output,
                        }));
                    }
                }
            }
        }
        
        context
    }
    
    async fn test_agent_connection(&self, agent_name: &str) -> anyhow::Result<()> {
        let agents = self.state.agents.read();
        let agent = agents.iter()
            .find(|a| a.name == agent_name)
            .ok_or_else(|| anyhow::anyhow!("Agent not found"))?;
        
        if agent.local {
            // Local agents are always available
            return Ok(());
        }
        
        // Test remote agent
        if let Some(endpoint) = &agent.endpoint_url {
            let health_endpoint = format!("{}/health", endpoint.trim_end_matches('/'));
            
            let response = timeout(
                Duration::from_secs(5),
                self.http_client.get(&health_endpoint).send()
            ).await;
            
            match response {
                Ok(Ok(resp)) if resp.status().is_success() => Ok(()),
                _ => Err(anyhow::anyhow!("Failed to connect to agent")),
            }
        } else {
            Ok(())
        }
    }
    
    async fn update_agent_health(&self, agent_name: &str, response: &anyhow::Result<AgentResponse>, latency_ms: u32) {
        let mut agents = self.state.agents.write();
        if let Some(agent) = agents.iter_mut().find(|a| a.name == agent_name) {
            let is_success = response.as_ref().map_or(false, |r| r.success);
            
            if is_success {
                agent.health.success_count += 1;
            } else {
                agent.health.failure_count += 1;
            }
            
            agent.health.error_rate = agent.health.failure_count as f32 / 
                (agent.health.success_count + agent.health.failure_count) as f32;
            
            agent.health.latency_ms = Some(latency_ms);
            agent.health.last_check = Utc::now();
            
            // Update health status
            agent.health.status = if agent.health.error_rate > 0.5 {
                HealthStatus::Unhealthy
            } else if agent.health.error_rate > 0.1 {
                HealthStatus::Degraded
            } else {
                HealthStatus::Healthy
            };
        }
    }
    
    async fn health_check_loop(&self) {
        let mut interval = tokio::time::interval(Duration::from_secs(30));
        
        loop {
            interval.tick().await;
            
            let agent_names: Vec<String> = {
                self.agent_connections.read()
                    .keys()
                    .cloned()
                    .collect()
            };
            
            for agent_name in agent_names {
                if let Err(e) = self.test_agent_connection(&agent_name).await {
                    eprintln!("Health check failed for agent {}: {}", agent_name, e);
                    
                    // Update health status
                    let mut agents = self.state.agents.write();
                    if let Some(agent) = agents.iter_mut().find(|a| a.name == agent_name) {
                        agent.health.status = HealthStatus::Unhealthy;
                        agent.health.last_check = Utc::now();
                    }
                }
            }
        }
    }
    
    pub fn get_agent_load(&self, agent_name: &str) -> usize {
        self.agent_connections
            .read()
            .get(agent_name)
            .map(|conn| conn.active_tasks.read().len())
            .unwrap_or(0)
    }
    
    pub fn get_available_agents(&self, capability: &Capability) -> Vec<String> {
        let agents = self.state.agents.read();
        let connections = self.agent_connections.read();
        
        agents.iter()
            .filter(|a| {
                a.enabled && 
                a.capabilities.contains(capability) &&
                a.health.status != HealthStatus::Unhealthy &&
                connections.contains_key(&a.name)
            })
            .map(|a| a.name.clone())
            .collect()
    }
}

impl Clone for AgentPool {
    fn clone(&self) -> Self {
        Self {
            state: Arc::clone(&self.state),
            http_client: self.http_client.clone(),
            agent_connections: Arc::clone(&self.agent_connections),
        }
    }
}