import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const TRIAL_DIR = 'C:\\ProgramData\\TomXtractor';
const TRIAL_FILE = path.join(TRIAL_DIR, 'trial.dat');
const ENC_KEY = 'TX49JA-ENCRYPTION-KEY-2024-SECURE';
const TRIAL_HOURS = 24;

function encrypt(text: string): string {
  const key = crypto.scryptSync(ENC_KEY, 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(data: string): string {
  const key = crypto.scryptSync(ENC_KEY, 'salt', 32);
  const [ivHex, encrypted] = data.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function ensureDir() {
  if (!fs.existsSync(TRIAL_DIR)) {
    fs.mkdirSync(TRIAL_DIR, { recursive: true });
  }
}

export function checkTrialStatus(): boolean {
  const info = getTrialInfo();
  return !info.trialExpired || info.licensed;
}

export function getTrialInfo(): { licensed: boolean; trial: boolean; trialExpired: boolean; hoursRemaining: number } {
  ensureDir();

  // Check if licensed first
  const licenseFile = path.join(TRIAL_DIR, 'license.dat');
  if (fs.existsSync(licenseFile)) {
    try {
      const data = fs.readFileSync(licenseFile, 'utf-8');
      const decrypted = decrypt(data);
      const parsed = JSON.parse(decrypted);
      if (parsed.activated) {
        // Check for Demo Expiration
        if (parsed.expiresAt) {
          const expiryDate = new Date(parsed.expiresAt);
          if (Date.now() > expiryDate.getTime()) {
            return { licensed: false, trial: false, trialExpired: true, hoursRemaining: 0 };
          }
        }
        return { licensed: true, trial: false, trialExpired: false, hoursRemaining: 0 };
      }
    } catch {}
  }

  // Check trial
  if (!fs.existsSync(TRIAL_FILE)) {
    // First launch - create trial
    const timestamp = Date.now().toString();
    fs.writeFileSync(TRIAL_FILE, encrypt(timestamp), 'utf-8');
    return { licensed: false, trial: true, trialExpired: false, hoursRemaining: TRIAL_HOURS };
  }

  try {
    const data = fs.readFileSync(TRIAL_FILE, 'utf-8');
    const timestamp = parseInt(decrypt(data));
    const elapsed = Date.now() - timestamp;
    const hoursElapsed = elapsed / (1000 * 60 * 60);
    const remaining = Math.max(0, TRIAL_HOURS - hoursElapsed);

    return {
      licensed: false,
      trial: true,
      trialExpired: remaining <= 0,
      hoursRemaining: remaining,
    };
  } catch {
    // Corrupted file - reset trial
    const timestamp = Date.now().toString();
    fs.writeFileSync(TRIAL_FILE, encrypt(timestamp), 'utf-8');
    return { licensed: false, trial: true, trialExpired: false, hoursRemaining: TRIAL_HOURS };
  }
}
