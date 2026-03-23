import * as dns from 'dns';
import * as net from 'net';
import { promisify } from 'util';

const resolveMx = promisify(dns.resolveMx);

export async function verifyEmail(email: string): Promise<{ email: string; valid: boolean; status: string; mxRecords?: string[] }> {
  try {
    const domain = email.split('@')[1];
    if (!domain) return { email, valid: false, status: 'Invalid domain' };

    const records = await resolveMx(domain);
    if (!records || records.length === 0) {
      return { email, valid: false, status: 'No MX records' };
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
