import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  startSession: () => ipcRenderer.send('session:start'),
  endSession: () => ipcRenderer.send('session:end'),
  triggerFileImport: () => ipcRenderer.send('files:trigger-import'),
  
  printFile: (fileName: string) => ipcRenderer.send('files:print', fileName),
  previewFile: (fileName: string) => ipcRenderer.send('files:preview', fileName),
  triggerScan: () => ipcRenderer.send('files:scan'),
  
  // Phase 5: Residue Guard
  scanResidue: () => ipcRenderer.invoke('residue:scan'),
  cleanResidue: (files: any[]) => ipcRenderer.invoke('residue:clean', files),
  
  onSessionStatus: (callback: (event: any, value: string) => void) => 
    ipcRenderer.on('session:status', callback),
    
  onSessionCreated: (callback: (event: any, sessionId: string) => void) =>
    ipcRenderer.on('session:created', callback),

  onSessionEnded: (callback: (event: any, reason: string, failures: string[]) => void) =>
    ipcRenderer.on('session:ended', callback),

  onFilesUpdated: (callback: (event: any, files: Array<{name: string, size: number}>) => void) =>
    ipcRenderer.on('files:updated', callback),
    
  onSessionInfoUpdated: (callback: (event: any, info: any) => void) =>
    ipcRenderer.on('session:info-updated', callback),
});
