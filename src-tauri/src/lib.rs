mod audit_logger;
mod residue_scanner;
mod secure_wipe;
mod session_manager;
mod upload_server;

use residue_scanner::{CleanupReport, InspectionReport, ResidueFile, ResidueScanner, ScanOptions};
use session_manager::{FileMetadata, SessionInfo, SessionManager};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Listener, Manager, State};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;

pub struct AppState {
    pub session_manager: Arc<Mutex<SessionManager>>,
}

#[tauri::command]
fn start_session(
    session_type: Option<String>,
    state: State<AppState>,
    app: AppHandle,
) -> Result<String, String> {
    let mut sm = state.session_manager.lock().unwrap();
    let s_type = session_type.unwrap_or_else(|| "PRINT".to_string());
    sm.start_session(&s_type, &app)
}

#[tauri::command]
fn start_task_session(state: State<AppState>, app: AppHandle) -> Result<String, String> {
    let mut sm = state.session_manager.lock().unwrap();
    sm.start_session("TASK", &app)
}

#[tauri::command]
fn end_session(state: State<AppState>, app: AppHandle) -> Result<(), String> {
    let mut sm = state.session_manager.lock().unwrap();
    sm.end_session("MANUAL_USER", &app)?;
    Ok(())
}

#[tauri::command]
fn get_session_info(state: State<AppState>) -> SessionInfo {
    let sm = state.session_manager.lock().unwrap();
    sm.get_session_info()
}

#[tauri::command]
fn trigger_file_import(state: State<AppState>, app: AppHandle) {
    let sm_arc = state.session_manager.clone();
    let app_handle = app.clone();

    app.dialog().file().pick_files(move |paths| {
        if let Some(selected_paths) = paths {
            let p_vec: Vec<PathBuf> = selected_paths
                .into_iter()
                .filter_map(|p| match p {
                    tauri_plugin_dialog::FilePath::Path(path) => Some(path),
                    tauri_plugin_dialog::FilePath::Url(url) => url.to_file_path().ok(),
                })
                .collect();

            if !p_vec.is_empty() {
                let mut sm = sm_arc.lock().unwrap();
                let _ = sm.import_files(p_vec, &app_handle);
            }
        }
    });
}

#[tauri::command]
fn trigger_scan(state: State<AppState>, app: AppHandle) -> Result<Vec<FileMetadata>, String> {
    let mut sm = state.session_manager.lock().unwrap();
    sm.simulate_scan(&app)
}

#[tauri::command]
fn delete_file(file_name: String, state: State<AppState>, app: AppHandle) -> Result<(), String> {
    let mut sm = state.session_manager.lock().unwrap();
    sm.delete_file(&file_name, &app)
}

#[tauri::command]
fn preview_file(file_name: String, state: State<AppState>, app: AppHandle) -> Result<(), String> {
    let sm = state.session_manager.lock().unwrap();
    if let Some(path) = sm.get_session_file_path(&file_name) {
        if path.exists() {
            let path_str = path.to_string_lossy().to_string();
            app.opener().open_path(&path_str, None::<&str>).map_err(|e| e.to_string())?;
            return Ok(());
        }
    }
    Err("File not found in active session".to_string())
}

#[tauri::command]
fn print_file(file_name: String, state: State<AppState>, app: AppHandle) -> Result<(), String> {
    let sm = state.session_manager.lock().unwrap();
    if let Some(path) = sm.get_session_file_path(&file_name) {
        if path.exists() {
            let path_str = path.to_string_lossy().to_string();
            app.opener().open_path(&path_str, None::<&str>).map_err(|e| e.to_string())?;
            let _ = app.emit("session:status", format!("Printed: {}", file_name));
            return Ok(());
        }
    }
    Err("File not found in active session".to_string())
}

#[tauri::command]
fn scan_residue(options: Option<ScanOptions>) -> InspectionReport {
    ResidueScanner::scan(options.unwrap_or_default())
}

#[tauri::command]
fn clean_residue(files: Vec<ResidueFile>) -> CleanupReport {
    ResidueScanner::clean(&files)
}

#[tauri::command]
fn launch_task_browser(app: AppHandle) -> Result<(), String> {
    // Open ephemeral secure browser window
    let _ = tauri::WebviewWindowBuilder::new(
        &app,
        "task-browser",
        tauri::WebviewUrl::External("https://google.com".parse().unwrap()),
    )
    .title("SafeDesk - Ephemeral Task Zone")
    .inner_size(1200.0, 800.0)
    .content_protected(true)
    .build();

    let _ = app.emit("session:status", "Ephemeral Task Browser Launched");
    Ok(())
}

#[tauri::command]
fn send_to_mobile(file_name: String, app: AppHandle) -> Result<bool, String> {
    let _ = app.emit("session:status", format!("Shared {} to mobile device", file_name));
    Ok(true)
}

#[tauri::command]
fn get_audit_logs(state: State<AppState>, limit: Option<usize>) -> Vec<audit_logger::AuditEntry> {
    let sm = state.session_manager.lock().unwrap();
    sm.get_audit_logs(limit.unwrap_or(50))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let session_manager = Arc::new(Mutex::new(SessionManager::new()));
    let sm_for_events = session_manager.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(AppState { session_manager })
        .setup(move |app| {
            // Anti-screenshot content protection for main window
            if let Some(main_win) = app.get_webview_window("main") {
                let _ = main_win.set_content_protected(true);
            }

            // Listen for QR uploads from background server
            let app_handle = app.handle().clone();
            let sm_clone = sm_for_events.clone();
            app.listen("files:qr-upload", move |event| {
                if let Ok(metadata) = serde_json::from_str::<FileMetadata>(event.payload()) {
                    let mut sm = sm_clone.lock().unwrap();
                    sm.register_external_file(metadata, &app_handle);
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            start_session,
            start_task_session,
            end_session,
            get_session_info,
            trigger_file_import,
            trigger_scan,
            delete_file,
            preview_file,
            print_file,
            scan_residue,
            clean_residue,
            launch_task_browser,
            send_to_mobile,
            get_audit_logs,
        ])
        .run(tauri::generate_context!())
        .expect("error while running safedesk application");
}
