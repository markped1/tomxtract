import * as dns from 'dns';
import * as net from 'net';

// ─── DNS Resolver (hardcoded public DNS to avoid ISP interference) ───────────
const resolver = new dns.promises.Resolver();
resolver.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);

// ─── Known role-based prefixes (always risky) ────────────────────────────────
const ROLE_PREFIXES = new Set([
  'admin','info','support','contact','sales','help','noreply','no-reply',
  'postmaster','webmaster','abuse','billing','marketing','team','hello',
  'office','mail','enquiries','enquiry','hr','jobs','careers','press',
  'media','legal','privacy','security','newsletter','notifications',
]);

// ─── Known disposable/temp email domains ─────────────────────────────────────
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com','guerrillamail.com','10minutemail.com','tempmail.com',
  'throwam.com','yopmail.com','sharklasers.com','guerrillamailblock.com',
  'grr.la','guerrillamail.info','guerrillamail.biz','guerrillamail.de',
  'guerrillamail.net','guerrillamail.org','spam4.me','trashmail.com',
  'trashmail.me','trashmail.net','dispostable.com','mailnull.com',
  'spamgourmet.com','spamgourmet.net','spamgourmet.org','maildrop.cc',
  'discard.email','spamhereplease.com','fakeinbox.com','mailnesia.com',
  'spamfree24.org','spamfree.eu','spamoff.de','spamspot.com',
]);

// ─── Providers known to block SMTP probing (always return 250) ───────────────
const SMTP_BLOCKING_PROVIDERS = new Set([
  'gmail.com','googlemail.com','yahoo.com','yahoo.co.uk','yahoo.fr',
  'yahoo.de','yahoo.es','yahoo.it','yahoo.com.br','yahoo.com.au',
  'hotmail.com','hotmail.co.uk','hotmail.fr','hotmail.de','hotmail.es',
  'outlook.com','live.com','msn.com','icloud.com','me.com','mac.com',
  'aol.com','protonmail.com','proton.me','zoho.com','yandex.com',
  'yandex.ru','mail.ru','gmx.com','gmx.net','gmx.de',
]);

// ─── Types ────────────────────────────────────────────────────────────────────
type SmtpResult = 'valid' | 'invalid' | 'catch-all' | 'blocked' | 'timeout' | 'error';

interface SmtpCheckResult {
  result: SmtpResult;
  code?: number;
  message?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function resolveMx(domain: string, retries = 3): Promise<dns.MxRecord[]> {
  for (let i = 0; i < retries; i++) {
    try {
      const records = await Promise.race([
        resolver.resolveMx(domain),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('DNS Timeout')), 5000)),
      ]);
      return records;
    } catch (err: any) {
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
  return [];
}

async function resolveTxt(domain: string): Promise<string[][]> {
  try {
    return await Promise.race([
      resolver.resolveTxt(domain),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('TXT Timeout')), 4000)),
    ]);
  } catch {
    return [];
  }
}

function hasSPF(txtRecords: string[][]): boolean {
  return txtRecords.some(r => r.join('').toLowerCase().startsWith('v=spf1'));
}

function hasDMARC(txtRecords: string[][]): boolean {
  return txtRecords.some(r => r.join('').toLowerCase().startsWith('v=dmarc1'));
}

/**
 * Raw SMTP conversation on a given port.
 * Returns the RCPT TO response code, or null if connection failed.
 */
function smtpProbe(mxHost: string, port: number, email: string): Promise<{ code: number; msg: string } | null> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: mxHost, port });
    let step = 0;
    let buffer = '';
    const domain = email.split('@')[1] || 'verify.local';

    const done = (val: { code: number; msg: string } | null) => {
      clearTimeout(timer);
      socket.destroy();
      resolve(val);
    };

    const timer = setTimeout(() => done(null), 8000);

    socket.on('connect', () => { /* wait for banner */ });

    socket.on('data', (chunk) => {
      buffer += chunk.toString();
      // SMTP responses end with \r\n, handle multi-line (ending with "NNN ")
      if (!/\r\n$/.test(buffer)) return;
      const lines = buffer.trim().split('\r\n');
      const last = lines[lines.length - 1];
      // Multi-line response not finished yet (e.g. "250-...")
      if (/^\d{3}-/.test(last)) return;
      const code = parseInt(last.substring(0, 3), 10);
      buffer = '';

      if (step === 0) {
        // Banner received
        socket.write(`EHLO verify.local\r\n`);
        step++;
      } else if (step === 1) {
        // EHLO response
        socket.write(`MAIL FROM:<probe@verify.local>\r\n`);
        step++;
      } else if (step === 2) {
        // MAIL FROM response
        socket.write(`RCPT TO:<${email}>\r\n`);
        step++;
      } else if (step === 3) {
        // RCPT TO response — this is what we care about
        socket.write(`QUIT\r\n`);
        done({ code, msg: last });
      }
    });

    socket.on('error', () => done(null));
    socket.on('timeout', () => done(null));
  });
}

/**
 * Try SMTP probe across ports 25 → 587 → 465.
 * Returns null if all ports are unreachable (blocked network).
 */
async function trySmtp(mxHost: string, email: string): Promise<{ code: number; msg: string } | null> {
  for (const port of [25, 587, 465]) {
    const result = await smtpProbe(mxHost, port, email);
    if (result !== null) return result;
  }
  return null; // all ports blocked
}

/**
 * Detect catch-all: probe a guaranteed-nonexistent address on the same domain.
 * If the server accepts it, it accepts everything.
 */
async function isCatchAll(mxHost: string, domain: string): Promise<boolean> {
  const probe = `catchall_probe_${Date.now()}@${domain}`;
  const result = await trySmtp(mxHost, probe);
  return result !== null && result.code === 250;
}

// ─── Main export ──────────────────────────────────────────────────────────────
export async function verifyEmail(email: string): Promise<{
  email: string;
  valid: boolean;
  status: string;
  mxRecords?: string[];
}> {
  email = email.trim().toLowerCase();

  // 1. Syntax check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { email, valid: false, status: 'Invalid Syntax' };
  }

  const [localPart, domain] = email.split('@');

  // 2. Disposable domain check
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return { email, valid: false, status: 'Disposable' };
  }

  // 3. Role-based check (valid but risky — mark separately)
  const isRole = ROLE_PREFIXES.has(localPart.split(/[.+_-]/)[0]);

  // 4. MX record lookup
  let mxRecords: string[] = [];
  try {
    const records = await resolveMx(domain);
    if (!records || records.length === 0) {
      return { email, valid: false, status: 'No MX Records' };
    }
    mxRecords = records.sort((a, b) => a.priority - b.priority).map(r => r.exchange);
  } catch {
    return { email, valid: false, status: 'DNS Error' };
  }

  // 5. SPF / DMARC check (domain legitimacy signal)
  const txtRecords = await resolveTxt(domain);
  const spf = hasSPF(txtRecords);
  const dmarc = hasDMARC(await resolveTxt(`_dmarc.${domain}`).catch(() => []));

  // 6. Known SMTP-blocking provider — skip SMTP, return best-effort result
  if (SMTP_BLOCKING_PROVIDERS.has(domain)) {
    const status = isRole ? 'Role-based' : (spf ? 'Valid (Provider Blocks SMTP)' : 'Risky');
    return { email, valid: !isRole, status, mxRecords };
  }

  // 7. Catch-all detection
  const catchAll = await isCatchAll(mxRecords[0], domain);
  if (catchAll) {
    return {
      email,
      valid: true,
      status: isRole ? 'Role-based (Catch-all)' : 'Catch-all',
      mxRecords,
    };
  }

  // 8. SMTP RCPT TO check (with port fallback 25 → 587 → 465)
  const smtpResult = await trySmtp(mxRecords[0], email);

  if (smtpResult === null) {
    // All ports blocked — fall back to MX+SPF signal
    const status = isRole ? 'Role-based' : (spf && dmarc ? 'Risky (Ports Blocked)' : 'Unknown');
    return { email, valid: spf, status, mxRecords };
  }

  const { code } = smtpResult;

  if (code === 250 || code === 251) {
    return {
      email,
      valid: true,
      status: isRole ? 'Role-based' : 'Valid',
      mxRecords,
    };
  }

  if (code === 550 || code === 551 || code === 553 || code === 554) {
    return { email, valid: false, status: 'Invalid (Mailbox Not Found)', mxRecords };
  }

  if (code === 421 || code === 450 || code === 451 || code === 452) {
    // Temporary rejection — treat as risky, not invalid
    return { email, valid: true, status: 'Risky (Temp Rejection)', mxRecords };
  }

  return { email, valid: false, status: `Unknown SMTP Response (${code})`, mxRecords };
}
