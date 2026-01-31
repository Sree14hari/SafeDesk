import { BrowserWindow, BrowserWindowConstructorOptions } from 'electron';
import * as path from 'path';

export class PrintManager {
    private activeWindows: Map<number, BrowserWindow> = new Map();

    /**
     * Prints a file safely by loading it into a modal window.
     * We enable plugins to support PDF viewing.
     * 
     * @param filePath Absolute path to the file.
     * @param parentWindow The main application window (for modality).
     */
    public async printFile(filePath: string, parentWindow: BrowserWindow): Promise<void> {
        return new Promise((resolve, reject) => {
            console.log(`[PrintManager] Starting print job for: ${filePath}`);

            let printWindow: BrowserWindow | null = new BrowserWindow({
                parent: parentWindow,
                modal: true, 
                show: false,
                width: 1000,
                height: 800,
                center: true, // Center the modal
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: false, // Required for some internal PDF viewer IPC
                    sandbox: false, // CRITICAL: PDF Viewer often fails in sandbox
                    plugins: true   // CRITICAL: Enable PDF plugin
                }
            });

            printWindow.setMenuBarVisibility(false);

            const windowId = printWindow.id;
            this.activeWindows.set(windowId, printWindow);

            const cleanup = () => {
                if (printWindow) {
                    if (!printWindow.isDestroyed()) {
                        printWindow.close();
                    }
                    printWindow = null;
                    this.activeWindows.delete(windowId);
                }
            };

            printWindow.on('closed', () => {
                cleanup();
                resolve();
            });

            printWindow.loadURL(`file://${filePath}`).catch(err => {
                console.error(`[PrintManager] Failed to load file ${filePath}:`, err);
                cleanup();
                reject(err);
            });

            printWindow.webContents.on('did-finish-load', () => {
                if (!printWindow) return;
                
                console.log(`[PrintManager] File loaded. Showing modal...`);
                printWindow.show();
                
                // Add delay for PDF Viewer initialization
                setTimeout(() => {
                    if (!printWindow || printWindow.isDestroyed()) return;

                    console.log(`[PrintManager] Triggering print dialog...`);
                    printWindow.webContents.print({ 
                        silent: false,
                        printBackground: true 
                    }, (success, failureReason) => {
                        if (success) {
                            console.log('[PrintManager] Print job submitted successfully.');
                        } else {
                            console.log(`[PrintManager] Print job canceled or failed: ${failureReason}`);
                        }
                        cleanup();
                        resolve();
                    });
                }, 1000); // 1-second delay
            });
        });
    }

    /**
     * Force close all print windows.
     */
    public closeAll() {
        console.log(`[PrintManager] Force closing ${this.activeWindows.size} print windows.`);
        Array.from(this.activeWindows.values()).forEach(win => {
            if (!win.isDestroyed()) win.close();
        });
        this.activeWindows.clear();
    }
}
