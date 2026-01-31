import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import { SessionManager } from './sessionManager';

let mainWindow: BrowserWindow | null = null;
const sessionManager = new SessionManager();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
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

app.whenReady().then(() => {
  createWindow();

  // IPC: Start Session
  ipcMain.on('session:start', async (event) => {
    try {
      const sessionId = await sessionManager.startSession();
      console.log(`Main Process: Session ${sessionId} started`);
      event.sender.send('session:created', sessionId);
      event.sender.send('session:status', `Active Session: ${sessionId}`);
    } catch (err) {
      console.error('Error starting session:', err);
      event.sender.send('session:status', 'Error starting session');
    }
  });

  // IPC: Open File Dialog & Import
  ipcMain.on('files:trigger-import', async (event) => {
    if (!mainWindow) return;

    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Files for Secure Session',
      properties: ['openFile', 'multiSelections']
    });

    if (!result.canceled && result.filePaths.length > 0) {
      try {
        console.log('Importing files:', result.filePaths);
        const importedFiles = await sessionManager.importFiles(result.filePaths);
        // Send back safe metadata
        event.sender.send('files:updated', importedFiles);
      } catch (error: any) {
        console.error('Import Error:', error);
         // error can be unknown type
         const msg = error instanceof Error ? error.message : String(error);
        event.sender.send('session:status', `Import failed: ${msg}`);
      }
    }
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
