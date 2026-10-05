use serde::{Deserialize, Serialize};
use std::fs::{self, File, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AuditEntry {
    pub timestamp: String,
    pub r#type: String,
    pub details: String,
}

pub struct AuditLogger {
    log_file: PathBuf,
}

impl AuditLogger {
    pub fn new() -> Self {
        let base_dir = Path::new(r"C:\SafeDesk");
        let log_file = if fs::create_dir_all(base_dir).is_ok() {
            base_dir.join("audit_log.json")
        } else {
            let app_data = dirs::data_local_dir().unwrap_or_else(|| PathBuf::from("."));
            let fallback_dir = app_data.join("SafeDesk");
            let _ = fs::create_dir_all(&fallback_dir);
            fallback_dir.join("audit_log.json")
        };

        if !log_file.exists() {
            let _ = File::create(&log_file);
        }

        Self { log_file }
    }

    pub fn write_log(&self, event_type: &str, details: &str) {
        let entry = AuditEntry {
            timestamp: chrono::Utc::now().to_rfc3339(),
            r#type: event_type.to_string(),
            details: details.to_string(),
        };

        if let Ok(line) = serde_json::to_string(&entry) {
            if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(&self.log_file) {
                let _ = writeln!(file, "{}", line);
            }
        }
    }

    pub fn log_session_start(&self, session_id: &str) {
        self.write_log("SESSION_START", &format!("Session started: {}", session_id));
    }

    pub fn log_session_end(&self, reason: &str) {
        self.write_log("SESSION_END", &format!("Session ended. Reason: {}", reason));
    }

    pub fn log_import(&self, count: usize) {
        self.write_log("SESSION_START", &format!("Imported {} files.", count));
    }

    pub fn log_wipe_start(&self) {
        self.write_log("WIPE_START", "Secure wipe data destruction initiated.");
    }

    pub fn log_wipe_result(&self, success: bool, failure_count: usize) {
        if success {
            self.write_log("WIPE_SUCCESS", "Secure wipe completed successfully.");
        } else {
            self.write_log("WIPE_FAILURE", &format!("Secure wipe completed with {} errors.", failure_count));
        }
    }

    pub fn get_logs(&self, limit: usize) -> Vec<AuditEntry> {
        let mut entries = Vec::new();
        if let Ok(file) = fs::File::open(&self.log_file) {
            let reader = BufReader::new(file);
            for line in reader.lines().flatten() {
                if let Ok(entry) = serde_json::from_str::<AuditEntry>(&line) {
                    entries.push(entry);
                }
            }
        }
        entries.reverse();
        if entries.len() > limit {
            entries.truncate(limit);
        }
        entries
    }
}
