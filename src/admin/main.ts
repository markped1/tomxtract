import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as crypto from 'crypto';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 600,
    height: 500,
    resizable: false,
    frame: true, // Keygen usually doesn't need a custom frame, but we can make it false if we want
    backgroundColor: '#0b0f19',
    webPreferences: {
      preload: path.join(__dirname, 'admin-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, '../../resources/icon.ico'),
  });

  mainWindow.setMenu(null);

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5174');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../admin/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

const LICENSE_SECRET = 'TX49JA-LICENSE-SECRET';

ipcMain.handle('generate-key', async (event, machineId: string) => {
  try {
    const machineHash = crypto.createHmac('sha256', LICENSE_SECRET)
      .update(machineId)
      .digest('hex')
      .substring(0, 16)
      .toUpperCase();

    const key = `${machineHash.substring(0, 4)}-${machineHash.substring(4, 8)}-${machineHash.substring(8, 12)}-${machineHash.substring(12, 16)}`;
    return key;
  } catch (err) {
    console.error('Key generation error:', err);
    return 'ERROR';
  }
});

app.whenReady().then(() => {
  createWindow();
});

app.on('window-all-closed', () => {
  app.quit();
});
