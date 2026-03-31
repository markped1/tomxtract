import { Client, LocalAuth } from 'whatsapp-web.js';
import QRCode from 'qrcode';
import { EventEmitter } from 'events';

export class WhatsAppClient extends EventEmitter {
  private client: Client;
  private qrCode: string | null = null;
  private isAuthenticated = false;
  private isReady = false;

  constructor() {
    super();
    this.client = new Client({
      authStrategy: new LocalAuth({
        clientId: 'whatsapp-bulk-session'
      }),
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu',
          '--disable-extensions',
          '--disable-default-apps',
          '--mute-audio',
          '--no-default-browser-check'
        ],
      }
    });

    this.setupEventListeners();
  }

  private setupEventListeners() {
    this.client.on('qr', async (qr) => {
      console.log('[WA] QR Received');
      this.qrCode = await QRCode.toDataURL(qr);
      this.emit('qr', this.qrCode);
    });

    this.client.on('authenticated', () => {
      console.log('[WA] Authenticated');
      this.isAuthenticated = true;
      this.qrCode = null;
      this.emit('authenticated');
    });

    this.client.on('ready', () => {
      console.log('[WA] Ready');
      this.isReady = true;
      this.emit('ready');
    });

    this.client.on('auth_failure', (msg) => {
      console.error('[WA] Auth Failure:', msg);
      this.emit('error', 'Authentication failure: ' + msg);
    });

    this.client.on('disconnected', (reason) => {
      console.warn('[WA] Disconnected:', reason);
      this.isReady = false;
      this.isAuthenticated = false;
      this.emit('disconnected', reason);
    });
  }

  private isInitializing = false;

  async initialize() {
    if (this.isReady || this.isAuthenticated || this.isInitializing) {
        console.log('[WA] Engine is already initializing or initialized.');
        return;
    }
    this.isInitializing = true;
    try {
      await this.client.initialize();
    } catch (err: any) {
      this.isInitializing = false;
      this.emit('error', 'Initialization error: ' + err.message);
    }
  }

  async isRegistered(number: string) {
    if (!this.isReady) throw new Error('WhatsApp client not ready');
    // Format number: remove +, spaces, etc.
    const sanitizedNumber = number.replace(/\D/g, '');
    const finalNumber = sanitizedNumber.includes('@c.us') ? sanitizedNumber : `${sanitizedNumber}@c.us`;
    
    console.log(`[WA] Checking registration for: ${finalNumber}`);
    const isRegistered = await this.client.isRegisteredUser(finalNumber);
    console.log(`[WA] Result for ${finalNumber}: ${isRegistered ? 'REGISTERED' : 'NOT FOUND'}`);
    
    return isRegistered;
  }

  async sendMessage(number: string, message: string) {
    if (!this.isReady) throw new Error('WhatsApp client not ready');
    const sanitizedNumber = number.replace(/\D/g, '');
    const finalNumber = sanitizedNumber.includes('@c.us') ? sanitizedNumber : `${sanitizedNumber}@c.us`;
    return await this.client.sendMessage(finalNumber, message);
  }

  getStatus() {
    return {
      isAuthenticated: this.isAuthenticated,
      isReady: this.isReady,
      qrCode: this.qrCode
    };
  }
}

export const whatsappClient = new WhatsAppClient();
