import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as crypto from 'crypto';
import { generateMachineId } from '../main/license/fingerprint';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set } from 'firebase/database';
import { firebaseConfig } from '../main/license/firebase-config';

// Initialize Firebase (only if config is valid)
const isFirebaseConfigured = firebaseConfig.apiKey !== "YOUR_API_KEY";
let db: any = null;
if (isFirebaseConfigured) {
  try {
    const firebaseApp = initializeApp(firebaseConfig);
    db = getDatabase(firebaseApp, firebaseConfig.databaseURL);
    console.log('Firebase initialized with URL:', firebaseConfig.databaseURL);
  } catch (err) {
    console.error('Firebase initialization failed:', err);
  }
}

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
    mainWindow.loadFile(path.join(__dirname, '../index.html'));
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

ipcMain.handle('get-machine-id', async () => {
  return await generateMachineId();
});

ipcMain.handle('sync-keys', async (event, keys: string[]) => {
  if (!isFirebaseConfigured || !db) return { success: false, message: 'Firebase not configured' };
  
  try {
    // Add a simple timeout promise
    const timeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Connection timeout. Please check your databaseURL.')), 10000)
    );

    const syncTask = (async () => {
      if (!db) throw new Error('Database instance is null');
      
      for (const key of keys) {
        console.log(`Syncing key: ${key}`);
        await set(ref(db, `licenses/${key}`), {
          status: 'available',
          machineId: '',
          createdAt: new Date().toISOString()
        });
      }
      return { success: true };
    })();

    return await Promise.race([syncTask, timeout]) as { success: boolean, message?: string };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
});

app.whenReady().then(() => {
  createWindow();
});

app.on('window-all-closed', () => {
  app.quit();
});
