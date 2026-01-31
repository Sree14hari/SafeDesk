import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  startSession: () => ipcRenderer.send('session:start'),
  endSession: () => ipcRenderer.send('session:end'),
  triggerFileImport: () => ipcRenderer.send('files:trigger-import'),
  
  printFile: (fileName: string) => ipcRenderer.send('files:print', fileName),
  previewFile: (fileName: string) => ipcRenderer.send('files:preview', fileName),
  deleteFile: (fileName: string) => ipcRenderer.invoke('files:delete', fileName),
  triggerScan: () => ipcRenderer.send('files:scan'),
  
  // Phase 5: Residue Guard
  scanResidue: (options?: any) => ipcRenderer.invoke('residue:scan', options),
  cleanResidue: (files: any[]) => ipcRenderer.invoke('residue:clean', files),
  
  // Phase 6: Ephemeral Task Zone
  startTaskSession: () => ipcRenderer.send('task:start'),
  launchTaskBrowser: () => ipcRenderer.send('task:launch-browser'),
  
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
