import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';

let db: Database;
const dbPath = path.join(app.getPath('userData'), 'whatsapp_bulk.sqlite');

export async function initDatabase() {
  console.log('[DB] Initializing database...');
  
  const wasmPath = app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm')
    : path.resolve(__dirname, '../../node_modules/sql.js/dist/sql-wasm.wasm');

  console.log('[DB] Looking for WASM at:', wasmPath);
  
  if (!fs.existsSync(wasmPath)) {
    console.warn('[DB] WASM not found at primary path, trying secondary...');
    // Fallback for some dev environments
    const fallbackPath = path.resolve(process.cwd(), 'node_modules/sql.js/dist/sql-wasm.wasm');
    if (fs.existsSync(fallbackPath)) {
       console.log('[DB] Found WASM at fallback:', fallbackPath);
       // Use it? But wait, initSqlJs locateFile will use this.
    } else {
       console.error('[DB] CRITICAL: sql-wasm.wasm not found anywhere!');
    }
  }

  try {
    const SQL = await initSqlJs({
      locateFile: (file: string) => {
        if (file === 'sql-wasm.wasm') return wasmPath;
        return file;
      }
    });
    
    console.log('[DB] SQL.js initialized. Path:', dbPath);
    
    if (fs.existsSync(dbPath)) {
      const fileBuffer = fs.readFileSync(dbPath);
      db = new SQL.Database(fileBuffer);
      console.log('[DB] Existing database loaded.');
    } else {
      db = new SQL.Database();
      createTables();
      saveDatabase();
      console.log('[DB] New database created.');
    }
  } catch (err: any) {
    console.error('[DB] Initialization failed:', err.message);
    throw err;
  }
}

function createTables() {
  // Contacts table
  db.run(`
    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT UNIQUE,
      name TEXT,
      status TEXT DEFAULT 'pending', -- pending, active, invalid
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Campaigns table
  db.run(`
    CREATE TABLE IF NOT EXISTS campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      message TEXT,
      total_contacts INTEGER,
      sent_count INTEGER DEFAULT 0,
      status TEXT DEFAULT 'draft', -- draft, running, paused, completed
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Logs table
  db.run(`
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER,
      phone TEXT,
      status TEXT, -- sent, failed, rejected
      error TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(campaign_id) REFERENCES campaigns(id)
    )
  `);
}

export function saveDatabase() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

// Database operations
export function addContacts(contacts: { phone: string, name?: string }[]) {
  const stmt = db.prepare('INSERT OR IGNORE INTO contacts (phone, name) VALUES (?, ?)');
  for (const contact of contacts) {
    stmt.run([contact.phone, contact.name || null]);
  }
  stmt.free();
  saveDatabase();
}

export function getContacts() {
  const res = db.exec('SELECT * FROM contacts ORDER BY added_at DESC');
  if (res.length === 0) return [];
  const columns = res[0].columns;
  return res[0].values.map(row => {
    const obj = {};
    columns.forEach((col, i) => obj[col] = row[i]);
    return obj;
  });
}

export function updateContactStatus(phone: string, status: string) {
  db.run('UPDATE contacts SET status = ? WHERE phone = ?', [status, phone]);
  saveDatabase();
}

export function clearContacts() {
  db.run('DELETE FROM contacts');
  saveDatabase();
}

export function addLog(campaignId: number, phone: string, status: string, error?: string) {
  db.run('INSERT INTO logs (campaign_id, phone, status, error) VALUES (?, ?, ?, ?)', 
    [campaignId, phone, status, error || null]);
  saveDatabase();
}

export function getLogs(campaignId?: number) {
  let sql = 'SELECT * FROM logs';
  const params: any[] = [];
  if (campaignId) {
    sql += ' WHERE campaign_id = ?';
    params.push(campaignId);
  }
  sql += ' ORDER BY timestamp DESC LIMIT 500';
  
  const res = db.exec(sql, params);
  if (res.length === 0) return [];
  const columns = res[0].columns;
  return res[0].values.map(row => {
    const obj = {};
    columns.forEach((col, i) => obj[col] = row[i]);
    return obj;
  });
}

export function clearLogs() {
  db.run('DELETE FROM logs');
  saveDatabase();
}
