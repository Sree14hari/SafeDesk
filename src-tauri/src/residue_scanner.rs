use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use crate::secure_wipe::secure_delete_file;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ResidueFile {
    pub path: String,
    pub name: String,
    pub location: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct InspectionReport {
    pub timestamp: u64,
    #[serde(rename = "foundFiles")]
    pub found_files: Vec<ResidueFile>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CleanupReport {
    #[serde(rename = "successCount")]
    pub success_count: usize,
    pub failures: Vec<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ScanOptions {
    pub desktop: bool,
    pub downloads: bool,
    pub documents: bool,
    pub pictures: bool,
}

impl Default for ScanOptions {
    fn default() -> Self {
        Self {
            desktop: true,
            downloads: true,
            documents: false,
            pictures: false,
        }
    }
}

const TARGET_EXTENSIONS: &[&str] = &[".pdf", ".jpg", ".png", ".jpeg", ".docx", ".xlsx"];
const SENSITIVE_KEYWORDS: &[&str] = &[
    "aadhaar", "aadhar", "pan", "resume", "id", "voter",
    "passport", "marklist", "certificate", "ration", "cv", "biodata", "license",
];

pub struct ResidueScanner;

impl ResidueScanner {
    pub fn scan(options: ScanOptions) -> InspectionReport {
        let mut found_files = Vec::new();

        if options.desktop {
            if let Some(p) = dirs::desktop_dir() {
                Self::scan_directory(&p, "Desktop", &mut found_files);
            }
        }

        if options.downloads {
            if let Some(p) = dirs::download_dir() {
                Self::scan_directory(&p, "Downloads", &mut found_files);
            }
        }

        if options.documents {
            if let Some(p) = dirs::document_dir() {
                Self::scan_directory(&p, "Documents", &mut found_files);
            }
        }

        if options.pictures {
            if let Some(p) = dirs::picture_dir() {
                Self::scan_directory(&p, "Pictures", &mut found_files);
            }
        }

        let timestamp = chrono::Utc::now().timestamp_millis() as u64;
        InspectionReport {
            timestamp,
            found_files,
        }
    }

    fn scan_directory(dir_path: &Path, location: &str, results: &mut Vec<ResidueFile>) {
        if !dir_path.exists() {
            return;
        }

        if let Ok(entries) = fs::read_dir(dir_path) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() {
                    if let Some(file_name) = path.file_name().and_then(|n| n.to_str()) {
                        if Self::is_sensitive(file_name) {
                            results.push(ResidueFile {
                                path: path.to_string_lossy().to_string(),
                                name: file_name.to_string(),
                                location: location.to_string(),
                            });
                        }
                    }
                }
            }
        }
    }

    fn is_sensitive(filename: &str) -> bool {
        let lower = filename.to_lowercase();
        let has_target_ext = TARGET_EXTENSIONS.iter().any(|ext| lower.ends_with(ext));
        if !has_target_ext {
            return false;
        }

        SENSITIVE_KEYWORDS.iter().any(|kw| lower.contains(kw))
    }

    pub fn clean(files: &[ResidueFile]) -> CleanupReport {
        let mut success_count = 0;
        let mut failures = Vec::new();

        for file in files {
            let path = PathBuf::from(&file.path);
            match secure_delete_file(&path) {
                Ok(_) => success_count += 1,
                Err(e) => failures.push(format!("{} ({})", file.name, e)),
            }
        }

        CleanupReport {
            success_count,
            failures,
        }
    }
}
