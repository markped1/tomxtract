import nodemailer from 'nodemailer';
import { EventEmitter } from 'events';
import { addMailingLog, getSmtps } from '../db/database';

interface MailerConfig {
  subject: string;
  body: string;
  recipients: string[];
}

export class EmailMailer extends EventEmitter {
  private running = false;
  private shouldStop = false;
  private currentSmtpIndex = 0;

  async start(config: MailerConfig) {
    if (this.running) return;
    this.running = true;
    this.shouldStop = false;

    const smtps = getSmtps();
    if (smtps.length === 0) {
      this.emit('event', { type: 'error', message: 'No SMTP accounts configured' });
      this.running = false;
      return;
    }

    this.emit('event', { type: 'started', message: `Mailing campaign started with ${config.recipients.length} recipients` });

    for (let i = 0; i < config.recipients.length; i++) {
      if (this.shouldStop) break;

      const recipient = config.recipients[i];
      const smtp = smtps[this.currentSmtpIndex];

      try {
        const personalizedSubject = this.replacePlaceholders(config.subject, recipient);
        const personalizedBody = this.replacePlaceholders(config.body, recipient);

        await this.sendEmail(smtp, recipient, personalizedSubject, personalizedBody);
        this.emit('event', { 
          type: 'sent', 
          message: `Sent to ${recipient} using ${smtp.user}`,
          recipient,
          smtpUser: smtp.user
        });
        addMailingLog({
          smtpId: smtp.id,
          recipient,
          subject: personalizedSubject,
          status: 'success'
        });
      } catch (err: any) {
        this.emit('event', { 
          type: 'error', 
          message: `Failed to send to ${recipient}: ${err.message}` 
        });
        addMailingLog({
          smtpId: smtp.id,
          recipient,
          subject: config.subject, // Store original subject in log for consistency or personalized one? Let's use personalized
          status: 'error',
          error: err.message
        });
      }

      // Rotate SMTP
      this.currentSmtpIndex = (this.currentSmtpIndex + 1) % smtps.length;

      // Wait 1 minute if not the last email
      if (i < config.recipients.length - 1 && !this.shouldStop) {
        this.emit('event', { type: 'waiting', message: 'Waiting 60 seconds for next send...' });
        await new Promise(resolve => setTimeout(resolve, 60000));
      }
    }

    this.running = false;
    this.emit('event', { type: 'complete', message: 'Mailing campaign complete' });
  }

  stop() {
    this.shouldStop = true;
    this.emit('event', { type: 'stopped', message: 'Mailing campaign stopped by user' });
  }

  private replacePlaceholders(text: string, recipient: string): string {
    const domain = recipient.split('@')[1] || '';
    const date = new Date().toLocaleDateString();
    
    return text
      .replace(/{email}/g, recipient)
      .replace(/{domain}/g, domain)
      .replace(/{date}/g, date);
  }

  private async sendEmail(smtp: any, to: string, subject: string, body: string) {
    const isGmail = smtp.host.toLowerCase().includes('gmail.com') || smtp.user.toLowerCase().endsWith('@gmail.com');
    
    const transportConfig: any = {
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure === 1,
      auth: {
        user: smtp.user,
        pass: smtp.pass
      },
      tls: {
        rejectUnauthorized: false,
        minVersion: 'TLSv1',
        ciphers: 'DEFAULT@SECLEVEL=0'
      }
    };

    if (isGmail) {
      // Use specialized Gmail service if detected
      transportConfig.service = 'gmail';
      // Gmail service handles host/port/secure settings automatically, 
      // but we keep them in config in case it fails back.
    }

    const transporter = nodemailer.createTransport(transportConfig);

    const messageId = `<${Date.now()}.${Math.random().toString(36).substring(2, 10)}@${smtp.host}>`;

    await transporter.sendMail({
      from: `"${smtp.fromName}" <${smtp.fromEmail}>`,
      to,
      replyTo: smtp.replyTo || smtp.fromEmail,
      subject,
      text: body.replace(/<[^>]*>?/gm, ''), // Stripped HTML for plain text
      html: body.includes('<') ? body : body.replace(/\n/g, '<br>'),
      headers: {
        'Message-ID': messageId,
        'X-Mailer': 'TomXtractor 49ja Professional',
        'X-Priority': '3',
        'Date': new Date().toUTCString(),
        'Precedence': 'bulk'
      }
    });
  }

  async testSmtp(smtp: any) {
    const isGmail = smtp.host.toLowerCase().includes('gmail.com') || smtp.user.toLowerCase().endsWith('@gmail.com');
    
    const transportConfig: any = {
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure === 1,
      auth: {
        user: smtp.user,
        pass: smtp.pass
      },
      tls: {
        rejectUnauthorized: false,
        minVersion: 'TLSv1',
        ciphers: 'DEFAULT@SECLEVEL=0'
      },
      connectionTimeout: 10000
    };

    if (isGmail) {
      transportConfig.service = 'gmail';
    }

    const transporter = nodemailer.createTransport(transportConfig);

    try {
      await transporter.verify();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  isRunning() {
    return this.running;
  }
}

export const emailMailer = new EmailMailer();
