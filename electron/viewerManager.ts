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
            
            // CRITICAL: Disable Context Menu (Right Click)
            viewerWindow.webContents.on('context-menu', (e) => {
                e.preventDefault();
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
