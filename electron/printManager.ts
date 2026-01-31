import { BrowserWindow, BrowserWindowConstructorOptions } from 'electron';
import * as path from 'path';

export class PrintManager {
    private activeWindows: Map<number, BrowserWindow> = new Map();

    public async getSafePrinters(targetWindow: BrowserWindow): Promise<Electron.PrinterInfo[]> {
        const printers = await targetWindow.webContents.getPrintersAsync();
        return printers.filter(p => {
             const lower = p.name.toLowerCase();
             // Block virtual/PDF printers
             return !lower.includes('pdf') && 
                    !lower.includes('xps') && 
                    !lower.includes('onenote') && 
                    !lower.includes('fax') && 
                    !lower.includes('writer') &&
                    !lower.includes('virtual');
        });
    }

    /**
     * Prints a file safely by loading it into a modal window.
     * We enable plugins to support PDF viewing.
     * 
     * @param filePath Absolute path to the file.
     * @param parentWindow The main application window (for modality).
     * @param deviceName Optional name of the printer to target directly (Silent mode).
     */
    public async printFile(filePath: string, parentWindow: BrowserWindow, deviceName?: string): Promise<void> {
        return new Promise((resolve, reject) => {
            console.log(`[PrintManager] Starting print job for: ${filePath} on device: ${deviceName || 'Default (System Dialog)'}`);

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
                
                console.log(`[PrintManager] File loaded. Proceeding to print...`);
                // No show() needed if silent, but good for debugging/loading check.
                // If silent, user won't see preview, which is actually BETTER for security/speed here.
                // But PDF rendering might need visibility? Usually not for print().
                
                // Add delay for PDF Viewer initialization
                setTimeout(async () => {
                    if (!printWindow || printWindow.isDestroyed()) return;

                    console.log(`[PrintManager] Triggering print command...`);
                    
                    // SECURITY: Enforce Safe Printing
                    // 1. Resolve effective printer
                    let targetDevice = deviceName;
                    if (!targetDevice) {
                        const printers = await printWindow.webContents.getPrintersAsync();
                        const defaultPrinter = printers.find(p => p.isDefault);
                        if (defaultPrinter) targetDevice = defaultPrinter.name;
                    }
                    
                    // 2. Validate Safety
                    const lower = (targetDevice || '').toLowerCase();
                    const isUnsafe = lower.includes('pdf') || 
                                     lower.includes('xps') || 
                                     lower.includes('onenote') || 
                                     lower.includes('fax') ||
                                     lower.includes('virtual');

                    if (isUnsafe) {
                        console.error(`[PrintManager] BLOCKED: Attempt to print to unsafe/virtual device (${targetDevice}).`);
                        // We can't easily alert the renderer from here without IPC, but we cancel the job.
                         // Ideally we throw an error that propagates back? 
                         // For now, simple console log and cleanup.
                        cleanup();
                        reject(new Error(`Security Block: The selected or default printer (${targetDevice}) is virtual/unsafe. Please select a physical printer.`));
                        return;
                    }

                    console.log(`[PrintManager] Printing securely to: ${targetDevice}`);

                    printWindow.webContents.print({ 
                        silent: true, // ALWAYS TRUE: Prevents "Save as PDF" dialog loophole
                        deviceName: targetDevice,
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
