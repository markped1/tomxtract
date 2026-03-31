import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  generateKey: (machineId: string) => ipcRenderer.invoke('generate-key', machineId),
  getMachineId: () => ipcRenderer.invoke('get-machine-id'),
  syncKeys: (options: { count: number, isDemo: boolean, durationDays: number }) => ipcRenderer.invoke('sync-keys', options),
  listKeys: () => ipcRenderer.invoke('list-keys'),
  revokeKey: (key: string) => ipcRenderer.invoke('revoke-key', key),
  restoreKey: (key: string) => ipcRenderer.invoke('restore-key', key),
  deleteKey: (key: string) => ipcRenderer.invoke('delete-key', key),
});
