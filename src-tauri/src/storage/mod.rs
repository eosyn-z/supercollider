use std::path::{Path, PathBuf};
use std::fs;
use std::io::Write;
use anyhow::Result;
use serde::{Deserialize, Serialize};

pub struct StorageService {
    base_path: PathBuf,
}

impl StorageService {
    pub fn new() -> Result<Self> {
        let base_path = if cfg!(target_os = "windows") {
            dirs::data_dir()
                .ok_or_else(|| anyhow::anyhow!("Could not find AppData directory"))?
                .join("SuperCollider")
        } else if cfg!(target_os = "macos") {
            dirs::data_dir()
                .ok_or_else(|| anyhow::anyhow!("Could not find Application Support directory"))?
                .join("SuperCollider")
        } else {
            dirs::config_dir()
                .ok_or_else(|| anyhow::anyhow!("Could not find config directory"))?
                .join("supercollider")
        };

        fs::create_dir_all(&base_path)?;
        fs::create_dir_all(base_path.join("projects"))?;
        fs::create_dir_all(base_path.join("backups"))?;

        Ok(Self { base_path })
    }

    pub fn save_json<T: Serialize>(&self, filename: &str, data: &T) -> Result<()> {
        let path = self.base_path.join(filename);
        let temp_path = path.with_extension("tmp");
        
        let json = serde_json::to_string_pretty(data)?;
        let mut file = fs::File::create(&temp_path)?;
        file.write_all(json.as_bytes())?;
        file.sync_all()?;
        drop(file);
        
        fs::rename(temp_path, path)?;
        Ok(())
    }

    pub fn load_json<T: for<'de> Deserialize<'de>>(&self, filename: &str) -> Result<T> {
        let path = self.base_path.join(filename);
        let contents = fs::read_to_string(path)?;
        let data = serde_json::from_str(&contents)?;
        Ok(data)
    }

    pub fn exists(&self, filename: &str) -> bool {
        self.base_path.join(filename).exists()
    }

    pub fn delete(&self, filename: &str) -> Result<()> {
        let path = self.base_path.join(filename);
        if path.exists() {
            fs::remove_file(path)?;
        }
        Ok(())
    }

    pub fn list_files(&self, pattern: &str) -> Result<Vec<String>> {
        let entries = fs::read_dir(&self.base_path)?;
        let mut files = Vec::new();
        
        for entry in entries {
            let entry = entry?;
            let path = entry.path();
            if let Some(name) = path.file_name() {
                let name_str = name.to_string_lossy();
                if name_str.contains(pattern) {
                    files.push(name_str.to_string());
                }
            }
        }
        
        Ok(files)
    }

    pub fn save_project_data(&self, project_id: &str, filename: &str, data: &serde_json::Value) -> Result<()> {
        let project_dir = self.base_path.join("projects").join(project_id);
        fs::create_dir_all(&project_dir)?;
        
        let path = project_dir.join(filename);
        let temp_path = path.with_extension("tmp");
        
        let json = serde_json::to_string_pretty(data)?;
        let mut file = fs::File::create(&temp_path)?;
        file.write_all(json.as_bytes())?;
        file.sync_all()?;
        drop(file);
        
        fs::rename(temp_path, path)?;
        Ok(())
    }

    pub fn load_project_data(&self, project_id: &str, filename: &str) -> Result<serde_json::Value> {
        let path = self.base_path.join("projects").join(project_id).join(filename);
        let contents = fs::read_to_string(path)?;
        let data = serde_json::from_str(&contents)?;
        Ok(data)
    }

    pub fn append_to_jsonl(&self, project_id: &str, filename: &str, data: &serde_json::Value) -> Result<()> {
        let project_dir = self.base_path.join("projects").join(project_id);
        fs::create_dir_all(&project_dir)?;
        
        let path = project_dir.join(filename);
        let json_line = serde_json::to_string(data)?;
        
        use std::fs::OpenOptions;
        let mut file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(path)?;
        
        writeln!(file, "{}", json_line)?;
        file.sync_all()?;
        
        Ok(())
    }

    pub fn backup(&self) -> Result<String> {
        let timestamp = chrono::Utc::now().format("%Y%m%d_%H%M%S");
        let backup_name = format!("backup_{}.tar.gz", timestamp);
        let backup_path = self.base_path.join("backups").join(&backup_name);
        
        // TODO: Implement actual backup compression
        // For now, just create a marker file
        fs::File::create(&backup_path)?;
        
        Ok(backup_name)
    }

    pub fn restore(&self, backup_name: &str) -> Result<()> {
        let backup_path = self.base_path.join("backups").join(backup_name);
        
        if !backup_path.exists() {
            return Err(anyhow::anyhow!("Backup file not found"));
        }
        
        // TODO: Implement actual restore from backup
        
        Ok(())
    }

    pub fn get_base_path(&self) -> &Path {
        &self.base_path
    }
}