use rand::RngCore;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::Path;
use std::thread;
use std::time::Duration;

const RETRY_ATTEMPTS: usize = 10;
const RETRY_DELAY: Duration = Duration::from_millis(300);
const CHUNK_SIZE: usize = 64 * 1024; // 64 KB

fn sleep_retry() {
    thread::sleep(RETRY_DELAY);
}

/// Strip read-only, hidden, and system attributes on Windows
#[cfg(target_os = "windows")]
fn clear_attributes(path: &Path) {
    if let Some(path_str) = path.to_str() {
        let _ = std::process::Command::new("attrib")
            .args(["-r", "-h", "-s", path_str])
            .output();
    }
}

#[cfg(not(target_os = "windows"))]
fn clear_attributes(_path: &Path) {}

/// Securely overwrites, renames, and unlinks a single file
pub fn secure_delete_file(file_path: &Path) -> Result<(), String> {
    if !file_path.exists() {
        return Ok(());
    }

    clear_attributes(file_path);

    // 1. Overwrite with random bytes
    let metadata = fs::metadata(file_path).map_err(|e| e.to_string())?;
    let file_size = metadata.len();

    if file_size > 0 {
        let mut file = None;
        for i in 0..RETRY_ATTEMPTS {
            match OpenOptions::new().write(true).read(true).open(file_path) {
                Ok(f) => {
                    file = Some(f);
                    break;
                }
                Err(e) => {
                    if i == RETRY_ATTEMPTS - 1 {
                        return Err(format!("Failed to open file for wipe: {}", e));
                    }
                    sleep_retry();
                }
            }
        }

        if let Some(mut f) = file {
            let mut rng = rand::thread_rng();
            let mut written = 0u64;
            let mut buf = vec![0u8; CHUNK_SIZE];

            while written < file_size {
                let to_write = std::cmp::min((file_size - written) as usize, CHUNK_SIZE);
                rng.fill_bytes(&mut buf[..to_write]);
                if let Err(e) = f.write_all(&buf[..to_write]) {
                    return Err(format!("Failed to overwrite file data: {}", e));
                }
                written += to_write as u64;
            }

            let _ = f.sync_all();
            drop(f);
        }
    }

    // 2. Rename obfuscation
    let parent = file_path.parent().unwrap_or_else(|| Path::new("."));
    let mut random_bytes = [0u8; 8];
    rand::thread_rng().fill_bytes(&mut random_bytes);
    let random_hex: String = random_bytes.iter().map(|b| format!("{:02x}", b)).collect();
    let obfuscated_path = parent.join(format!("{}.wiped", random_hex));

    let mut renamed = false;
    for _ in 0..RETRY_ATTEMPTS {
        if fs::rename(file_path, &obfuscated_path).is_ok() {
            renamed = true;
            break;
        }
        sleep_retry();
    }

    let target_path = if renamed { &obfuscated_path } else { file_path };

    // 3. Final unlink
    for i in 0..RETRY_ATTEMPTS {
        if fs::remove_file(target_path).is_ok() {
            log::info!("[SecureWipe] DESTROYED: {:?}", file_path);
            return Ok(());
        }
        if i == RETRY_ATTEMPTS - 1 {
            // Fallback for Windows: powershell force remove
            #[cfg(target_os = "windows")]
            {
                if let Some(p_str) = target_path.to_str() {
                    let cmd = format!("Remove-Item -LiteralPath '{}' -Force", p_str);
                    if let Ok(out) = std::process::Command::new("powershell").args(["-Command", &cmd]).output() {
                        if out.status.success() {
                            return Ok(());
                        }
                    }
                }
            }
            return Err(format!("Failed to unlink file after multiple attempts: {:?}", target_path));
        }
        sleep_retry();
    }

    Ok(())
}

/// Recursively wipes all files in directory and deletes directory
pub fn secure_wipe_session(dir_path: &Path) -> Result<bool, String> {
    if !dir_path.exists() {
        return Ok(true);
    }

    log::info!("[SecureWipe] Starting destruction of directory: {:?}", dir_path);

    if dir_path.is_dir() {
        let entries = fs::read_dir(dir_path).map_err(|e| e.to_string())?;
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                let _ = secure_wipe_session(&path);
            } else {
                let _ = secure_delete_file(&path);
            }
        }

        for _ in 0..RETRY_ATTEMPTS {
            if fs::remove_dir(dir_path).is_ok() {
                break;
            }
            sleep_retry();
        }
    }

    if dir_path.exists() {
        // Attempt recursive removal fallback
        let _ = fs::remove_dir_all(dir_path);
    }

    let cleaned = !dir_path.exists();
    if cleaned {
        log::info!("[SecureWipe] Directory successfully destroyed.");
    }
    Ok(cleaned)
}
