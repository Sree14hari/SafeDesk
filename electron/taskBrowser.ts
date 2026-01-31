
import { BrowserWindow, session, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs-extra';

export class TaskBrowser {
    private window: BrowserWindow | null = null;
    private sessionPath: string;
    private partitionName: string;

    constructor(sessionPath: string, sessionId: string) {
        this.sessionPath = sessionPath;
        // Use an in-memory partition for true ephemerality: 'memory:sessionId'
        // However, we want to control downloads, so we might need some persistence during the session if the partition requires it for downloads? 
        // No, 'incognito' or memory partition is best.
        this.partitionName = `memory:etz_${sessionId}`; 
    }

    public async launch(homeUrl: string = 'https://google.com') {
        if (this.window) {
            this.window.show();
            return;
        }

        this.window = new BrowserWindow({
            width: 1200,
            height: 800,
            title: 'Secure Task Browser (Ephemeral)',
            icon: path.join(__dirname, '../../assets/icon.png'), // Adjust if needed
            webPreferences: {
                partition: this.partitionName, // ISOLATED STORAGE
                sandbox: true,
                contextIsolation: true,
                nodeIntegration: false,
                plugins: false, // Disable plugins
                backgroundThrottling: false
            }
        });

        const ses = this.window.webContents.session;

        // 1. Force Downloads to Task Folder
        ses.on('will-download', (event, item, webContents) => {
            // Prevent "Save As" dialog
            item.setSavePath(path.join(this.sessionPath, item.getFilename()));
            
            item.on('updated', (event, state) => {
                if (state === 'interrupted') {
                    console.log('Download is interrupted but can be resumed');
                } else if (state === 'progressing') {
                    if (item.isPaused()) {
                        console.log('Download is paused');
                    } else {
                        console.log(`Received bytes: ${item.getReceivedBytes()}`);
                    }
                }
            });
            
            item.once('done', (event, state) => {
                if (state === 'completed') {
                    console.log('Download successfully');
                } else {
                    console.log(`Download failed: ${state}`);
                }
            });
        });

        // 2. Clear initial cache (Just in case, though memory partition should be empty)
        await ses.clearCache();
        await ses.clearStorageData();

        // 3. Security Headers / Permissions
        ses.setPermissionRequestHandler((webContents, permission, callback) => {
            // Deny most things
            const allowed = ['media']; // Maybe allow cam/mic if needed for verification? Prompt didn't say. 
            // "Restrictions: Browser extensions, Password saving". 
            // We can't install extensions in a memory partition easily anyway.
            if (permission === 'media') {
                 callback(true);
                 return;
            }
            callback(false);
        });

        // 4. Secure File Chooser Override
        // This forces the file picker to start in the Task Zone folder relative to the session
        // This ensures users can easily select the mobile-uploaded files.
        // 4. Secure File Chooser Override (CDP Implementation)
        // We use Chrome DevTools Protocol because setFileChooserHandler is unstable/missing in some versions.
        // 4. Secure File Chooser Override (CDP Implementation)
        // We attempt CDP attachment but swallow errors to prevent blocking the window launch
        // if CDP isn't supported or fails for some reason.
        (async () => {
            try {
                // Short delay to ensure WebContents is stable?
                // await new Promise(r => setTimeout(r, 100));
                
                const dbg = this.window!.webContents.debugger;
                if (!dbg.isAttached()) {
                    try {
                        dbg.attach('1.3');
                    } catch (err: any) {
                         console.warn('[TaskBrowser] Failed to attach debugger immediately:', err.message);
                         return; // Continue without interception
                    }
                }
                
                await dbg.sendCommand('Page.enable');
                await dbg.sendCommand('Page.setInterceptFileChooserDialog', { enabled: true });
                
                dbg.on('message', async (event, method, params) => {
                    if (method === 'Page.fileChooserOpened') {
                         await this.handleFileChooser(dbg, params);
                    }
                });
                
                console.log('[TaskBrowser] CDP File Chooser Interception Enabled.');
            } catch (e) {
                 console.error('[TaskBrowser] CDP setup failed (Non-fatal):', e);
            }
        })();

        this.window.loadURL(homeUrl);

        this.window.on('closed', () => {
            this.window = null;
        });

        // Block new windows (popups) - force them into the same window or a new tab concept? 
        // Electron defaults to new windows. For security, we might want to allow them but ensure they share the partition.
        this.window.webContents.setWindowOpenHandler(({ url }) => {
            return { action: 'allow' }; // Inherits partition
        });
    }

    private async handleFileChooser(dbg: Electron.Debugger, params: any) {
        const { mode } = params;
        // mode: 'selectSingle', 'selectMultiple', 'save'
        
        console.log(`[TaskBrowser] CDP Intercepted File Chooser (Mode: ${mode})`);
        
        const dialogProperties: any[] = ['openFile'];
        if (mode === 'selectMultiple') dialogProperties.push('multiSelections');
        
        // Force start in session folder
        try {
            const res = await dialog.showOpenDialog(this.window!, {
                title: 'Select File from Secure Task Zone',
                defaultPath: this.sessionPath, 
                buttonLabel: 'Select Secure File',
                properties: dialogProperties
            });

            if (res.canceled || res.filePaths.length === 0) {
                try {
                    await dbg.sendCommand('Page.handleFileChooser', { action: 'cancel' });
                } catch(e) { /* ignore if replaced */ }
            } else {
                try {
                    await dbg.sendCommand('Page.handleFileChooser', { 
                        action: 'accept', 
                        files: res.filePaths 
                    });
                } catch(e) { console.error('Failed to submit files to page:', e); }
            }
        } catch (e) {
            console.error('[TaskBrowser] Failed to show open dialog:', e);
            try { await dbg.sendCommand('Page.handleFileChooser', { action: 'cancel' }); } catch (ignore) {}
        }
    }

    public close() {
        if (this.window) {
            this.window.close();
            this.window = null;
        }
    }

    public async cleanup() {
        this.close();
        
        // Even with memory partition, explicitly clearing is good practice
        const ses = session.fromPartition(this.partitionName);
        if (ses) {
            try {
                await ses.clearCache();
                await ses.clearStorageData();
                await ses.clearAuthCache();
                console.log(`[TaskBrowser] Session ${this.partitionName} data cleared.`);
            } catch (e) {
                console.error('[TaskBrowser] Failed to clear session data:', e);
            }
        }
    }
}
