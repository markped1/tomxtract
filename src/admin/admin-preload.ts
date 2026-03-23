import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  generateKey: (machineId: string) => ipcRenderer.invoke('generate-key', machineId),
  getMachineId: () => ipcRenderer.invoke('get-machine-id'),
  syncKeys: (keys: string[]) => ipcRenderer.invoke('sync-keys', keys),
});
