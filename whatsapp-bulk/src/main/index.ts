import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

import { whatsappClient } from './whatsapp/client'
import * as db from './db/database'

let mainWindow: BrowserWindow | null = null

const isLock = app.requestSingleInstanceLock()

if (!isLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
  })

  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  // Some APIs can only be used after this event occurs.
  app.whenReady().then(async () => {
    // Set app user model id for windows
    electronApp.setAppUserModelId('com.electron')

    // Initialize DB
    try {
      await db.initDatabase()
      console.log('Database initialized successfully')
    } catch (e: any) {
      console.error('CRITICAL: Database initialization failed:', e.message)
      // We still want the app to open so user can see what's wrong? 
      // Or show an error dialog. For now, log it.
    }

    // Default open or close DevTools by F12 in development
    // and ignore CommandOrControl + R in production.
    // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    // WhatsApp IPC Handlers
    ipcMain.handle('whatsapp:init', () => whatsappClient.initialize())
    ipcMain.handle('whatsapp:status', () => whatsappClient.getStatus())
    ipcMain.handle('whatsapp:send', (_event, { phone, message }) => whatsappClient.sendMessage(phone, message))
    ipcMain.handle('whatsapp:is-registered', (_event, phone) => whatsappClient.isRegistered(phone))

    // Database IPC Handlers
    ipcMain.handle('db:get-contacts', () => db.getContacts())
    ipcMain.handle('db:add-contacts', (_event, contacts) => db.addContacts(contacts))
    ipcMain.handle('db:clear-contacts', () => db.clearContacts())
    ipcMain.handle('db:get-logs', (_event, campaignId) => db.getLogs(campaignId))
    ipcMain.handle('db:clear-logs', () => db.clearLogs())

    mainWindow = createWindow()

    // Forward WhatsApp events to renderer
    whatsappClient.on('qr', (qr) => mainWindow?.webContents.send('whatsapp:event', { type: 'qr', data: qr }))
    whatsappClient.on('authenticated', () => mainWindow?.webContents.send('whatsapp:event', { type: 'authenticated' }))
    whatsappClient.on('ready', () => mainWindow?.webContents.send('whatsapp:event', { type: 'ready' }))
    whatsappClient.on('disconnected', (reason) => mainWindow?.webContents.send('whatsapp:event', { type: 'disconnected', data: reason }))
    whatsappClient.on('error', (err) => mainWindow?.webContents.send('whatsapp:event', { type: 'error', data: err }))

    app.on('activate', function () {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createWindow()
      } else {
        mainWindow?.show()
        mainWindow?.focus()
      }
    })
  })
}

function createWindow(): BrowserWindow {
  // Create the browser window.
  const window = new BrowserWindow({
    width: 450,
    height: 780,
    minWidth: 400,
    maxWidth: 550,
    title: 'TomWhatsBulk Sender',
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  window.on('ready-to-show', () => {
    window.show()
  })

  window.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    window.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'))
  }
  
  window.setTitle('TomWhatsBulk Sender')

  return window
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
