use std::fs::File;
use std::io::Write;
use std::net::{IpAddr, UdpSocket};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use tiny_http::{Header, Method, Response, Server, StatusCode};

fn get_local_ip() -> Option<IpAddr> {
    let socket = UdpSocket::bind("0.0.0.0:0").ok()?;
    socket.connect("8.8.8.8:80").ok()?;
    socket.local_addr().ok().map(|addr| addr.ip())
}

#[derive(Clone)]
pub struct PendingApproval {
    pub file_name: String,
    pub allowed: Arc<Mutex<Option<bool>>>,
}

pub struct UploadServerState {
    pub active_token: Option<String>,
    pub session_path: Option<PathBuf>,
    pub pending_approval: Option<PendingApproval>,
    pub exposed_files: Vec<String>,
    pub report_mode: bool,
    pub report_data: Option<serde_json::Value>,
}

pub struct UploadServer {
    server: Option<Arc<Server>>,
    is_running: Arc<AtomicBool>,
    state: Arc<Mutex<UploadServerState>>,
    thread_handle: Option<thread::JoinHandle<()>>,
}

impl UploadServer {
    pub fn new() -> Self {
        Self {
            server: None,
            is_running: Arc::new(AtomicBool::new(false)),
            state: Arc::new(Mutex::new(UploadServerState {
                active_token: None,
                session_path: None,
                pending_approval: None,
                exposed_files: Vec::new(),
                report_mode: false,
                report_data: None,
            })),
            thread_handle: None,
        }
    }

    pub fn start<F>(&mut self, session_path: PathBuf, token: String, on_file_uploaded: F) -> Result<String, String>
    where
        F: Fn(PathBuf) + Send + Sync + 'static,
    {
        self.stop();

        let server = Server::http("0.0.0.0:0").map_err(|e| e.to_string())?;
        let port = server.server_addr().to_ip().map(|a| a.port()).unwrap_or(0);
        let server_arc = Arc::new(server);
        self.server = Some(server_arc.clone());

        let local_ip = get_local_ip().map(|ip| ip.to_string()).unwrap_or_else(|| "127.0.0.1".to_string());
        let upload_url = format!("http://{}:{}/upload?token={}", local_ip, port, token);

        {
            let mut st = self.state.lock().unwrap();
            st.active_token = Some(token);
            st.session_path = Some(session_path);
            st.pending_approval = None;
            st.exposed_files.clear();
            st.report_mode = false;
            st.report_data = None;
        }

        self.is_running.store(true, Ordering::SeqCst);
        let is_running = self.is_running.clone();
        let state = self.state.clone();
        let on_uploaded = Arc::new(on_file_uploaded);

        let handle = thread::spawn(move || {
            while is_running.load(Ordering::SeqCst) {
                let mut request = match server_arc.recv_timeout(std::time::Duration::from_millis(500)) {
                    Ok(Some(req)) => req,
                    _ => continue,
                };

                let url = request.url().to_string();
                let method = request.method().clone();

                let (path, query) = if let Some(idx) = url.find('?') {
                    (&url[..idx], &url[idx + 1..])
                } else {
                    (url.as_str(), "")
                };

                let query_params: std::collections::HashMap<String, String> = query
                    .split('&')
                    .filter_map(|pair| {
                        let mut parts = pair.split('=');
                        Some((parts.next()?.to_string(), parts.next().unwrap_or("").to_string()))
                    })
                    .collect();

                let st = state.lock().unwrap();
                let token_valid = st.active_token.as_ref().map_or(false, |t| {
                    query_params.get("token").map_or(false, |q| q == t)
                });
                let is_report = st.report_mode;
                let session_path = st.session_path.clone();
                let _exposed_files = st.exposed_files.clone();
                let pending_approval = st.pending_approval.clone();
                let report_data = st.report_data.clone();
                drop(st);

                if path == "/upload" && method == Method::Get {
                    if is_report {
                        let html = Self::get_report_html(&report_data);
                        let mut resp = Response::from_string(html);
                        resp.add_header(Header::from_bytes(&b"Content-Type"[..], &b"text/html; charset=utf-8"[..]).unwrap());
                        let _ = request.respond(resp);
                        continue;
                    }

                    if !token_valid {
                        let resp = Response::from_string("Invalid or expired session token.").with_status_code(StatusCode(403));
                        let _ = request.respond(resp);
                        continue;
                    }

                    let is_uploaded = query_params.get("uploaded").map(|v| v == "true").unwrap_or(false);
                    let token = query_params.get("token").cloned().unwrap_or_default();
                    let html = Self::get_mobile_html(&token, is_uploaded);
                    let mut resp = Response::from_string(html);
                    resp.add_header(Header::from_bytes(&b"Content-Type"[..], &b"text/html; charset=utf-8"[..]).unwrap());
                    let _ = request.respond(resp);
                    continue;
                }

                if path == "/upload" && method == Method::Post {
                    if !token_valid || session_path.is_none() {
                        let resp = Response::from_string("Forbidden").with_status_code(StatusCode(403));
                        let _ = request.respond(resp);
                        continue;
                    }

                    let s_path = session_path.unwrap();
                    let timestamp = chrono::Utc::now().timestamp_millis();
                    let file_name = format!("QR_{}_mobile_upload.bin", timestamp);
                    let target_path = s_path.join(&file_name);

                    let mut reader = request.as_reader();
                    let mut body = Vec::new();
                    let _ = std::io::Read::read_to_end(&mut reader, &mut body);

                    // Extract payload
                    let saved_file = if let Ok(mut out) = File::create(&target_path) {
                        let _ = out.write_all(&body);
                        true
                    } else {
                        false
                    };

                    if saved_file {
                        let on_up = on_uploaded.clone();
                        let tp = target_path.clone();
                        thread::spawn(move || {
                            on_up(tp);
                        });

                        let token = query_params.get("token").cloned().unwrap_or_default();
                        let redirect_url = format!("/upload?token={}&uploaded=true", token);
                        let mut resp = Response::from_string("").with_status_code(StatusCode(302));
                        resp.add_header(Header::from_bytes(&b"Location"[..], redirect_url.as_bytes()).unwrap());
                        let _ = request.respond(resp);
                    } else {
                        let resp = Response::from_string("Upload failed").with_status_code(StatusCode(500));
                        let _ = request.respond(resp);
                    }
                    continue;
                }

                if path == "/check-print" && method == Method::Get {
                    let json = if let Some(appr) = pending_approval {
                        format!(r#"{{"pending": true, "fileName": "{}"}}"#, appr.file_name)
                    } else {
                        r#"{"pending": false}"#.to_string()
                    };
                    let mut resp = Response::from_string(json);
                    resp.add_header(Header::from_bytes(&b"Content-Type"[..], &b"application/json"[..]).unwrap());
                    let _ = request.respond(resp);
                    continue;
                }

                if path == "/respond-print" && method == Method::Post {
                    let mut reader = request.as_reader();
                    let mut body_str = String::new();
                    let _ = std::io::Read::read_to_string(&mut reader, &mut body_str);

                    let allowed = body_str.contains("ALLOW");
                    let mut st = state.lock().unwrap();
                    if let Some(appr) = st.pending_approval.take() {
                        if let Ok(mut lock) = appr.allowed.lock() {
                            *lock = Some(allowed);
                        }
                    }
                    let resp = Response::from_string(r#"{"success": true}"#);
                    let _ = request.respond(resp);
                    continue;
                }

                // Default 404
                let resp = Response::from_string("Not Found").with_status_code(StatusCode(404));
                let _ = request.respond(resp);
            }
        });

        self.thread_handle = Some(handle);
        Ok(upload_url)
    }

    pub fn switch_to_report_mode(&self, data: serde_json::Value) {
        let mut st = self.state.lock().unwrap();
        st.report_mode = true;
        st.report_data = Some(data);
        st.active_token = None;
    }

    pub fn stop(&mut self) {
        self.is_running.store(false, Ordering::SeqCst);
        self.server = None;
        if let Some(handle) = self.thread_handle.take() {
            let _ = handle.join();
        }
    }

    fn get_mobile_html(token: &str, is_uploaded: bool) -> String {
        format!(
            r#"<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SafeDesk Secure Mobile Upload</title>
    <style>
        * {{ box-sizing: border-box; margin: 0; padding: 0; }}
        body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; padding: 24px; text-align: center; }}
        .card {{ background: #1e293b; border-radius: 16px; padding: 28px; max-width: 440px; margin: 40px auto; border: 1px solid #334155; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }}
        h1 {{ font-size: 24px; margin-bottom: 8px; color: #38bdf8; }}
        p {{ color: #94a3b8; font-size: 14px; margin-bottom: 24px; line-height: 1.5; }}
        .btn {{ display: block; width: 100%; padding: 14px; background: #0284c7; color: white; border: none; border-radius: 10px; font-size: 16px; font-weight: 600; cursor: pointer; transition: 0.2s; }}
        .btn:hover {{ background: #0369a1; }}
        .success-box {{ background: #064e3b; border: 1px solid #059669; color: #a7f3d0; border-radius: 10px; padding: 16px; margin-bottom: 20px; }}
        .input-file {{ display: none; }}
        .file-label {{ display: block; padding: 20px; border: 2px dashed #475569; border-radius: 12px; margin-bottom: 20px; cursor: pointer; color: #cbd5e1; }}
        .file-label:hover {{ border-color: #38bdf8; }}
    </style>
</head>
<body>
    <div class="card">
        <h1>SafeDesk</h1>
        <p>Forensically Isolated Ephemeral Workspace</p>

        {}

        <form action="/upload?token={}" method="POST" enctype="multipart/form-data">
            <label class="file-label" id="file-label">
                <span>📁 Tap to select file</span>
                <input type="file" name="file" class="input-file" id="file-input" onchange="document.getElementById('file-label').innerText = this.files[0] ? this.files[0].name : 'Tap to select file';">
            </label>
            <button type="submit" class="btn">Secure Upload to Kiosk</button>
        </form>
    </div>
</body>
</html>"#,
            if is_uploaded {
                r#"<div class="success-box">✅ File uploaded securely to the active kiosk session!</div>"#
            } else {
                ""
            },
            token
        )
    }

    fn get_report_html(report_data: &Option<serde_json::Value>) -> String {
        let details = report_data.as_ref().map(|d| d.to_string()).unwrap_or_else(|| "All session files securely overwritten and destroyed.".to_string());
        format!(
            r#"<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SafeDesk Compliance Certificate</title>
    <style>
        body {{ font-family: sans-serif; background: #0b132b; color: white; text-align: center; padding: 30px; }}
        .cert {{ border: 2px solid #10b981; border-radius: 16px; padding: 30px; max-width: 500px; margin: 30px auto; background: #1c2541; }}
        h1 {{ color: #10b981; }}
        p {{ color: #94a3b8; font-size: 15px; margin: 16px 0; }}
        .badge {{ background: #064e3b; color: #34d399; padding: 8px 16px; border-radius: 20px; font-weight: bold; display: inline-block; }}
    </style>
</head>
<body>
    <div class="cert">
        <span class="badge">Forensic Verification Pass</span>
        <h1>Certificate of Destruction</h1>
        <p>The active session data has been permanently overwritten with random cryptographic patterns, renamed, and destroyed.</p>
        <p><small>{}</small></p>
    </div>
</body>
</html>"#,
            details
        )
    }
}
