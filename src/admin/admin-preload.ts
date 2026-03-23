import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  generateKey: (machineId: string) => ipcRenderer.invoke('generate-key', machineId),
});
