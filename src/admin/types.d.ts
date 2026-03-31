export interface IElectronAPI {
  generateKey: (machineId: string) => Promise<string>;
  getMachineId: () => Promise<string>;
  syncKeys: (count: number) => Promise<{ success: boolean; keys?: string[]; message?: string }>;
  listKeys: () => Promise<{ success: boolean; data: any[]; message?: string }>;
  revokeKey: (key: string) => Promise<{ success: boolean; message?: string }>;
  restoreKey: (key: string) => Promise<{ success: boolean; message?: string }>;
  deleteKey: (key: string) => Promise<{ success: boolean; message?: string }>;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
