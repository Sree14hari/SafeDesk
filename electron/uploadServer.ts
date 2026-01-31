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

    constructor() {
        super();
        this.app = express();
        this.app.use(express.json()); // Enable JSON body parsing
        this.setupRoutes();
    }

    private setupRoutes() {
        // 1. Mobile Client Page
        this.app.get('/upload', (req, res) => {
            const token = req.query.token as string;
            const clientIp = req.socket.remoteAddress || req.ip;

            if (!token || token !== this.activeToken) {
                return res.status(403).send('Invalid or expired Secure Upload Token.');
            }

            // Single Device Lock
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

            res.send(this.getMobilePageHtml(token));
        });

        // 2. File Upload Handler
        this.app.post('/upload', (req, res) => {
            const token = req.query.token as string;

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

                const uploadedFileLine = Array.isArray(files.file) ? files.file[0] : files.file;
                
                if (uploadedFileLine) {
                    // this.uploadUsed = true; // Multiple uploads allowed
                    this.emit('file-uploaded', uploadedFileLine.filepath || uploadedFileLine.newFilename);
                    
                    // Return same page but in "Waiting" mode
                    res.send(this.getMobilePageHtml(token, true));
                } else {
                    res.status(400).send('No file received.');
                }
            });
        });

        // 3. Polling Endpoint for Print Requests
        this.app.get('/check-print', (req, res) => {
            const token = req.query.token as string;
            if (!token || token !== this.activeToken) return res.status(403).json({ error: 'Auth failed' });

            if (this.pendingApproval) {
                res.json({ pending: true, fileName: this.pendingApproval.fileName });
            } else {
                res.json({ pending: false });
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
            if (!token || token !== this.activeToken) return res.status(403).json({ error: 'Auth failed' });
            
            this.emit('session-end-requested');
            res.json({ success: true });
        });
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

    public async start(sessionPath: string, token: string): Promise<string> {
        return new Promise((resolve, reject) => {
            if (this.server) this.stop();

            this.sessionPath = sessionPath;
            this.activeToken = token;
            this.uploadUsed = false;
            this.pendingApproval = null;
            this.connectedIp = null;

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

    public stop() {
        if (this.server) {
            this.server.close();
            this.server = null;
            this.port = null;
            this.activeToken = null;
            this.sessionPath = null;
            this.uploadUsed = false;
            if (this.pendingApproval) {
                this.pendingApproval.resolve(false); // Reject explicit pending
                this.pendingApproval = null;
            }
            console.log('[UploadServer] Stopped.');
        }
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
                            <span id="fName">Tap to Select File</span>
                            <input type="file" id="f" name="file" style="display:none" onchange="document.getElementById('fName').textContent = this.files[0].name">
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
                        // Handle 403 (Session Ended) by reloading to show error/closed
                        if (res.status === 403) location.reload(); 
                        
                        const data = await res.json();
                        
                        const overlay = document.getElementById('approvalOverlay');
                        if (data.pending) {
                            document.getElementById('reqFileName').textContent = data.fileName;
                            overlay.classList.remove('hidden');
                             // Vibrate if supported
                             if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
                        } else {
                            overlay.classList.add('hidden');
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
                         document.body.innerHTML = '<div style="text-align:center; padding: 40px;"><h1>Session Ended</h1><p>Data securely destroyed.</p></div>';
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
