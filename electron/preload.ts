import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  startSession: () => ipcRenderer.send('session:start'),
  triggerFileImport: () => ipcRenderer.send('files:trigger-import'),
  
  onSessionStatus: (callback: (event: any, value: string) => void) => 
    ipcRenderer.on('session:status', callback),
    
  onSessionCreated: (callback: (event: any, sessionId: string) => void) =>
    ipcRenderer.on('session:created', callback),

  onFilesUpdated: (callback: (event: any, files: Array<{name: string, size: number}>) => void) =>
    ipcRenderer.on('files:updated', callback),
    
  onSessionInfoUpdated: (callback: (event: any, info: any) => void) =>
    ipcRenderer.on('session:info-updated', callback),
});
