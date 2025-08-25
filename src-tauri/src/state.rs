use parking_lot::RwLock;
use std::collections::HashMap;
use std::sync::Arc;
use crate::models::{Project, Task, Agent, AppConfig};
use crate::storage::StorageService;

pub struct AppState {
    pub projects: RwLock<HashMap<String, Project>>,
    pub tasks: RwLock<HashMap<String, Vec<Task>>>,
    pub agents: RwLock<Vec<Agent>>,
    pub config: RwLock<AppConfig>,
    pub storage: Arc<StorageService>,
}

impl AppState {
    pub fn new() -> anyhow::Result<Self> {
        let storage = Arc::new(StorageService::new()?);
        
        // Load or create default config
        let config = if storage.exists("config.json") {
            storage.load_json::<AppConfig>("config.json")?
        } else {
            let default_config = AppConfig::default();
            storage.save_json("config.json", &default_config)?;
            default_config
        };
        
        // Load agents if they exist
        let agents = if storage.exists("agents.json") {
            storage.load_json::<Vec<Agent>>("agents.json")?
        } else {
            Vec::new()
        };
        
        // Load projects
        let mut projects = HashMap::new();
        if let Ok(project_files) = storage.list_files("project_") {
            for file in project_files {
                if let Ok(project) = storage.load_json::<Project>(&file) {
                    projects.insert(project.id.clone(), project);
                }
            }
        }
        
        Ok(Self {
            projects: RwLock::new(projects),
            tasks: RwLock::new(HashMap::new()),
            agents: RwLock::new(agents),
            config: RwLock::new(config),
            storage,
        })
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new().expect("Failed to initialize AppState")
    }
}
