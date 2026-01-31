import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import { SessionManager } from './sessionManager';
import { ScanManager } from './scanManager';
import { ResidueScanner, ResidueFile } from './residueScanner';

let mainWindow: BrowserWindow | null = null;
const sessionManager = new SessionManager();
const scanManager = new ScanManager();
const residueScanner = new ResidueScanner();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

const sendSessionInfo = (target: any) => {
    const info = sessionManager.getSessionInfo();
    target.send('session:info-updated', info);
};

app.whenReady().then(async () => {
  await sessionManager.recoverSessions();

  createWindow();

  sessionManager.on('session-wiping', () => {
      console.log('Main Process: Wiping started, notifying UI');
      if (mainWindow) {
          mainWindow.webContents.send('session:status', 'Securely Destroying Session Data...');
      }
  });

  sessionManager.on('session-ended', (reason: string, failures: string[]) => {
      console.log(`Main Process: Sending session-ended (${reason})`);
      if (mainWindow) {
          mainWindow.webContents.send('session:ended', reason, failures);
      }
  });

  ipcMain.on('session:start', async (event) => {
    try {
      const sessionId = await sessionManager.startSession();
      console.log(`Main Process: Session ${sessionId} started`);
      event.sender.send('session:created', sessionId);
      sendSessionInfo(event.sender);
    } catch (err: any) {
      console.error('Error starting session:', err);
      event.sender.send('session:status', `Error starting session: ${err.message}`);
    }
  });

  ipcMain.on('session:end', (event) => {
      sessionManager.endSession('MANUAL');
  });

  ipcMain.on('files:print', async (event, fileName: string) => {
      try {
          const sessionPath = await sessionManager.getSessionPath();
          if (!sessionPath) throw new Error("No active session");
          
          const filePath = path.join(sessionPath, fileName);
          console.log(`[Main] Requesting print for: ${filePath}`);
          
          if (!mainWindow) throw new Error("Main window not available");
          
          await sessionManager.getPrintManager().printFile(filePath, mainWindow);
          event.sender.send('session:status', `Printed: ${fileName}`);
      } catch (err: any) {
          console.error('[Main] Print failed:', err);
          event.sender.send('session:status', `Print Error: ${err.message}`);
      }
  });

  ipcMain.on('files:preview', async (event, fileName: string) => {
      try {
          const sessionPath = await sessionManager.getSessionPath();
          if (!sessionPath) throw new Error("No active session");
          
          const filePath = path.join(sessionPath, fileName);
          console.log(`[Main] Requesting preview for: ${filePath}`);
          
          if (!mainWindow) throw new Error("Main window not available");
          
          // Secure Preview
          await sessionManager.getViewerManager().previewFile(filePath, mainWindow);
          
      } catch (err: any) {
          console.error('[Main] Preview failed:', err);
          event.sender.send('session:status', `Preview Error: ${err.message}`);
      }
  });

  ipcMain.on('files:scan', async (event) => {
      try {
          const sessionPath = await sessionManager.getSessionPath();
          if (!sessionPath) throw new Error("No active session");
          
          event.sender.send('session:status', 'Scanning document...');
          
          const scanPath = await scanManager.simulateScan(sessionPath);
          const updatedFiles = await sessionManager.registerScan(scanPath);
          
          event.sender.send('files:updated', updatedFiles);
          sendSessionInfo(event.sender);
          event.sender.send('session:status', 'Scan received successfully.');
          
      } catch (err: any) {
          console.error('[Main] Scan failed:', err);
          event.sender.send('session:status', `Scan Error: ${err.message}`);
      }
  });

  ipcMain.on('files:trigger-import', async (event) => {
    if (!mainWindow) return;

    const { id } = sessionManager.getSessionInfo();
    if (!id) {
        event.sender.send('session:status', 'Error: No active session');
        return;
    }

    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Files for Secure Session',
      properties: ['openFile', 'multiSelections']
    });

    if (!result.canceled && result.filePaths.length > 0) {
      try {
        console.log('Importing files:', result.filePaths);
        const importedFiles = await sessionManager.importFiles(result.filePaths);
        event.sender.send('files:updated', importedFiles);
        sendSessionInfo(event.sender);
      } catch (error: any) {
        console.error('Import Error:', error);
         const msg = error instanceof Error ? error.message : String(error);
        event.sender.send('session:status', `Import failed: ${msg}`);
      }
    }
  });

  // --- Residue Guard IPC ---

  ipcMain.handle('residue:scan', async () => {
      console.log('[Main] Residue Scan Requested');
      return await residueScanner.scan();
  });

  ipcMain.handle('residue:clean', async (event, files: ResidueFile[]) => {
      console.log(`[Main] Residue Cleaning Requested for ${files.length} files`);
      return await residueScanner.clean(files);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
