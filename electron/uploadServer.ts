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

            // Minimal HTML
            res.send(`
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Secure Upload</title>
                    <style>
                        body { font-family: sans-serif; padding: 20px; text-align: center; }
                        .container { max-width: 400px; margin: 0 auto; border: 2px solid #000; padding: 20px; border-radius: 12px; }
                        h1 { font-size: 20px; margin-bottom: 20px; }
                        input[type="file"] { margin-bottom: 20px; width: 100%; }
                        button { background: #000; color: #fff; border: none; padding: 12px 24px; font-size: 16px; border-radius: 6px; cursor: pointer; width: 100%; }
                        .info { font-size: 12px; color: #666; margin-top: 20px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>SecureEngine Intake</h1>
                        <form action="/upload?token=${token}" method="post" enctype="multipart/form-data">
                            <input type="file" name="file" accept=".pdf,.png,.jpg,.jpeg,.docx" required>
                            <button type="submit">Secure Upload</button>
                        </form>
                        <p class="info">Files are securely destroyed immediately after printing.<br>This link expires after use.</p>
                    </div>
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
