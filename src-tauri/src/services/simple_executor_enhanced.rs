use std::process::Command;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{RwLock, Semaphore};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use anyhow::{Result, anyhow};
use backoff::{ExponentialBackoff, future::retry};
use tracing::{info, warn, error, debug};
use tiktoken_rs::p50k_base;
use std::time::Duration;
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskExecution {
    pub task_id: String,
    pub preamble: String,
    pub input: Value,
    pub capability: String,
    pub tool: Option<ToolConfig>,
    pub api_key: Option<String>,
    pub model: Option<String>,
    pub max_retries: Option<u32>,
    pub timeout_secs: Option<u64>,
    pub full_context: Option<Value>,
    pub related_outputs: Option<Vec<Value>>,
    pub retry_count: u32,
    pub requires_user_input: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolConfig {
    pub name: String,
    pub command: String,
    pub args_template: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionResult {
    pub success: bool,
    pub output: Option<Value>,
    pub error: Option<String>,
    pub tool_output: Option<String>,
    pub tokens_used: Option<u32>,
    pub execution_time_ms: Option<u64>,
    pub needs_user_input: bool,
    pub retry_strategy: Option<String>,
}

#[derive(Debug, Clone)]
struct RateLimiter {
    semaphore: Arc<Semaphore>,
    requests_per_minute: u32,
    last_reset: Arc<RwLock<DateTime<Utc>>>,
}

impl RateLimiter {
    fn new(requests_per_minute: u32) -> Self {
        Self {
            semaphore: Arc::new(Semaphore::new(requests_per_minute as usize)),
            requests_per_minute,
            last_reset: Arc::new(RwLock::new(Utc::now())),
        }
    }

    async fn acquire(&self) -> Result<()> {
        let now = Utc::now();
        let mut last_reset = self.last_reset.write().await;
        
        if (now - *last_reset).num_seconds() >= 60 {
            *last_reset = now;
            let available = self.semaphore.available_permits();
            if available < self.requests_per_minute as usize {
                self.semaphore.add_permits(self.requests_per_minute as usize - available);
            }
        }
        
        let _permit = self.semaphore.acquire().await
            .map_err(|e| anyhow!("Failed to acquire rate limit permit: {}", e))?;
        Ok(())
    }
}

pub struct SimpleExecutor {
    api_keys: Arc<RwLock<HashMap<String, String>>>,
    http_client: reqwest::Client,
    rate_limiters: Arc<RwLock<HashMap<String, RateLimiter>>>,
    token_counter: Arc<RwLock<HashMap<String, u32>>>,
}

impl SimpleExecutor {
    pub fn new() -> Self {
        let mut rate_limiters = HashMap::new();
        rate_limiters.insert("openai".to_string(), RateLimiter::new(60));
        rate_limiters.insert("anthropic".to_string(), RateLimiter::new(50));
        rate_limiters.insert("ollama".to_string(), RateLimiter::new(100));
        
        Self {
            api_keys: Arc::new(RwLock::new(HashMap::new())),
            http_client: reqwest::Client::builder()
                .timeout(Duration::from_secs(120))
                .pool_max_idle_per_host(10)
                .pool_idle_timeout(Duration::from_secs(90))
                .build()
                .unwrap(),
            rate_limiters: Arc::new(RwLock::new(rate_limiters)),
            token_counter: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn set_api_key(&self, provider: String, key: String) {
        let mut keys = self.api_keys.write().await;
        keys.insert(provider.clone(), key.clone());
        
        if let Err(e) = self.store_key_securely(&provider, &key).await {
            warn!("Failed to store API key securely: {}", e);
        }
    }

    async fn store_key_securely(&self, provider: &str, key: &str) -> Result<()> {
        let entry = keyring::Entry::new("supercollider", provider)?;
        entry.set_password(key)?;
        info!("API key for {} stored securely", provider);
        Ok(())
    }

    async fn get_api_key(&self, provider: &str, task_key: Option<&String>) -> Result<String> {
        if let Some(key) = task_key {
            return Ok(key.clone());
        }

        let keys = self.api_keys.read().await;
        if let Some(key) = keys.get(provider) {
            return Ok(key.clone());
        }

        let entry = keyring::Entry::new("supercollider", provider)?;
        match entry.get_password() {
            Ok(key) => Ok(key),
            Err(_) => Err(anyhow!("No API key configured for {}", provider))
        }
    }

    pub async fn execute_task(&self, mut task: TaskExecution) -> Result<ExecutionResult> {
        let start_time = std::time::Instant::now();
        info!("Executing task {} with capability {} (attempt {})", task.task_id, task.capability, task.retry_count + 1);
        
        // First attempt with sliced context
        let result = self.execute_with_context(&task, false).await;
        
        if let Ok(res) = result {
            if res.success {
                return Ok(res);
            }
        }
        
        // If first attempt failed and we have full context, retry with full context
        if task.full_context.is_some() && task.retry_count == 0 {
            warn!("First attempt failed for task {}, retrying with full context", task.task_id);
            task.retry_count += 1;
            
            let result = self.execute_with_context(&task, true).await;
            
            if let Ok(res) = result {
                if res.success {
                    return Ok(res);
                }
            }
        }
        
        // After two failures, require user input
        if task.retry_count >= 1 {
            error!("Task {} failed after retries, requiring user input", task.task_id);
            return Ok(ExecutionResult {
                success: false,
                output: None,
                error: Some("Task failed after multiple attempts. User input required for clarification.".to_string()),
                tool_output: None,
                tokens_used: None,
                execution_time_ms: Some(start_time.elapsed().as_millis() as u64),
                needs_user_input: true,
                retry_strategy: Some("exhausted".to_string()),
            });
        }
        
        // Standard retry with exponential backoff
        let max_retries = task.max_retries.unwrap_or(3);
        let timeout_secs = task.timeout_secs.unwrap_or(120);
        
        let backoff = ExponentialBackoff {
            max_elapsed_time: Some(Duration::from_secs(timeout_secs)),
            ..Default::default()
        };
        
        let result = retry(backoff, || async {
            self.execute_with_context(&task, false).await
                .map_err(|e| {
                    warn!("API call failed, retrying: {}", e);
                    backoff::Error::Transient {
                        err: e,
                        retry_after: None,
                    }
                })
        }).await.map_err(|e| anyhow!("All retries exhausted: {}", e))?;
        
        let mut final_result = if let Some(tool) = &task.tool {
            self.apply_tool(tool, &result).await?
        } else {
            result
        };
        
        final_result.execution_time_ms = Some(start_time.elapsed().as_millis() as u64);
        
        let tokens = self.count_tokens(&task.preamble, &task.input.to_string()).await?;
        final_result.tokens_used = Some(tokens);
        
        let mut counter = self.token_counter.write().await;
        *counter.entry(task.task_id.clone()).or_insert(0) += tokens;
        
        info!("Task {} completed successfully in {}ms", task.task_id, final_result.execution_time_ms.unwrap());
        Ok(final_result)
    }
    
    async fn execute_with_context(&self, task: &TaskExecution, use_full_context: bool) -> Result<ExecutionResult> {
        let enhanced_task = if use_full_context && task.full_context.is_some() {
            let mut enhanced = task.clone();
            
            // Build enhanced input with full context and related outputs
            let mut enhanced_input = json!({
                "original_input": task.input,
                "full_context": task.full_context,
                "retry_attempt": task.retry_count + 1,
            });
            
            if let Some(related) = &task.related_outputs {
                enhanced_input["related_agent_outputs"] = json!(related);
            }
            
            enhanced.input = enhanced_input;
            enhanced.preamble = format!(
                "{}

Note: This is retry attempt {} with full context. Previous attempt with sliced context failed. Please carefully consider all provided context and related agent outputs.",
                task.preamble,
                task.retry_count + 1
            );
            
            enhanced
        } else {
            task.clone()
        };
        
        match enhanced_task.capability.as_str() {
            "text" | "code" => self.call_text_api(&enhanced_task).await,
            "image" => self.call_image_api(&enhanced_task).await,
            "sound" => self.call_audio_api(&enhanced_task).await,
            "video" => self.call_video_api(&enhanced_task).await,
            _ => Err(anyhow!("Unknown capability: {}", enhanced_task.capability)),
        }
    }

    async fn count_tokens(&self, preamble: &str, input: &str) -> Result<u32> {
        let bpe = p50k_base()?;
        let combined = format!("{}\n{}", preamble, input);
        let tokens = bpe.encode_with_special_tokens(&combined);
        Ok(tokens.len() as u32)
    }

    async fn call_text_api(&self, task: &TaskExecution) -> Result<ExecutionResult> {
        let model = task.model.as_deref().unwrap_or("gpt-4");
        
        if model.starts_with("gpt") || model.starts_with("o1") {
            self.call_openai(task, model).await
        } else if model.starts_with("claude") {
            self.call_anthropic(task, model).await
        } else if model.starts_with("llama") || model.starts_with("mistral") {
            self.call_ollama(task, model).await
        } else {
            self.call_openai(task, model).await
        }
    }

    async fn call_openai(&self, task: &TaskExecution, model: &str) -> Result<ExecutionResult> {
        let limiters = self.rate_limiters.read().await;
        if let Some(limiter) = limiters.get("openai") {
            limiter.acquire().await?;
        }
        
        let api_key = self.get_api_key("openai", task.api_key.as_ref()).await?;
        
        debug!("Calling OpenAI API with model {}", model);
        
        let request_body = json!({
            "model": model,
            "messages": [
                {"role": "system", "content": task.preamble},
                {"role": "user", "content": task.input.to_string()}
            ],
            "temperature": 0.7,
            "max_tokens": 4000,
            "stream": false
        });
        
        let response = self.http_client
            .post("https://api.openai.com/v1/chat/completions")
            .header("Authorization", format!("Bearer {}", api_key))
            .header("Content-Type", "application/json")
            .json(&request_body)
            .send()
            .await?;
        
        if !response.status().is_success() {
            let error_text = response.text().await?;
            error!("OpenAI API error: {}", error_text);
            return Err(anyhow!("OpenAI API error: {}", error_text));
        }
        
        let response_json: Value = response.json().await?;
        let content = response_json["choices"][0]["message"]["content"]
            .as_str()
            .unwrap_or("")
            .to_string();
        
        let usage = response_json["usage"]["total_tokens"].as_u64().unwrap_or(0) as u32;
        
        Ok(ExecutionResult {
            success: true,
            output: Some(json!({
                "type": "text",
                "content": content,
                "model": model,
                "provider": "openai"
            })),
            error: None,
            tool_output: None,
            tokens_used: Some(usage),
            execution_time_ms: None,
            needs_user_input: false,
            retry_strategy: None,
        })
    }

    async fn call_anthropic(&self, task: &TaskExecution, model: &str) -> Result<ExecutionResult> {
        let limiters = self.rate_limiters.read().await;
        if let Some(limiter) = limiters.get("anthropic") {
            limiter.acquire().await?;
        }
        
        let api_key = self.get_api_key("anthropic", task.api_key.as_ref()).await?;
        
        debug!("Calling Anthropic API with model {}", model);
        
        let request_body = json!({
            "model": model,
            "max_tokens": 4000,
            "messages": [
                {"role": "user", "content": format!("{}\n\n{}", task.preamble, task.input)}
            ]
        });
        
        let response = self.http_client
            .post("https://api.anthropic.com/v1/messages")
            .header("x-api-key", api_key)
            .header("anthropic-version", "2023-06-01")
            .header("Content-Type", "application/json")
            .json(&request_body)
            .send()
            .await?;
        
        if !response.status().is_success() {
            let error_text = response.text().await?;
            error!("Anthropic API error: {}", error_text);
            return Err(anyhow!("Anthropic API error: {}", error_text));
        }
        
        let response_json: Value = response.json().await?;
        let content = response_json["content"][0]["text"]
            .as_str()
            .unwrap_or("")
            .to_string();
        
        let usage = response_json["usage"]["total_tokens"].as_u64().unwrap_or(0) as u32;
        
        Ok(ExecutionResult {
            success: true,
            output: Some(json!({
                "type": "text",
                "content": content,
                "model": model,
                "provider": "anthropic"
            })),
            error: None,
            tool_output: None,
            tokens_used: Some(usage),
            execution_time_ms: None,
            needs_user_input: false,
            retry_strategy: None,
        })
    }

    async fn call_ollama(&self, task: &TaskExecution, model: &str) -> Result<ExecutionResult> {
        let limiters = self.rate_limiters.read().await;
        if let Some(limiter) = limiters.get("ollama") {
            limiter.acquire().await?;
        }
        
        debug!("Calling Ollama API with model {}", model);
        
        let request_body = json!({
            "model": model,
            "prompt": format!("{}\n\n{}", task.preamble, task.input),
            "stream": false,
            "options": {
                "temperature": 0.7,
                "num_predict": 4000
            }
        });
        
        let response = self.http_client
            .post("http://localhost:11434/api/generate")
            .json(&request_body)
            .send()
            .await?;
        
        if !response.status().is_success() {
            error!("Ollama not running or model not available");
            return Err(anyhow!("Ollama not running or model not available"));
        }
        
        let response_json: Value = response.json().await?;
        let content = response_json["response"]
            .as_str()
            .unwrap_or("")
            .to_string();
        
        let tokens = self.count_tokens(&task.preamble, &content).await?;
        
        Ok(ExecutionResult {
            success: true,
            output: Some(json!({
                "type": "text",
                "content": content,
                "model": model,
                "provider": "ollama"
            })),
            error: None,
            tool_output: None,
            tokens_used: Some(tokens),
            execution_time_ms: None,
            needs_user_input: false,
            retry_strategy: None,
        })
    }

    async fn call_image_api(&self, task: &TaskExecution) -> Result<ExecutionResult> {
        let limiters = self.rate_limiters.read().await;
        if let Some(limiter) = limiters.get("openai") {
            limiter.acquire().await?;
        }
        
        let api_key = self.get_api_key("openai", task.api_key.as_ref()).await?;
        
        debug!("Calling DALL-E 3 for image generation");
        
        let request_body = json!({
            "model": "dall-e-3",
            "prompt": format!("{}\n{}", task.preamble, task.input),
            "n": 1,
            "size": "1024x1024",
            "quality": "standard"
        });
        
        let response = self.http_client
            .post("https://api.openai.com/v1/images/generations")
            .header("Authorization", format!("Bearer {}", api_key))
            .header("Content-Type", "application/json")
            .json(&request_body)
            .send()
            .await?;
        
        if !response.status().is_success() {
            let error_text = response.text().await?;
            error!("Image API error: {}", error_text);
            return Err(anyhow!("Image API error: {}", error_text));
        }
        
        let response_json: Value = response.json().await?;
        let image_url = response_json["data"][0]["url"]
            .as_str()
            .unwrap_or("")
            .to_string();
        
        Ok(ExecutionResult {
            success: true,
            output: Some(json!({
                "type": "image",
                "url": image_url,
                "provider": "dall-e-3"
            })),
            error: None,
            tool_output: None,
            tokens_used: Some(100),
            execution_time_ms: None,
            needs_user_input: false,
            retry_strategy: None,
        })
    }

    async fn call_audio_api(&self, task: &TaskExecution) -> Result<ExecutionResult> {
        let limiters = self.rate_limiters.read().await;
        if let Some(limiter) = limiters.get("openai") {
            limiter.acquire().await?;
        }
        
        let api_key = self.get_api_key("openai", task.api_key.as_ref()).await?;
        
        debug!("Calling OpenAI TTS for audio generation");
        
        let request_body = json!({
            "model": "tts-1",
            "input": format!("{}\n{}", task.preamble, task.input),
            "voice": "alloy"
        });
        
        let response = self.http_client
            .post("https://api.openai.com/v1/audio/speech")
            .header("Authorization", format!("Bearer {}", api_key))
            .header("Content-Type", "application/json")
            .json(&request_body)
            .send()
            .await?;
        
        if !response.status().is_success() {
            error!("Audio generation failed");
            return Err(anyhow!("Audio generation failed"));
        }
        
        let audio_bytes = response.bytes().await?;
        let temp_path = std::env::temp_dir().join(format!("{}.mp3", task.task_id));
        std::fs::write(&temp_path, audio_bytes)?;
        
        Ok(ExecutionResult {
            success: true,
            output: Some(json!({
                "type": "audio",
                "path": temp_path.to_string_lossy(),
                "provider": "openai-tts"
            })),
            error: None,
            tool_output: None,
            tokens_used: Some(50),
            execution_time_ms: None,
            needs_user_input: false,
            retry_strategy: None,
        })
    }

    async fn call_video_api(&self, _task: &TaskExecution) -> Result<ExecutionResult> {
        Err(anyhow!("Video generation not yet implemented"))
    }

    async fn apply_tool(&self, tool: &ToolConfig, result: &ExecutionResult) -> Result<ExecutionResult> {
        if !result.success || result.output.is_none() {
            return Ok(result.clone());
        }
        
        let output = result.output.as_ref().unwrap();
        
        let content = match output["type"].as_str() {
            Some("text") => output["content"].as_str().unwrap_or(""),
            Some("image") => output["url"].as_str().unwrap_or(""),
            Some("audio") => output["path"].as_str().unwrap_or(""),
            _ => return Ok(result.clone()),
        };
        
        debug!("Applying tool {} to output", tool.name);
        
        let mut cmd = Command::new(&tool.command);
        
        for arg in &tool.args_template {
            let processed_arg = arg
                .replace("{INPUT}", content)
                .replace("{OUTPUT}", &format!("output_{}", chrono::Utc::now().timestamp()));
            cmd.arg(processed_arg);
        }
        
        if output["type"] == "text" {
            use std::io::Write;
            use std::process::Stdio;
            
            cmd.stdin(Stdio::piped());
            cmd.stdout(Stdio::piped());
            cmd.stderr(Stdio::piped());
            
            let mut child = cmd.spawn()?;
            
            if let Some(mut stdin) = child.stdin.take() {
                stdin.write_all(content.as_bytes())?;
            }
            
            let output = child.wait_with_output()?;
            
            if output.status.success() {
                let tool_output = String::from_utf8_lossy(&output.stdout).to_string();
                
                Ok(ExecutionResult {
                    success: true,
                    output: Some(json!({
                        "type": "processed",
                        "original": result.output.clone(),
                        "processed": tool_output,
                        "tool": tool.name.clone()
                    })),
                    error: None,
                    tool_output: Some(tool_output),
                    tokens_used: result.tokens_used,
                    execution_time_ms: result.execution_time_ms,
                    needs_user_input: false,
                    retry_strategy: None,
                })
            } else {
                let error = String::from_utf8_lossy(&output.stderr).to_string();
                error!("Tool {} failed: {}", tool.name, error);
                Err(anyhow!("Tool {} failed: {}", tool.name, error))
            }
        } else {
            let output = cmd.output()?;
            
            if output.status.success() {
                let tool_output = String::from_utf8_lossy(&output.stdout).to_string();
                
                Ok(ExecutionResult {
                    success: true,
                    output: Some(json!({
                        "type": "processed",
                        "original": result.output.clone(),
                        "processed": tool_output,
                        "tool": tool.name.clone()
                    })),
                    error: None,
                    tool_output: Some(tool_output),
                    tokens_used: result.tokens_used,
                    execution_time_ms: result.execution_time_ms,
                    needs_user_input: false,
                    retry_strategy: None,
                })
            } else {
                Ok(result.clone())
            }
        }
    }

    pub async fn get_token_usage(&self, task_id: &str) -> Option<u32> {
        let counter = self.token_counter.read().await;
        counter.get(task_id).copied()
    }

    pub async fn reset_token_counter(&self) {
        let mut counter = self.token_counter.write().await;
        counter.clear();
        info!("Token counter reset");
    }
}

impl Default for SimpleExecutor {
    fn default() -> Self {
        Self::new()
    }
}