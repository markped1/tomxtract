import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as crypto from 'crypto';
import { generateMachineId } from '../main/license/fingerprint';
import { createClient } from '@supabase/supabase-js';
import { supabaseConfig } from '../main/license/supabase-config';

const isSupabaseConfigured =
  supabaseConfig.url !== 'https://YOUR_PROJECT.supabase.co' &&
  supabaseConfig.serviceKey !== 'YOUR_SERVICE_ROLE_KEY';

// Admin uses service_role key for full access (generate, revoke, list)
const supabase = isSupabaseConfigured
  ? createClient(supabaseConfig.url, supabaseConfig.serviceKey)
  : null;

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 680,
    resizable: true,
    frame: true,
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

  mainWindow.on('closed', () => { mainWindow = null; });
}

const LICENSE_SECRET = 'TX49JA-LICENSE-SECRET';

// Generate a key tied to a specific machine ID
ipcMain.handle('generate-key', async (_event, machineId: string) => {
  const machineHash = crypto
    .createHmac('sha256', LICENSE_SECRET)
    .update(machineId)
    .digest('hex')
    .substring(0, 16)
    .toUpperCase();
  return `${machineHash.substring(0, 4)}-${machineHash.substring(4, 8)}-${machineHash.substring(8, 12)}-${machineHash.substring(12, 16)}`;
});

ipcMain.handle('get-machine-id', async () => generateMachineId());

// Generate N random keys and push to Supabase
ipcMain.handle('sync-keys', async (_event, options: { count: number, isDemo: boolean, durationDays: number }) => {
  const { count = 5, isDemo = false, durationDays = 0 } = options || {};
  
  if (!isSupabaseConfigured || !supabase) {
    return { success: false, message: 'Supabase not configured. Update supabase-config.ts.' };
  }

  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const seg = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  const keys = Array.from({ length: count }, () => `${seg()}-${seg()}-${seg()}-${seg()}`);

  const rows = keys.map(key => ({
    key,
    status: 'available',
    machine_id: null,
    is_demo: isDemo,
    duration_days: durationDays,
    created_at: new Date().toISOString(),
    activated_at: null,
  }));

  const { error } = await supabase.from('licenses').insert(rows);
  if (error) return { success: false, message: error.message };

  return { success: true, keys };
});

// List all keys
ipcMain.handle('list-keys', async () => {
  if (!isSupabaseConfigured || !supabase) {
    return { success: false, message: 'Supabase not configured.', data: [] };
  }

  const { data, error } = await supabase
    .from('licenses')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return { success: false, message: error.message, data: [] };
  return { success: true, data };
});

// Revoke a key
ipcMain.handle('revoke-key', async (_event, key: string) => {
  if (!isSupabaseConfigured || !supabase) {
    return { success: false, message: 'Supabase not configured.' };
  }

  const { error } = await supabase
    .from('licenses')
    .update({ status: 'revoked', machine_id: null })
    .eq('key', key);

  if (error) return { success: false, message: error.message };
  return { success: true };
});

// Re-activate / restore a revoked key
ipcMain.handle('restore-key', async (_event, key: string) => {
  if (!isSupabaseConfigured || !supabase) {
    return { success: false, message: 'Supabase not configured.' };
  }

  const { error } = await supabase
    .from('licenses')
    .update({ status: 'available', machine_id: null, activated_at: null })
    .eq('key', key);

  if (error) return { success: false, message: error.message };
  return { success: true };
});

// Delete a key permanently
ipcMain.handle('delete-key', async (_event, key: string) => {
  if (!isSupabaseConfigured || !supabase) {
    return { success: false, message: 'Supabase not configured.' };
  }

  const { error } = await supabase.from('licenses').delete().eq('key', key);
  if (error) return { success: false, message: error.message };
  return { success: true };
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
