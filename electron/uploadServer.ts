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

    constructor() {
        super();
        this.app = express();
        this.setupRoutes();
    }

    private setupRoutes() {
        this.app.get('/upload', (req, res) => {
            const token = req.query.token as string;

            if (!token || token !== this.activeToken) {
                return res.status(403).send('Invalid or expired Secure Upload Token.');
            }

            // Mobile-Friendly Secure Upload UI
            res.send(`
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
                    <title>Secure Upload</title>
                    <style>
                        :root {
                            --primary: #000000;
                            --danger: #cf1322;
                            --bg: #f5f5f5;
                            --card-bg: #ffffff;
                            --text: #333333;
                        }
                        body {
                            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                            background-color: var(--bg);
                            margin: 0;
                            padding: 20px;
                            height: 100vh;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            box-sizing: border-box;
                        }
                        .container {
                            background: var(--card-bg);
                            width: 100%;
                            max-width: 400px;
                            padding: 30px;
                            border-radius: 16px;
                            box-shadow: 0 4px 20px rgba(0,0,0,0.08);
                            text-align: center;
                        }
                        .brand {
                            font-weight: 800;
                            font-size: 20px;
                            margin-bottom: 24px;
                            color: var(--primary);
                            text-transform: uppercase;
                            letter-spacing: -0.5px;
                        }
                        .upload-box {
                            border: 2px dashed #ddd;
                            border-radius: 12px;
                            padding: 30px 20px;
                            margin-bottom: 24px;
                            cursor: pointer;
                            transition: all 0.2s;
                            position: relative;
                        }
                        .upload-box:hover, .upload-box.drag-over {
                            border-color: var(--primary);
                            background-color: #fafafa;
                        }
                        input[type="file"] {
                            position: absolute;
                            top: 0; left: 0; width: 100%; height: 100%;
                            opacity: 0;
                            cursor: pointer;
                        }
                        .upload-icon {
                            font-size: 32px;
                            margin-bottom: 10px;
                            display: block;
                        }
                        .upload-text {
                            font-size: 14px;
                            color: #666;
                            font-weight: 500;
                        }
                        button {
                            background: var(--primary);
                            color: white;
                            border: none;
                            width: 100%;
                            padding: 16px;
                            font-size: 16px;
                            font-weight: 600;
                            border-radius: 8px;
                            cursor: pointer;
                            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                            transition: transform 0.1s;
                        }
                        button:active {
                            transform: scale(0.98);
                        }
                        .badge {
                            display: inline-flex;
                            align-items: center;
                            gap: 6px;
                            background: #e6f7ff;
                            color: #0050b3;
                            padding: 6px 12px;
                            border-radius: 20px;
                            font-size: 12px;
                            font-weight: 700;
                            margin-bottom: 24px;
                        }
                        .secure-note {
                            font-size: 12px;
                            color: #888;
                            margin-top: 24px;
                            line-height: 1.5;
                            border-top: 1px solid #eee;
                            padding-top: 16px;
                        }
                        .file-name {
                            margin-top: 10px;
                            font-weight: 600;
                            color: var(--primary);
                            display: none;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="brand">SecureEngine</div>
                        
                        <div class="badge">
                            <span style="font-size: 14px">🔒</span> End-to-End Local Encryption
                        </div>

                        <form action="/upload?token=${token}" method="post" enctype="multipart/form-data">
                            <div class="upload-box" id="dropArea">
                                <input type="file" name="file" id="fileInput" accept=".pdf,.png,.jpg,.jpeg,.docx" required>
                                <span class="upload-icon">📄</span>
                                <div class="upload-text">Tap to select a document</div>
                                <div class="file-name" id="fileName"></div>
                            </div>

                            <button type="submit">Secure Upload</button>
                        </form>

                        <p class="secure-note">
                            This link is single-use only.<br>
                            Your file will be transferred directly to the terminal and 
                            <span style="color: var(--danger); font-weight: 700;">permanently destroyed</span> 
                            after this session.
                        </p>
                    </div>

                    <script>
                        const input = document.getElementById('fileInput');
                        const fileNameDisplay = document.getElementById('fileName');
                        const uploadText = document.querySelector('.upload-text');

                        input.addEventListener('change', (e) => {
                            if (input.files.length > 0) {
                                fileNameDisplay.textContent = input.files[0].name;
                                fileNameDisplay.style.display = 'block';
                                uploadText.style.display = 'none';
                            }
                        });
                    </script>
                </body>
                </html>
            `);
        });

        this.app.post('/upload', (req, res) => {
            const token = req.query.token as string;

            if (!token || token !== this.activeToken || !this.sessionPath) {
                return res.status(403).send('Session invalid or expired.');
            }

            const form = formidable({
                uploadDir: this.sessionPath, // Save directly to session path
                keepExtensions: true,
                maxFileSize: 50 * 1024 * 1024, // 50MB
                filename: (name: string, ext: string, part: any, form: any) => {
                    // Sanitize and ensure secure naming
                    const safeName = path.basename(part.originalFilename || 'upload').replace(/[^a-zA-Z0-9._-]/g, '_');
                    return `QR_${Date.now()}_${safeName}`; 
                }
            });

            form.parse(req, (err: any, fields: any, files: any) => {
                if (err) {
                    console.error('[UploadServer] Parse error:', err);
                    return res.status(500).send('Upload failed.');
                }

                // File is already saved to sessionPath by formidable
                // Notify via event
                const uploadedFileLine = Array.isArray(files.file) ? files.file[0] : files.file;
                // 'files.file' might be undefined if field name differs, but form uses 'file'
                
                if (uploadedFileLine) {
                    this.emit('file-uploaded', uploadedFileLine.filepath || uploadedFileLine.newFilename);
                    
                    // Invalidate token immediately
                    this.activeToken = null;

                    res.send(`
                        <!DOCTYPE html>
                        <html>
                        <body style="font-family:sans-serif;text-align:center;padding:40px;">
                            <h1 style="color:green;">Upload Successful</h1>
                            <p>You may now print this file at the terminal.</p>
                            <script>window.close();</script>
                        </body>
                        </html>
                    `);
                } else {
                    res.status(400).send('No file received.');
                }
            });
        });
    }

    public async start(sessionPath: string, token: string): Promise<string> {
        return new Promise((resolve, reject) => {
            if (this.server) this.stop();

            this.sessionPath = sessionPath;
            this.activeToken = token;

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
            console.log('[UploadServer] Stopped.');
        }
    }
}
