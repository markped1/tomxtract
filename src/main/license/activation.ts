import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { generateMachineId } from './fingerprint';

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

    // Verify key against machine ID using HMAC
    const machineHash = crypto.createHmac('sha256', 'TX49JA-LICENSE-SECRET')
      .update(machineId)
      .digest('hex')
      .substring(0, 16)
      .toUpperCase();

    // Format the hash as XXXX-XXXX-XXXX-XXXX
    const expectedKey = `${machineHash.substring(0, 4)}-${machineHash.substring(4, 8)}-${machineHash.substring(8, 12)}-${machineHash.substring(12, 16)}`;
    
    if (licenseKey.toUpperCase() !== expectedKey) {
      return { success: false, message: 'Invalid license key for this machine.' };
    }

    // Store activation
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
