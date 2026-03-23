import * as si from 'systeminformation';
import * as crypto from 'crypto';

let cachedId: string | null = null;

export async function generateMachineId(): Promise<string> {
  if (cachedId) return cachedId;
  try {
    const [cpu, disk, os] = await Promise.all([
      si.cpu(),
      si.diskLayout(),
      si.osInfo(),
    ]);

    const rawId = [
      cpu.manufacturer,
      cpu.brand,
      cpu.stepping?.toString() || '',
      disk[0]?.serialNum || '',
      os.serial || '',
      os.hostname || '',
    ].join('|');

    const hash = crypto.createHash('sha256').update(rawId).digest('hex');
    cachedId = `TX49JA-${hash.substring(0, 12).toUpperCase()}`;
    return cachedId;
  } catch {
    const fallback = crypto.randomUUID().replace(/-/g, '').substring(0, 12).toUpperCase();
    cachedId = `TX49JA-${fallback}`;
    return cachedId;
  }
}
