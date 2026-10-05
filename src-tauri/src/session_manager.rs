use rand::RngCore;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter};

use crate::audit_logger::AuditLogger;
use crate::secure_wipe::{secure_delete_file, secure_wipe_session};
use crate::upload_server::UploadServer;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct FileMetadata {
    pub name: String,
    pub size: u64,
    #[serde(rename = "originalPath")]
    pub original_path: Option<String>,
    pub source: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SessionInfo {
    pub id: Option<String>,
    #[serde(rename = "startTime")]
    pub start_time: Option<u64>,
    #[serde(rename = "totalSize")]
    pub total_size: u64,
    #[serde(rename = "fileCount")]
    pub file_count: usize,
    #[serde(rename = "uploadUrl")]
    pub upload_url: Option<String>,
    #[serde(rename = "type")]
    pub session_type: String,
    pub state: String,
    pub mode: String,
}

pub struct SessionManager {
    base_dir: PathBuf,
    active_session_id: Option<String>,
    session_path: Option<PathBuf>,
    imported_files: Vec<FileMetadata>,
    start_time: Option<u64>,
    upload_url: Option<String>,
    session_type: String,
    state: String,
    mode: String,
    audit_logger: AuditLogger,
    upload_server: UploadServer,
}

impl SessionManager {
    pub fn new() -> Self {
        let base_dir = PathBuf::from(r"C:\SafeDesk\sessions");
        let safe_base = if fs::create_dir_all(&base_dir).is_ok() {
            base_dir
        } else {
            let app_data = dirs::data_local_dir().unwrap_or_else(|| PathBuf::from("."));
            let fallback = app_data.join("SafeDesk").join("sessions");
            let _ = fs::create_dir_all(&fallback);
            fallback
        };

        Self {
            base_dir: safe_base,
            active_session_id: None,
            session_path: None,
            imported_files: Vec::new(),
            start_time: None,
            upload_url: None,
            session_type: "PRINT".to_string(),
            state: "IDLE".to_string(),
            mode: "CUSTOMER".to_string(),
            audit_logger: AuditLogger::new(),
            upload_server: UploadServer::new(),
        }
    }

    pub fn get_session_info(&self) -> SessionInfo {
        let total_size = self.imported_files.iter().map(|f| f.size).sum();
        SessionInfo {
            id: self.active_session_id.clone(),
            start_time: self.start_time,
            total_size,
            file_count: self.imported_files.len(),
            upload_url: self.upload_url.clone(),
            session_type: self.session_type.clone(),
            state: self.state.clone(),
            mode: self.mode.clone(),
        }
    }

    pub fn get_files(&self) -> Vec<FileMetadata> {
        self.imported_files.clone()
    }

    pub fn start_session(&mut self, session_type: &str, app: &AppHandle) -> Result<String, String> {
        if self.state == "ACTIVE_SESSION" {
            let _ = self.end_session("NEW_SESSION_OVERRIDE", app);
        }

        let timestamp = chrono::Utc::now().timestamp_millis();
        let mut rand_bytes = [0u8; 4];
        rand::thread_rng().fill_bytes(&mut rand_bytes);
        let rand_hex: String = rand_bytes.iter().map(|b| format!("{:02x}", b)).collect();
        let session_id = format!("session_{}_{}", timestamp, rand_hex);

        let session_path = self.base_dir.join(&session_id);
        fs::create_dir_all(&session_path).map_err(|e| format!("Failed to create session dir: {}", e))?;

        self.active_session_id = Some(session_id.clone());
        self.session_path = Some(session_path.clone());
        self.imported_files.clear();
        self.start_time = Some(timestamp as u64);
        self.session_type = session_type.to_string();
        self.state = "ACTIVE_SESSION".to_string();

        let mut token_bytes = [0u8; 8];
        rand::thread_rng().fill_bytes(&mut token_bytes);
        let token: String = token_bytes.iter().map(|b| format!("{:02x}", b)).collect();

        // Start upload server
        let app_handle_clone = app.clone();
        match self.upload_server.start(session_path, token, move |path| {
            let file_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("upload.bin").to_string();
            let size = fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
            let metadata = FileMetadata {
                name: file_name,
                size,
                original_path: None,
                source: "UPLOAD".to_string(),
            };
            let _ = app_handle_clone.emit("files:qr-upload", metadata);
        }) {
            Ok(url) => self.upload_url = Some(url),
            Err(e) => log::warn!("Failed to start upload server: {}", e),
        }

        self.audit_logger.log_session_start(&session_id);

        let _ = app.emit("session:created", &session_id);
        let _ = app.emit("session:status", "Session Active");
        let _ = app.emit("files:updated", &self.imported_files);
        let _ = app.emit("session:info-updated", self.get_session_info());

        Ok(session_id)
    }

    pub fn end_session(&mut self, reason: &str, app: &AppHandle) -> Result<(String, Vec<String>), String> {
        let _ = app.emit("session:status", "Securely Destroying Session Data...");
        self.state = "DESTRUCTION_IN_PROGRESS".to_string();
        self.audit_logger.log_wipe_start();

        let mut failures = Vec::new();

        // 1. Wipe original files if imported from host
        for file in &self.imported_files {
            if let Some(orig) = &file.original_path {
                let p = PathBuf::from(orig);
                if p.exists() {
                    if let Err(e) = secure_delete_file(&p) {
                        failures.push(format!("Original {} ({})", file.name, e));
                    }
                }
            }
        }

        // 2. Wipe active session directory
        if let Some(path) = &self.session_path {
            if let Err(e) = secure_wipe_session(path) {
                failures.push(format!("Session Dir ({})", e));
            }
        }

        let success = failures.is_empty();
        self.audit_logger.log_wipe_result(success, failures.len());
        self.audit_logger.log_session_end(reason);

        // Switch upload server to report mode
        self.upload_server.switch_to_report_mode(serde_json::json!({
            "status": if success { "CLEAN" } else { "WARNING" },
            "reason": reason,
            "failures": failures.len()
        }));

        self.state = "IDLE".to_string();
        self.active_session_id = None;
        self.session_path = None;
        self.imported_files.clear();
        self.start_time = None;
        self.upload_url = None;

        let end_reason = reason.to_string();
        let payload = serde_json::json!({
            "reason": &end_reason,
            "failures": &failures,
            "report_url": null
        });

        let _ = app.emit("session:ended", payload);
        let _ = app.emit("session:status", "No Active Session");
        let _ = app.emit("files:updated", &self.imported_files);
        let _ = app.emit("session:info-updated", self.get_session_info());

        Ok((end_reason, failures))
    }

    pub fn import_files(&mut self, paths: Vec<PathBuf>, app: &AppHandle) -> Result<Vec<FileMetadata>, String> {
        let session_path = self.session_path.as_ref().ok_or("No active session")?;

        for path in paths {
            if !path.exists() {
                continue;
            }

            let file_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("file").to_string();
            let target_path = session_path.join(&file_name);

            if fs::copy(&path, &target_path).is_ok() {
                let size = fs::metadata(&target_path).map(|m| m.len()).unwrap_or(0);
                self.imported_files.push(FileMetadata {
                    name: file_name,
                    size,
                    original_path: Some(path.to_string_lossy().to_string()),
                    source: "IMPORT".to_string(),
                });
            }
        }

        self.audit_logger.log_import(self.imported_files.len());
        let _ = app.emit("files:updated", &self.imported_files);
        let _ = app.emit("session:info-updated", self.get_session_info());
        let _ = app.emit("session:status", "Files Imported");

        Ok(self.imported_files.clone())
    }

    pub fn register_external_file(&mut self, metadata: FileMetadata, app: &AppHandle) {
        if !self.imported_files.iter().any(|f| f.name == metadata.name) {
            self.imported_files.push(metadata);
            let _ = app.emit("files:updated", &self.imported_files);
            let _ = app.emit("session:info-updated", self.get_session_info());
        }
    }

    pub fn simulate_scan(&mut self, app: &AppHandle) -> Result<Vec<FileMetadata>, String> {
        let session_path = self.session_path.as_ref().ok_or("No active session")?;
        let timestamp = chrono::Utc::now().timestamp_millis();
        let file_name = format!("Scan_{}.txt", timestamp);
        let target_path = session_path.join(&file_name);

        let content = format!(
            "[OFFICIAL SCAN DOCUMENT]\nDate: {}\nSource: SafeDesk Flatbed 1\n\n(Simulated scanned document content compliance test.)\n\nCONFIDENTIAL",
            chrono::Utc::now().to_rfc3339()
        );

        fs::write(&target_path, content).map_err(|e| e.to_string())?;
        let size = fs::metadata(&target_path).map(|m| m.len()).unwrap_or(0);

        self.imported_files.push(FileMetadata {
            name: file_name,
            size,
            original_path: None,
            source: "SCAN".to_string(),
        });

        let _ = app.emit("files:updated", &self.imported_files);
        let _ = app.emit("session:info-updated", self.get_session_info());
        let _ = app.emit("session:status", "Scan received successfully.");

        Ok(self.imported_files.clone())
    }

    pub fn delete_file(&mut self, file_name: &str, app: &AppHandle) -> Result<(), String> {
        let session_path = self.session_path.as_ref().ok_or("No active session")?;
        let file_path = session_path.join(file_name);

        secure_delete_file(&file_path)?;

        self.imported_files.retain(|f| f.name != file_name);

        let _ = app.emit("files:updated", &self.imported_files);
        let _ = app.emit("session:info-updated", self.get_session_info());

        Ok(())
    }

    pub fn get_audit_logs(&self, limit: usize) -> Vec<crate::audit_logger::AuditEntry> {
        self.audit_logger.get_logs(limit)
    }

    pub fn get_session_file_path(&self, file_name: &str) -> Option<PathBuf> {
        self.session_path.as_ref().map(|p| p.join(file_name))
    }
}
