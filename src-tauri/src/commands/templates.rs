use serde_json::json;
use tauri::State;
use crate::state::AppState;

#[tauri::command]
pub fn templates_list() -> Result<serde_json::Value, String> {
    Ok(json!({"ok": true, "templates": []}))
}

#[tauri::command]
pub fn templates_get(name: String) -> Result<serde_json::Value, String> {
    Ok(json!({"ok": true, "template": null}))
}

#[tauri::command]
pub fn templates_save(template: serde_json::Value) -> Result<serde_json::Value, String> {
    Ok(json!({"ok": true}))
}

#[tauri::command]
pub fn templates_delete(name: String) -> Result<serde_json::Value, String> {
    Ok(json!({"ok": true}))
}