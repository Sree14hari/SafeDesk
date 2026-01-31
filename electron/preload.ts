import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  startSession: () => ipcRenderer.send('session:start'),
  onSessionStatus: (callback: (event: any, value: string) => void) => 
    ipcRenderer.on('session:status', callback),
});
