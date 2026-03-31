import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { generateMachineId } from './fingerprint';
import { createClient } from '@supabase/supabase-js';
import { supabaseConfig } from './supabase-config';

const isSupabaseConfigured =
  supabaseConfig.url !== 'https://YOUR_PROJECT.supabase.co' &&
  supabaseConfig.anonKey !== 'YOUR_ANON_KEY';

const supabase = isSupabaseConfigured
  ? createClient(supabaseConfig.url, supabaseConfig.anonKey)
  : null;

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
    const keyPattern = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
    if (!keyPattern.test(licenseKey.toUpperCase())) {
      return { success: false, message: 'Invalid license key format. Expected: XXXX-XXXX-XXXX-XXXX' };
    }

    const machineId = await generateMachineId();
    const key = licenseKey.toUpperCase();

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('licenses')
        .select('*')
        .eq('key', key)
        .single();

      if (error || !data) {
        return { success: false, message: 'Invalid license key. Please check your key or contact support.' };
      }

      if (data.status === 'revoked') {
        return { success: false, message: 'This license key has been revoked. Please contact support.' };
      }

      if (data.machine_id && data.machine_id !== machineId) {
        return { success: false, message: 'This license key is already locked to another machine.' };
      }

      // Lock key to this machine on first activation
      if (!data.machine_id || data.status === 'available') {
        const { error: updateError } = await supabase
          .from('licenses')
          .update({
            machine_id: machineId,
            status: 'active',
            activated_at: new Date().toISOString(),
          })
          .eq('key', key);

        if (updateError) {
          return { success: false, message: 'Failed to activate license. Please try again.' };
        }
      }
    } else {
      // Offline fallback
      const machineHash = crypto
        .createHmac('sha256', 'TX49JA-LICENSE-SECRET')
        .update(machineId)
        .digest('hex')
        .substring(0, 16)
        .toUpperCase();

      const expectedKey = `${machineHash.substring(0, 4)}-${machineHash.substring(4, 8)}-${machineHash.substring(8, 12)}-${machineHash.substring(12, 16)}`;

      if (key !== expectedKey) {
        return { success: false, message: 'Invalid license key for this machine.' };
      }
    }

    // Store activation locally
    if (!fs.existsSync(TRIAL_DIR)) fs.mkdirSync(TRIAL_DIR, { recursive: true });

    fs.writeFileSync(
      LICENSE_FILE,
      encrypt(JSON.stringify({ activated: true, key, machineId, activatedAt: new Date().toISOString() })),
      'utf-8'
    );

    return { success: true, message: 'License activated successfully!' };
  } catch (err: any) {
    return { success: false, message: `Activation failed: ${err.message}` };
  }
}
