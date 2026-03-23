export interface IElectronAPI {
  generateKey: (machineId: string) => Promise<string>;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
