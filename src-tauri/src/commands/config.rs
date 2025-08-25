use serde_json::json;
use tauri::State;
use crate::state::AppState;
use crate::models::AppConfig;

#[tauri::command]
pub fn config_update(
    state: State<AppState>,
    partial_config: serde_json::Value,
) -> Result<serde_json::Value, String> {
    // Load current config
    let mut cfg = state.config.write();
    // Merge shallowly for known fields
    if let Some(theme) = partial_config.get("theme").and_then(|v| v.as_str()) { cfg.theme = theme.to_string(); }
    if let Some(auto) = partial_config.get("auto_start_queue").and_then(|v| v.as_bool()) { cfg.auto_start_queue = auto; }
    if let Some(notif) = partial_config.get("notifications_enabled").and_then(|v| v.as_bool()) { cfg.notifications_enabled = notif; }
    if let Some(budget) = partial_config.get("daily_token_budget").and_then(|v| v.as_u64()) { cfg.daily_token_budget = Some(budget as u32); }
    if let Some(storage_path) = partial_config.get("storage_path").and_then(|v| v.as_str()) { cfg.storage_path = storage_path.to_string(); }
    if let Some(backup_enabled) = partial_config.get("backup_enabled").and_then(|v| v.as_bool()) { cfg.backup_enabled = backup_enabled; }
    if let Some(backup_interval_hours) = partial_config.get("backup_interval_hours").and_then(|v| v.as_u64()) { cfg.backup_interval_hours = backup_interval_hours as u32; }
    if let Some(ignore_limits) = partial_config.get("ignore_task_token_limits").and_then(|v| v.as_bool()) { cfg.ignore_task_token_limits = ignore_limits; }
    // Persist
    if let Err(e) = state.storage.save_json("config.json", &*cfg) {
        log::error!("Failed to save config: {}", e);
        return Err(format!("Failed to save config: {}", e));
    }
    Ok(json!({"ok": true, "config": &*cfg}))
}