import { ipcMain, dialog, BrowserWindow } from 'electron';
import * as fs from 'fs';
import { ExtractionEngine } from '../crawler/engine';
import * as db from '../db/database';
import { exportToCSV, exportToTXT, exportToXLSX } from '../export/exporter';
import { checkTrialStatus, getTrialInfo } from '../license/trial';
import { generateMachineId } from '../license/fingerprint';
import { activateLicense } from '../license/activation';
import { verifyEmail } from '../email/verifier';
import { emailMailer } from '../email/mailer';
import { fetchFreeProxies } from '../crawler/proxyFetcher';

const engine = new ExtractionEngine();

export function registerIpcHandlers() {
  // Extraction
  ipcMain.handle('start-extraction', async (_event, config) => {
    const finalConfig = { ...config };
    if (config.proxyMode === 'rotating') {
      finalConfig.proxies = db.getWorkingProxies();
    }
    const win = BrowserWindow.getAllWindows()[0];
    engine.removeAllListeners('event');
    engine.on('event', (data) => {
      if (win && !win.isDestroyed()) {
        win.webContents.send('extraction-event', data);
      }
    });
    engine.start(finalConfig);
  });

  ipcMain.handle('pause-extraction', async () => { engine.pause(); });
  ipcMain.handle('stop-extraction', async () => { 
    engine.stop(); 
    db.forceSave();
  });

  // Stats
  ipcMain.handle('get-stats', async () => {
    const stats = db.getStats();
    stats.activeJobs = engine.isRunning() ? 1 : 0;
    stats.isMailerRunning = emailMailer.isRunning();
    return stats;
  });

  ipcMain.handle('get-emails', async (_event, filters) => db.getEmails(filters));
  ipcMain.handle('get-email-count', async (_event, filters) => db.getEmailCount(filters));
  ipcMain.handle('get-domains', async () => db.getDomains());
  ipcMain.handle('get-logs', async () => db.getLogs());

  // Export
  ipcMain.handle('export-data', async (_event, format, options) => {
    const win = BrowserWindow.getAllWindows()[0];
    const saveResult = await dialog.showSaveDialog(win, {
      defaultPath: `extracted_emails.${format}`,
      filters: [
        { name: format.toUpperCase(), extensions: [format] },
      ],
    });
    if (saveResult.canceled || !saveResult.filePath) return null;
    const emails = db.getAllEmailsForExport(options?.filterStatus);
    switch (format) {
      case 'csv': await exportToCSV(emails, saveResult.filePath, options); break;
      case 'txt': await exportToTXT(emails, saveResult.filePath, options); break;
      case 'xlsx': await exportToXLSX(emails, saveResult.filePath, options); break;
    }
    return saveResult.filePath;
  });

  // Email verification
  ipcMain.handle('verify-emails', async (_event, emails: string[]) => {
    return Promise.all(emails.map(async (email) => {
      const res = await verifyEmail(email);
      db.updateEmailStatus(email, res.status, res.reason);
      return res;
    }));
  });

  // Proxy
  ipcMain.handle('get-proxies', async () => db.getProxies());
  ipcMain.handle('add-proxy', async (_event, address) => db.addProxy(address));
  ipcMain.handle('delete-proxy', async (_event, id) => db.deleteProxy(id));
  ipcMain.handle('update-proxy-status', async (_event, { address, working, latency }) => 
    db.updateProxyStatus(address, working, latency));
  ipcMain.handle('get-working-proxies', async () => db.getWorkingProxies());
  ipcMain.handle('fetch-free-proxies', async () => fetchFreeProxies());
  
  ipcMain.handle('proxy-test', async (_event, proxy) => {
    const start = Date.now();
    try {
      // Simple connectivity test
      const { default: https } = await import('https');
      await new Promise<void>((resolve, reject) => {
        const req = https.get('https://httpbin.org/ip', { timeout: 5000 }, (res) => {
          res.on('data', () => {});
          res.on('end', resolve);
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
      });
      return { proxy, working: true, latency: Date.now() - start };
    } catch {
      return { proxy, working: false, latency: Date.now() - start };
    }
  });

  // License
  ipcMain.handle('check-license', async () => {
    const trial = getTrialInfo();
    const machineId = await generateMachineId();
    return { ...trial, machineId };
  });

  ipcMain.handle('activate-license', async (_event, key) => activateLicense(key));
  ipcMain.handle('get-machine-id', async () => generateMachineId());

  // Interactive Browser
  ipcMain.handle('add-manual-emails', async (_event, { emails, sourcePage, domain }) => {
    let foundCount = 0;
    for (const email of emails) {
      if (db.addEmail(email, domain, sourcePage)) {
        foundCount++;
      }
    }
    return foundCount;
  });

  // Data management
  ipcMain.handle('clear-emails', async () => db.clearEmails());
  ipcMain.handle('clear-logs', async () => db.clearLogs());
  ipcMain.handle('reset-database', async () => db.resetDatabase());
  ipcMain.handle('delete-email', async (_event, id) => db.deleteEmail(id));
  ipcMain.handle('delete-emails-by-status', async (_event, status) => db.deleteEmailsByStatus(status));

  // File dialog
  ipcMain.handle('open-file-dialog', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'Text Files', extensions: ['txt', 'csv'] }] });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('save-file-dialog', async (_event, defaultName) => {
    const result = await dialog.showSaveDialog({ defaultPath: defaultName });
    return result.canceled ? null : result.filePath;
  });

  ipcMain.handle('import-emails-from-file', async () => {
    const win = BrowserWindow.getAllWindows()[0];
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: [{ name: 'Email Lists', extensions: ['txt', 'csv'] }]
    });
    if (canceled || filePaths.length === 0) return 0;
    
    const filePath = filePaths[0];
    const content = fs.readFileSync(filePath, 'utf-8');
    let emails: string[] = [];

    if (filePath.endsWith('.csv')) {
      const { parse } = await import('fast-csv');
      const rows: any[] = [];
      await new Promise<void>((resolve, reject) => {
        fs.createReadStream(filePath)
          .pipe(parse({ headers: true, ignoreEmpty: true }))
          .on('data', (row) => rows.push(row))
          .on('error', reject)
          .on('end', resolve);
      });
      
      // Look for common email column names
      const emailKeys = ['email', 'address', 'mail', 'e-mail'];
      emails = rows.map(row => {
        const key = Object.keys(row).find(k => emailKeys.includes(k.toLowerCase()));
        return key ? row[key] : Object.values(row)[0];
      }).filter(e => typeof e === 'string' && e.includes('@'));
    } else {
      // TXT parsing
      emails = content.split(/\r?\n/).map(line => line.trim()).filter(line => line.includes('@'));
    }

    let addedCount = 0;
    for (const email of emails) {
      const domain = email.split('@')[1] || 'imported';
      if (db.addEmail(email, domain, 'imported-file')) {
        addedCount++;
      }
    }
    return addedCount;
  });

  // Mailer
  ipcMain.handle('get-smtps', async () => db.getSmtps());
  ipcMain.handle('add-smtp', async (_event, smtp) => db.addSmtp(smtp));
  ipcMain.handle('delete-smtp', async (_event, id) => db.deleteSmtp(id));
  ipcMain.handle('clear-smtps', async () => db.clearSmtps());
  ipcMain.handle('clear-mailing-logs', async () => db.clearMailingLogs());
  ipcMain.handle('test-smtp', async (_event, smtp) => emailMailer.testSmtp(smtp));
  ipcMain.handle('get-mailing-logs', async () => db.getMailingLogs());
  ipcMain.handle('get-mailing-settings', async () => db.getMailingSettings());
  ipcMain.handle('save-mailing-setting', async (_event, { key, value }) => db.saveMailingSetting(key, value));
  
  ipcMain.handle('start-mailing', async (_event, config) => {
    const win = BrowserWindow.getAllWindows()[0];
    emailMailer.removeAllListeners('event');
    emailMailer.on('event', (data) => {
      if (win && !win.isDestroyed()) {
        win.webContents.send('mailing-event', data);
      }
    });
    return emailMailer.start(config);
  });
  
  ipcMain.handle('stop-mailing', async () => emailMailer.stop());
}
