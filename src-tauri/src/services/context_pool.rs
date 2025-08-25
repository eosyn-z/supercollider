use std::sync::Arc;
use std::collections::HashMap;
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextEntry {
    pub id: String,
    pub project_id: String,
    pub task_id: String,
    pub content_type: ContextType,
    pub content: Value,
    pub metadata: HashMap<String, Value>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub references: Vec<String>, // IDs of other context entries this depends on
    pub ttl_seconds: Option<u64>, // Time to live in cache
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ContextType {
    TaskOutput,
    SharedMemory,
    Artifact,
    Document,
    Code,
    Configuration,
    ValidationResult,
    Error,
}

pub struct ContextPool {
    entries: Arc<RwLock<HashMap<String, ContextEntry>>>,
    project_contexts: Arc<RwLock<HashMap<String, Vec<String>>>>, // Project ID -> Context IDs
    task_contexts: Arc<RwLock<HashMap<String, Vec<String>>>>, // Task ID -> Context IDs
}

impl ContextPool {
    pub fn new() -> Self {
        Self {
            entries: Arc::new(RwLock::new(HashMap::new())),
            project_contexts: Arc::new(RwLock::new(HashMap::new())),
            task_contexts: Arc::new(RwLock::new(HashMap::new())),
        }
    }
    
    pub fn add_context(&self, entry: ContextEntry) -> anyhow::Result<()> {
        let id = entry.id.clone();
        let project_id = entry.project_id.clone();
        let task_id = entry.task_id.clone();
        
        // Add to main entries
        self.entries.write().insert(id.clone(), entry);
        
        // Add to project index
        self.project_contexts
            .write()
            .entry(project_id)
            .or_default()
            .push(id.clone());
        
        // Add to task index
        self.task_contexts
            .write()
            .entry(task_id)
            .or_default()
            .push(id);
        
        Ok(())
    }
    
    pub fn get_context(&self, id: &str) -> Option<ContextEntry> {
        self.entries.read().get(id).cloned()
    }
    
    pub fn get_project_context(&self, project_id: &str) -> Vec<ContextEntry> {
        let project_contexts = self.project_contexts.read();
        let entries = self.entries.read();
        
        project_contexts
            .get(project_id)
            .map(|ids| {
                ids.iter()
                    .filter_map(|id| entries.get(id).cloned())
                    .collect()
            })
            .unwrap_or_default()
    }
    
    pub fn get_task_context(&self, task_id: &str) -> Vec<ContextEntry> {
        let task_contexts = self.task_contexts.read();
        let entries = self.entries.read();
        
        task_contexts
            .get(task_id)
            .map(|ids| {
                ids.iter()
                    .filter_map(|id| entries.get(id).cloned())
                    .collect()
            })
            .unwrap_or_default()
    }
    
    pub fn get_context_chain(&self, task_id: &str, max_depth: usize) -> Vec<ContextEntry> {
        let mut result = Vec::new();
        let mut visited = std::collections::HashSet::new();
        let entries = self.entries.read();
        
        // Start with direct task context
        let task_contexts = self.task_contexts.read();
        if let Some(context_ids) = task_contexts.get(task_id) {
            for id in context_ids {
                self.collect_context_recursive(
                    &entries,
                    id,
                    &mut result,
                    &mut visited,
                    0,
                    max_depth,
                );
            }
        }
        
        result
    }
    
    fn collect_context_recursive(
        &self,
        entries: &HashMap<String, ContextEntry>,
        id: &str,
        result: &mut Vec<ContextEntry>,
        visited: &mut std::collections::HashSet<String>,
        depth: usize,
        max_depth: usize,
    ) {
        if depth >= max_depth || visited.contains(id) {
            return;
        }
        
        visited.insert(id.to_string());
        
        if let Some(entry) = entries.get(id) {
            // Add referenced contexts first (depth-first)
            for ref_id in &entry.references {
                self.collect_context_recursive(
                    entries,
                    ref_id,
                    result,
                    visited,
                    depth + 1,
                    max_depth,
                );
            }
            
            // Then add this entry
            result.push(entry.clone());
        }
    }
    
    pub fn update_context(&self, id: &str, content: Value) -> anyhow::Result<()> {
        let mut entries = self.entries.write();
        if let Some(entry) = entries.get_mut(id) {
            entry.content = content;
            entry.updated_at = Utc::now();
            Ok(())
        } else {
            Err(anyhow::anyhow!("Context entry not found"))
        }
    }
    
    pub fn remove_context(&self, id: &str) -> anyhow::Result<()> {
        let mut entries = self.entries.write();
        if let Some(entry) = entries.remove(id) {
            // Remove from project index
            let mut project_contexts = self.project_contexts.write();
            if let Some(project_ids) = project_contexts.get_mut(&entry.project_id) {
                project_ids.retain(|pid| pid != id);
            }
            
            // Remove from task index
            let mut task_contexts = self.task_contexts.write();
            if let Some(task_ids) = task_contexts.get_mut(&entry.task_id) {
                task_ids.retain(|tid| tid != id);
            }
            
            Ok(())
        } else {
            Err(anyhow::anyhow!("Context entry not found"))
        }
    }
    
    pub fn clear_project_context(&self, project_id: &str) {
        let mut project_contexts = self.project_contexts.write();
        if let Some(context_ids) = project_contexts.remove(project_id) {
            let mut entries = self.entries.write();
            let mut task_contexts = self.task_contexts.write();
            
            for id in context_ids {
                if let Some(entry) = entries.remove(&id) {
                    // Also remove from task index
                    if let Some(task_ids) = task_contexts.get_mut(&entry.task_id) {
                        task_ids.retain(|tid| tid != &id);
                    }
                }
            }
        }
    }
    
    pub fn cleanup_expired(&self) {
        let now = Utc::now();
        let mut entries = self.entries.write();
        let mut expired_ids = Vec::new();
        
        for (id, entry) in entries.iter() {
            if let Some(ttl) = entry.ttl_seconds {
                let age = (now - entry.created_at).num_seconds() as u64;
                if age > ttl {
                    expired_ids.push(id.clone());
                }
            }
        }
        
        drop(entries);
        
        for id in expired_ids {
            let _ = self.remove_context(&id);
        }
    }
    
    pub fn get_statistics(&self) -> ContextPoolStats {
        let entries = self.entries.read();
        let project_contexts = self.project_contexts.read();
        let task_contexts = self.task_contexts.read();
        
        let mut type_counts = HashMap::new();
        let mut total_size = 0usize;
        
        for entry in entries.values() {
            *type_counts.entry(format!("{:?}", entry.content_type)).or_insert(0) += 1;
            total_size += entry.content.to_string().len();
        }
        
        ContextPoolStats {
            total_entries: entries.len(),
            total_projects: project_contexts.len(),
            total_tasks: task_contexts.len(),
            type_distribution: type_counts,
            total_size_bytes: total_size,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct ContextPoolStats {
    pub total_entries: usize,
    pub total_projects: usize,
    pub total_tasks: usize,
    pub type_distribution: HashMap<String, usize>,
    pub total_size_bytes: usize,
}

impl Default for ContextPool {
    fn default() -> Self {
        Self::new()
    }
}