import { BrowserWindow } from 'electron';

export class ViewerManager {
    private activeWindows: Map<number, BrowserWindow> = new Map();

    /**
     * Opens a file in a secure, read-only preview window.
     * 
     * @param filePath Absolute path to the file.
     * @param parentWindow The main application window.
     */
    public async previewFile(filePath: string, parentWindow: BrowserWindow): Promise<void> {
        return new Promise((resolve, reject) => {
            console.log(`[ViewerManager] Opening preview for: ${filePath}`);

            let viewerWindow: BrowserWindow | null = new BrowserWindow({
                parent: parentWindow,
                modal: true, 
                show: false,
                width: 1000,
                height: 800,
                center: true,
                title: 'Secure Preview (Read-Only)',
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: false, 
                    sandbox: false,
                    plugins: true 
                }
            });

            // CRITICAL: Disable the native menu bar to prevent "Save As"
            viewerWindow.setMenu(null);
            
            // Security Hardening: Block Downloads & New Windows
            viewerWindow.webContents.session.on('will-download', (event) => {
                event.preventDefault();
                console.warn('[ViewerManager] Blocked download attempt in secure viewer');
            });
            
            viewerWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

             // Inject strict security policy script
            const securityScript = `
                document.addEventListener('contextmenu', event => event.preventDefault());
                document.addEventListener('keydown', event => {
                    if ((event.ctrlKey || event.metaKey) && (event.key === 's' || event.key === 'p' || event.key === 'c')) {
                        event.preventDefault();
                        console.log('Blocked secure action key');
                    }
                });
                document.addEventListener('dragstart', event => event.preventDefault());
                document.addEventListener('drop', event => event.preventDefault());
                
                // Hide any PDF toolbar controls if possible (CSS override)
                const style = document.createElement('style');
                style.innerHTML = '#toolbar { display: none !important; }'; // Common PDFjs toolbar ID
                document.head.appendChild(style);
            `;
            
            viewerWindow.webContents.on('dom-ready', () => {
                 viewerWindow?.webContents.executeJavaScript(securityScript).catch(() => {});
            });

            const windowId = viewerWindow.id;
            this.activeWindows.set(windowId, viewerWindow);

            const cleanup = () => {
                if (viewerWindow) {
                    if (!viewerWindow.isDestroyed()) {
                        viewerWindow.close();
                    }
                    viewerWindow = null;
                    this.activeWindows.delete(windowId);
                }
            };

            viewerWindow.on('closed', () => {
                cleanup();
                resolve(); // Resolves when user closes the window
            });

            viewerWindow.loadURL(`file://${filePath}`).catch(err => {
                console.error(`[ViewerManager] Failed to load file ${filePath}:`, err);
                cleanup();
                reject(err);
            });

            viewerWindow.webContents.on('did-finish-load', () => {
                if (viewerWindow) {
                    console.log(`[ViewerManager] Preview loaded. Showing window.`);
                    viewerWindow.show();
                    viewerWindow.focus();
                }
            });
        });
    }

    /**
     * Force close all viewer windows.
     */
    public closeAll() {
        console.log(`[ViewerManager] Force closing ${this.activeWindows.size} viewer windows.`);
        Array.from(this.activeWindows.values()).forEach(win => {
            if (!win.isDestroyed()) win.close();
        });
        this.activeWindows.clear();
    }
}
