import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  // WhatsApp
  init: () => ipcRenderer.invoke('whatsapp:init'),
  initWhatsApp: () => ipcRenderer.invoke('whatsapp:init'), // Alias fallback
  getStatus: () => ipcRenderer.invoke('whatsapp:status'),
  getWhatsAppStatus: () => ipcRenderer.invoke('whatsapp:status'), // Alias fallback
  onWhatsAppEvent: (callback: (data: any) => void) => {
    const listener = (_event: any, data: any) => callback(data)
    ipcRenderer.on('whatsapp:event', listener)
    return () => ipcRenderer.removeListener('whatsapp:event', listener)
  },
  sendMessage: (data: { phone: string; message: string }) => ipcRenderer.invoke('whatsapp:send', data),
  isRegistered: (phone: string) => ipcRenderer.invoke('whatsapp:is-registered', phone),

  // Database
  getContacts: () => ipcRenderer.invoke('db:get-contacts'),
  addContacts: (contacts: any[]) => ipcRenderer.invoke('db:add-contacts', contacts),
  clearContacts: () => ipcRenderer.invoke('db:clear-contacts'),
  getLogs: (campaignId?: number) => ipcRenderer.invoke('db:get-logs', campaignId),
  clearLogs: () => ipcRenderer.invoke('db:clear-logs'),
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
