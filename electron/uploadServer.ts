import express from 'express';
import * as http from 'http';
import formidable, { File } from 'formidable';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as ip from 'ip';
import { EventEmitter } from 'events';

export class UploadServer extends EventEmitter {
    private app: express.Express;
    private server: http.Server | null = null;
    private activeToken: string | null = null;
    private sessionPath: string | null = null;
    private port: number | null = null;
    
    // Approval State
    private uploadUsed: boolean = false;
    private connectedIp: string | null = null;
    private pendingApproval: { 
        resolve: (allowed: boolean) => void, 
        fileName: string 
    } | null = null;
    private multiDeviceAllowed: boolean = false;
    private exposedFiles: string[] = []; // Files explicitly shared for mobile download

    constructor() {
        super();
        this.app = express();
        this.app.use(express.json()); // Enable JSON body parsing
        this.setupRoutes();
    }


    private reportData: any | null = null;

    private setupRoutes() {
        // 1. Mobile Client Page
        this.app.get('/upload', (req, res) => {
            if (this.reportData) {
                return res.send(this.getReportPageHtml(this.reportData));
            }

            const token = req.query.token as string;
            const clientIp = req.socket.remoteAddress || req.ip;

            if (!token || token !== this.activeToken) {
                return res.status(403).send('Invalid or expired Secure Upload Token.');
            }

            // Single Device Lock
            // Single Device Lock
            if (!this.multiDeviceAllowed) {
                if (this.connectedIp && this.connectedIp !== clientIp) {
                    return res.status(403).send(`
                        <h1>Secure Channel Busy</h1>
                        <p>Another device is already connected to this secure session.</p>
                    `);
                }

                // Lock to this IP
                if (!this.connectedIp && clientIp) {
                    this.connectedIp = clientIp as string;
                    console.log(`[UploadServer] Secure channel locked to device: ${this.connectedIp}`);
                }
            }

            const isUploaded = req.query.uploaded === 'true';
            res.send(this.getMobilePageHtml(token, isUploaded));
        });

        // 2. File Upload Handler
        this.app.post('/upload', (req, res) => {
            const token = req.query.token as string;

            if (this.reportData) return res.status(410).send("Session Ended.");

            if (!token || token !== this.activeToken || !this.sessionPath) {
                return res.status(403).send('Session invalid or expired.');
            }

            /* Multiple uploads allowed now
            if (this.uploadUsed) {
                return res.status(403).send('One-time upload limit reached.');
            }
            */

            const form = formidable({
                uploadDir: this.sessionPath, 
                keepExtensions: true,
                maxFileSize: 50 * 1024 * 1024,
                filename: (name: string, ext: string, part: any, form: any) => {
                    const safeName = path.basename(part.originalFilename || 'upload').replace(/[^a-zA-Z0-9._-]/g, '_');
                    return `QR_${Date.now()}_${safeName}`; 
                }
            });

            form.parse(req, (err: any, fields: any, files: any) => {
                if (err) {
                    console.error('[UploadServer] Parse error:', err);
                    return res.status(500).send('Upload failed.');
                }

                const fileList: formidable.File[] = Array.isArray(files.file) ? files.file : [files.file];
                
                let count = 0;
                for (const f of fileList) {
                    if (f) {
                         const finalPath = f.filepath || f.newFilename; // formidable v3
                         if (finalPath) {
                             this.emit('file-uploaded', finalPath);
                             count++;
                         }
                    }
                }
                
                if (count > 0) {
                    // Return same page but in "Waiting" mode
                    // Post-Redirect-Get to prevent re-submission on reload
                    res.redirect(`/upload?token=${token}&uploaded=true`);
                } else {
                    res.status(400).send('No file received.');
                }
            });
        });

        // 3. Polling Endpoint for Print Requests
        this.app.get('/check-print', (req, res) => {
            if (this.reportData) return res.json({ ended: true }); // Signal frontend to reload

            const token = req.query.token as string;
            if (!token || token !== this.activeToken) return res.status(403).json({ error: 'Auth failed' });

            if (this.pendingApproval) {
                res.json({ pending: true, fileName: this.pendingApproval.fileName, downloads: this.exposedFiles });
            } else {
                res.json({ pending: false, downloads: this.exposedFiles });
            }
        });

        // 4. Response Endpoint for Approval
        this.app.post('/respond-print', (req, res) => {
            const token = req.query.token as string;
            const { decision } = req.body; // 'ALLOW' | 'DENY'
            
            if (!token || token !== this.activeToken) return res.status(403).json({ error: 'Auth failed' });
            
            if (this.pendingApproval) {
                this.pendingApproval.resolve(decision === 'ALLOW');
                this.pendingApproval = null;
                res.json({ success: true });
            } else {
                res.json({ success: false, error: 'No pending request' });
            }
        });

        // 5. End Session Endpoint
        this.app.post('/end-session', (req, res) => {
            const token = req.query.token as string;
            if (!token || token !== this.activeToken) return res.status(403).send("Forbidden");
            
            this.emit('session-end-requested');
            res.json({ success: true });
        });
        // 6. Download Endpoint
        this.app.get('/download/:filename', (req, res) => {
            const token = req.query.token as string;
            if (!token || token !== this.activeToken || !this.sessionPath) return res.status(403).send("Forbidden");
            
            const clientIp = req.socket.remoteAddress || req.ip;
            if (!this.multiDeviceAllowed && this.connectedIp && this.connectedIp !== clientIp) {
                return res.status(403).send("Access Secure Link from the connected device only.");
            }

            const filename = req.params.filename;
            // Only allow if in exposed list
            if (!this.exposedFiles.includes(filename)) {
                return res.status(404).send("File not shared.");
            }

            const filePath = path.join(this.sessionPath, filename);
            if (!fs.existsSync(filePath)) return res.status(404).send("File not found.");

            res.download(filePath, filename);
        });
    }

    public exposeFile(filename: string) {
        if (!this.exposedFiles.includes(filename)) {
            this.exposedFiles.push(filename);
            console.log(`[UploadServer] Exposing file for download: ${filename}`);
        }
    }

    public async requestApproval(fileName: string): Promise<boolean> {
        return new Promise((resolve) => {
            if (this.pendingApproval) {
                // Determine logic for concurrent requests? Reject old?
                // For simplicity, reject old one.
                this.pendingApproval.resolve(false); 
            }
            this.pendingApproval = { resolve, fileName };
            console.log(`[UploadServer] Pending approval for ${fileName}`);
        });
    }

    public async start(sessionPath: string, token: string, allowMultiDevice: boolean = false): Promise<string> {
        return new Promise((resolve, reject) => {
            if (this.server) this.stop();

            this.sessionPath = sessionPath;
            this.activeToken = token;
            this.uploadUsed = false;
            this.pendingApproval = null;
            this.exposedFiles = []; // Reset exposed files

            this.connectedIp = null;
            this.reportData = null;
            this.multiDeviceAllowed = allowMultiDevice;

            // Start on random port
            this.server = this.app.listen(0, () => {
                const addr = this.server?.address();
                if (typeof addr === 'object' && addr) {
                    this.port = addr.port;
                    const ipAddr = ip.address();
                    const url = `http://${ipAddr}:${this.port}/upload?token=${token}`;
                    console.log(`[UploadServer] Listening on ${url}`);
                    resolve(url);
                } else {
                    reject(new Error('Failed to get server address'));
                }
            });
        });
    }

    public switchToReportMode(data: any) {
        this.reportData = data;
        this.activeToken = null; // Invalidate token to prevent connection reuse for upload
        this.sessionPath = null; // Unlink session path
        console.log('[UploadServer] Switched to REPORT MODE');
    }

    public stop() {
        if (this.server) {
            this.server.close();
            this.server = null;
            this.port = null;
            this.activeToken = null;
            this.sessionPath = null;
            this.uploadUsed = false;
            this.reportData = null;
            if (this.pendingApproval) {
                this.pendingApproval.resolve(false); // Reject explicit pending
                this.pendingApproval = null;
            }
            console.log('[UploadServer] Stopped.');
        }
    }

    private getReportPageHtml(data: any) {
        return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Session Report</title>
             <style>
                body { font-family: -apple-system, system-ui, sans-serif; background: #e6f7ff; color: #000; display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; margin:0; padding: 20px; box-sizing:border-box; }
                .card { background: white; padding: 30px; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); text-align: center; max-width: 400px; width: 100%; border: 2px solid #1890ff; }
                .icon { font-size: 60px; color: #52c41a; margin-bottom: 20px; }
                h1 { margin: 0 0 10px 0; font-size: 24px; }
                p { color: #555; margin: 5px 0; font-size: 14px; }
                .stats { margin-top: 20px; text-align: left; background: #f5f5f5; padding: 15px; border-radius: 10px; }
                .row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #ddd; }
                .row:last-child { border: none; }
                .lbl { font-weight: 600; color: #666; }
                .val { font-weight: 700; color: #333; }
            </style>
        </head>
        <body>
            <div class="card">
                <div class="icon">🛡️</div>
                <h1>Everything Wiped</h1>
                <p>Your session data has been securely destroyed from the laptop.</p>
                
                <div class="stats">
                    <div class="row"><span class="lbl">Session ID</span> <span class="val">${data.sessionId || 'N/A'}</span></div>
                    <div class="row"><span class="lbl">Files Wiped</span> <span class="val">${data.filesWiped}</span></div>
                    <div class="row"><span class="lbl">Session Time</span> <span class="val">${data.duration}</span></div>
                    <div class="row"><span class="lbl">Completed</span> <span class="val">${new Date().toLocaleTimeString()}</span></div>
                    
                    ${data.fileList && data.fileList.length > 0 ? `
                        <div style="margin-top:15px; text-align:left; font-size:12px; color:#666; max-height:100px; overflow-y:auto; border-top:1px solid #ddd; padding-top:10px;">
                            <div style="font-weight:700; margin-bottom:5px;">WIPED FILES:</div>
                            ${data.fileList.map((f:string) => `<div>• ${f}</div>`).join('')}
                        </div>
                    ` : ''}
                </div>
                
                 <div style="margin-top: 20px; color: #1890ff; font-weight: bold; font-size: 13px;">
                    SAFE TO DISCONNECT
                </div>
            </div>
        </body>
        </html>
        `;
    }

    private getMobilePageHtml(token: string, isUploaded: boolean = false) {
        return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            <title>Secure Link</title>
            <style>
                :root { --primary: #000; --danger: #cf1322; --success: #389e0d; --bg: #f5f5f5; }
                body { font-family: -apple-system, system-ui, sans-serif; background: var(--bg); margin: 0; display: flex; align-items: center; justify-content: center; height: 100vh; text-align: center; padding: 20px; box-sizing: border-box;}
                .card { background: white; padding: 30px; border-radius: 16px; width: 100%; max-width: 400px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
                .hidden { display: none !important; }
                .btn { display: block; width: 100%; padding: 15px; border-radius: 8px; font-weight: 700; border: none; cursor: pointer; font-size: 16px; margin-top: 10px; }
                .btn-primary { background: var(--primary); color: white; }
                .btn-success { background: var(--success); color: white; }
                .btn-danger { background: var(--danger); color: white; }
                .status-icon { font-size: 40px; margin-bottom: 20px; display: block; }
                
                #approvalOverlay {
                    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(0,0,0,0.85); color: white;
                    display: flex; flex-direction: column; 
                    align-items: center; justify-content: center;
                    padding: 30px; z-index: 100;
                }
                .blink { animation: blink 1.5s infinite; }
                @keyframes blink { 50% { opacity: 0.5; } }
            </style>
        </head>
        <body>
            <div class="card">
                <div style="font-weight: 900; font-size: 20px; margin-bottom: 20px; text-transform: uppercase;">SecureEngine</div>
                
                <!-- UPLOAD STATE -->
                <div id="uploadState" class="${isUploaded ? 'hidden' : ''}">
                    <form action="/upload?token=${token}" method="post" enctype="multipart/form-data">
                        <div style="border: 2px dashed #ddd; padding: 40px 20px; border-radius: 12px; margin-bottom: 20px; cursor: pointer;" onclick="document.getElementById('f').click()">
                            <span style="font-size:30px">📄</span><br><br>
                            <span id="fName">Tap to Select Files</span>
                            <input type="file" id="f" name="file" multiple style="display:none" onchange="const c = this.files.length; document.getElementById('fName').textContent = c > 1 ? c + ' files selected' : this.files[0].name">
                        </div>
                        <button class="btn btn-primary" type="submit">SECURE UPLOAD</button>
                    </form>
                </div>

                <!-- WAITING STATE -->
                <div id="waitState" class="${!isUploaded ? 'hidden' : ''}">
                    <span class="status-icon">✅</span>
                    <h2 style="margin: 0 0 10px 0;">Connected</h2>
                    <p style="color: #666; font-size: 14px;">File uploaded successfully.</p>
                    <button class="btn btn-primary" onclick="window.location.href='/upload?token=${token}'">Upload Another File</button>
                    <button class="btn btn-danger" onclick="endSession()">End Session & Destroy Data</button>
                    <div style="background: #fffbe6; border: 1px solid #ffe58f; padding: 15px; border-radius: 8px; margin-top: 20px;">
                        <div class="blink" style="font-weight: 700; color: #d46b08; margin-bottom: 5px;">⚠️ DO NOT CLOSE</div>
                        <div style="font-size: 12px; color: #888;">Please keep this screen open.<br>You will need to authorize printing request from the PC.</div>
                    </div>
                    </div>

                    <div id="downloadContainer" class="hidden" style="margin-top: 20px; text-align: left; background: #f0f5ff; padding: 15px; border-radius: 8px; border: 1px solid #adc6ff;">
                        <!-- Downloads injected here -->
                    </div>
            </div>

            <!-- APPROVAL OVERLAY -->
            <div id="approvalOverlay" class="hidden">
                 <!-- ... existing overlay content ... -->
                <div style="text-align: center;">
                    <span style="font-size: 50px;">🖨️</span>
                    <h2 style="margin: 20px 0;">Print Request</h2>
                    <p>The PC is requesting to print:</p>
                    <div id="reqFileName" style="font-family: monospace; background: #333; padding: 10px; border-radius: 6px; margin-bottom: 30px; word-break: break-all;">doc.pdf</div>
                    
                    <button class="btn btn-success" onclick="reply('ALLOW')">ALLOW PRINT</button>
                    <button class="btn btn-danger" onclick="reply('DENY')">DENY</button>
                </div>
            </div>

            <script>
                const token = "${token}";
                
                // Polling Loop
                if (!document.getElementById('waitState').classList.contains('hidden')) {
                    setInterval(checkStatus, 1000);
                }

                async function checkStatus() {
                    try {
                        const res = await fetch(\`/check-print?token=\${token}\`);
                         
                        // If session report exists, reload to see it
                        const data = await res.json();
                        if (data.ended) { window.location.reload(); return; }

                        if (res.status === 403) location.reload(); 
                        
                        const overlay = document.getElementById('approvalOverlay');
                        if (data.pending) {
                            document.getElementById('reqFileName').textContent = data.fileName;
                            overlay.classList.remove('hidden');
                             // Vibrate if supported
                             if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
                        } else {
                            overlay.classList.add('hidden');
                        }

                        // Update Downloads
                        const downloadContainer = document.getElementById('downloadContainer');
                        if (data.downloads && data.downloads.length > 0) {
                             downloadContainer.classList.remove('hidden');
                             downloadContainer.innerHTML = '<h3 style="margin:0 0 10px 0; font-size:14px; text-transform:uppercase;">Files from PC</h3>';
                             data.downloads.forEach(f => {
                                 const btn = document.createElement('a');
                                 btn.href = \`/download/\${f}?token=\${token}\`;
                                 btn.className = 'btn btn-success';
                                 btn.style.textDecoration = 'none';
                                 btn.style.display = 'block';
                                 btn.style.marginBottom = '8px';
                                 btn.textContent = '⬇️ ' + f;
                                 downloadContainer.appendChild(btn);
                             });
                        }
                    } catch (e) { console.error(e); }
                }

                async function reply(choice) {
                    try {
                        document.getElementById('approvalOverlay').innerHTML = 'Sending...';
                        await fetch(\`/respond-print?token=\${token}\`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ decision: choice })
                        });
                        location.reload(); // Reset UI
                    } catch (e) {
                        alert('Connection Failed');
                    }
                }

                async function endSession() {
                    if (!confirm("Are you sure? This will destroy all uploaded files immediately.")) return;
                    
                    try {
                         await fetch(\`/end-session?token=\${token}\`, { method: 'POST' });
                         // The server will switch to report mode and subsequent polling/reloads will show the report
                    } catch (e) {
                         alert('Failed to end session');
                    }
                }
            </script>
        </body>
        </html>
        `;
    }
}
