import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  generateKey: (machineId: string) => ipcRenderer.invoke('generate-key', machineId),
  getMachineId: () => ipcRenderer.invoke('get-machine-id'),
  syncKeys: (count: number) => ipcRenderer.invoke('sync-keys', count),
  listKeys: () => ipcRenderer.invoke('list-keys'),
  revokeKey: (key: string) => ipcRenderer.invoke('revoke-key', key),
  restoreKey: (key: string) => ipcRenderer.invoke('restore-key', key),
  deleteKey: (key: string) => ipcRenderer.invoke('delete-key', key),
});
