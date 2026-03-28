import * as dns from 'dns';
import * as net from 'net';
import { promisify } from 'util';

const resolver = new dns.promises.Resolver();
resolver.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);

async function robustResolveMx(domain: string, retries = 3): Promise<dns.MxRecord[]> {
  for (let i = 0; i < retries; i++) {
    try {
      // Use a custom timeout for the DNS query
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('DNS Timeout')), 5000)
      );
      
      const records = await Promise.race([
        resolver.resolveMx(domain),
        timeoutPromise
      ]);
      return records;
    } catch (err: any) {
      if (i === retries - 1) throw err;
      // Wait a bit before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  return [];
}

export async function verifyEmail(email: string): Promise<{ email: string; valid: boolean; status: string; mxRecords?: string[] }> {
  try {
    const domain = email.split('@')[1];
    if (!domain) return { email, valid: false, status: 'Invalid domain' };

    const records = await robustResolveMx(domain).catch(err => {
      console.error(`DNS Error for ${domain}:`, err.message);
      return [];
    });
    
    if (!records || records.length === 0) {
      return { email, valid: false, status: 'No MX records or DNS Timeout' };
    }

    const sortedMx = records.sort((a, b) => a.priority - b.priority).map((r) => r.exchange);
    
    // Strict SMTP Check
    const isActive = await checkSmtpRecipient(sortedMx[0], email);
    
    return {
      email,
      valid: isActive,
      status: isActive ? 'Active' : 'Inactive/Rejected',
      mxRecords: sortedMx,
    };
  } catch (err: any) {
    return { email, valid: false, status: `Error: ${err.message}` };
  }
}

async function checkSmtpRecipient(mxHost: string, email: string): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection(25, mxHost);
    let step = 0;
    const timeout = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, 5000);

    socket.on('data', (data) => {
      const response = data.toString();
      const code = parseInt(response.substring(0, 3));

      const domain = email.split('@')[1] || 'tomxtractor.com';

      if (step === 0) { // Greeting
        socket.write(`EHLO ${domain}\r\n`);
        step++;
      } else if (step === 1) { // After EHLO
        socket.write(`MAIL FROM:<postmaster@${domain}>\r\n`);
        step++;
      } else if (step === 2) { // After MAIL FROM
        socket.write(`RCPT TO:<${email}>\r\n`);
        step++;
      } else if (step === 3) { // After RCPT TO
        clearTimeout(timeout);
        socket.write(`QUIT\r\n`);
        socket.end();
        resolve(code === 250); // 250 means recipient accepted
      }
    });

    socket.on('error', () => {
      clearTimeout(timeout);
      resolve(false);
    });
  });
}
