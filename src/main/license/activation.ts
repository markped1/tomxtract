import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { generateMachineId } from './fingerprint';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get, set } from 'firebase/database';
import { firebaseConfig } from './firebase-config';

// Initialize Firebase (only if config is valid)
const isFirebaseConfigured = firebaseConfig.apiKey !== "YOUR_API_KEY";
let db: any = null;
if (isFirebaseConfigured) {
  const app = initializeApp(firebaseConfig);
  db = getDatabase(app);
}

const TRIAL_DIR = 'C:\\ProgramData\\TomXtractor';
const LICENSE_FILE = path.join(TRIAL_DIR, 'license.dat');
const ENC_KEY = 'TX49JA-ENCRYPTION-KEY-2024-SECURE';

function encrypt(text: string): string {
  const key = crypto.scryptSync(ENC_KEY, 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

export async function activateLicense(licenseKey: string): Promise<{ success: boolean; message: string }> {
  try {
    // Validate key format (XXXX-XXXX-XXXX-XXXX)
    const keyPattern = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
    if (!keyPattern.test(licenseKey.toUpperCase())) {
      return { success: false, message: 'Invalid license key format. Expected: XXXX-XXXX-XXXX-XXXX' };
    }

    const machineId = await generateMachineId();

    // Use Firebase for activation if configured
    if (isFirebaseConfigured && db) {
      const licenseRef = ref(db, `licenses/${licenseKey.toUpperCase()}`);
      const snapshot = await get(licenseRef);

      if (!snapshot.exists()) {
        return { success: false, message: 'Invalid license key. Please check your key or contact support.' };
      }

      const data = snapshot.val();
      
      if (data.machineId && data.machineId !== machineId) {
        return { success: false, message: 'This license key is already locked to another machine.' };
      }

      // If it's a new activation, lock it to this machine
      if (!data.machineId || data.status === 'available') {
        await set(licenseRef, {
          ...data,
          machineId,
          status: 'active',
          activatedAt: new Date().toISOString()
        });
      }
    } else {
      // Fallback to local offline verification if Firebase is not configured
      const machineHash = crypto.createHmac('sha256', 'TX49JA-LICENSE-SECRET')
        .update(machineId)
        .digest('hex')
        .substring(0, 16)
        .toUpperCase();

      const expectedKey = `${machineHash.substring(0, 4)}-${machineHash.substring(4, 8)}-${machineHash.substring(8, 12)}-${machineHash.substring(12, 16)}`;
      
      if (licenseKey.toUpperCase() !== expectedKey) {
        return { success: false, message: 'Invalid license key for this machine.' };
      }
    }

    // Store activation locally
    if (!fs.existsSync(TRIAL_DIR)) {
      fs.mkdirSync(TRIAL_DIR, { recursive: true });
    }

    const licenseData = JSON.stringify({
      activated: true,
      key: licenseKey,
      machineId,
      activatedAt: new Date().toISOString(),
    });

    fs.writeFileSync(LICENSE_FILE, encrypt(licenseData), 'utf-8');

    return { success: true, message: 'License activated successfully!' };
  } catch (err: any) {
    return { success: false, message: `Activation failed: ${err.message}` };
  }
}
