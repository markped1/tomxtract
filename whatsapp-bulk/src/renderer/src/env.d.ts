/// <reference types="vite/client" />

interface Window {
  electron: {
    ipcRenderer: any
  }
  api: {
    initWhatsApp: () => Promise<void>
    getWhatsAppStatus: () => Promise<any>
    onWhatsAppEvent: (callback: (data: any) => void) => () => void
    sendMessage: (data: { phone: string, message: string }) => Promise<any>
    isRegistered: (phone: string) => Promise<boolean>
    getContacts: () => Promise<any[]>
    addContacts: (contacts: any[]) => Promise<void>
    clearContacts: () => Promise<void>
    getLogs: (campaignId?: number) => Promise<any[]>
    clearLogs: () => Promise<void>
  }
}
