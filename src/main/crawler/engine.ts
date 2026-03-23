import puppeteer, { Browser, Page } from 'puppeteer-core';
import { EventEmitter } from 'events';
import { addEmail, addDomain, incrementDomainPages, addLog } from '../db/database';
// @ts-ignore
import pdf from 'pdf-parse';
import * as ExcelJS from 'exceljs';
import axios from 'axios';

const EMAIL_REGEX = /[a-zA-Z0-9._%\-+]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g; // Kept % and + but will filter manually for better control
const PHONE_REGEX = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3,4}\)?[-.\s]?\d{3}[-.\s]?\d{4,9}/g;

const BLACKLIST = [
  'example.com','sentry.io', 'wixpress.com','w3.org','schema.org','googleapis.com',
  'facebook.com','twitter.com','google.com','wordpress.org','gravatar.com','jquery.com',
  'duckduckgo.com', 'bing.com', 'microsoft.com', 'youtube.com', 'messenger.com',
  'instagram.com', 'linkedin.com' // Often contain system/meta emails
];

const ASSET_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.pdf', '.zip', '.rar', '.exe', '.css', '.js', '.mp4', '.mp3'];

const BUSINESS_ROLES = [
  'info', 'admin', 'support', 'sales', 'contact', 'office', 'webmaster', 'noreply',
  'hr', 'jobs', 'billing', 'help', 'marketing', 'press', 'media', 'enquiry',
  'reservations', 'book', 'team', 'staff', 'hello', 'mail', 'postmaster',
  'account', 'accounts', 'service', 'services', 'feedback', 'queries'
];

const GOV_EXTENSIONS = ['.gov', '.mil', '.gov.ng', '.gov.uk', '.gov.au', '.gov.ca', '.gov.za'];

const UNIVERSAL_PERSONAL_PROVIDERS = [
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'aol.com',
  'msn.com', 'live.com', 'ymail.com', 'rocketmail.com', 'mail.com', 'gmx.com',
  'zoho.com', 'yandex.com', 'yandex.ru', 'rambler.ru', 'mail.ru', 'protonmail.com',
  'me.com', 'qq.com', '163.com', 'sina.com', 'rediffmail.com', 'fastmail.com',
  'btinternet.com', 'virginmedia.com', 'blueyonder.co.uk', 'talktalk.net', 'sky.com',
  'web.de', 'gmx.net', 't-online.de', 'freenet.de',
  'libero.it', 'virgilio.it', 'alice.it',
  'orange.fr', 'wanadoo.fr', 'free.fr', 'sfr.fr', 'laposte.net',
  'cox.net', 'verizon.net', 'att.net', 'comcast.net', 'earthlink.net'
];

interface CrawlConfig {
  keywords: string[];
  threads: number;
  depth: number;
  timeout: number;
  proxyMode: 'none' | 'rotating';
  proxies?: string[];
}

export class ExtractionEngine extends EventEmitter {
  private browser: Browser | null = null;
  private browsers: Browser[] = [];
  private running = false;
  private paused = false;
  private shouldStop = false;
  private currentProxyIndex = 0;

  async start(config: CrawlConfig) {
    if (this.running) return;
    this.running = true;
    this.paused = false;
    this.shouldStop = false;
    this.browsers = [];

    this.emit('event', { type: 'started', message: 'Extraction engine started', timestamp: new Date().toISOString() });
    addLog('Extraction engine started', 'info');

    try {
      let chromiumPath: string;
      try {
        chromiumPath = require('chromium').path;
        if (chromiumPath.includes('app.asar') && !chromiumPath.includes('app.asar.unpacked')) {
          chromiumPath = chromiumPath.replace('app.asar', 'app.asar.unpacked');
        }
      } catch {
        chromiumPath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
      }

      // LAUNCH SHARED BROWSER
      const launchArgs = [
        '--no-sandbox', 
        '--disable-setuid-sandbox', 
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process'
      ];
      
      this.browser = await puppeteer.launch({
        headless: true,
        executablePath: chromiumPath,
        args: launchArgs,
      });

      // Collect all search queries
      const searchQueries: { engine: 'google' | 'bing' | 'duckduckgo', query: string }[] = [];
      for (const kw of config.keywords) {
        const querySet = [
          `"${kw}" + "email"`,
          `"${kw}" + "contact"`,
          `"${kw}" + "@gmail.com"`,
          `"${kw}" + "@yahoo.com"`,
          `"${kw}" + "@outlook.com"`,
          `site:linkedin.com "${kw}" email`,
          `site:facebook.com "${kw}" email`,
          `site:twitter.com "${kw}" email`,
          `site:instagram.com "${kw}" email`
        ];
        
        for (const q of querySet) {
          searchQueries.push({ engine: 'google', query: q });
          searchQueries.push({ engine: 'bing', query: q });
          searchQueries.push({ engine: 'duckduckgo', query: q });
        }
      }

      const getNextProxy = () => {
        if (!config.proxies || config.proxies.length === 0) return null;
        const proxy = config.proxies[this.currentProxyIndex];
        this.currentProxyIndex = (this.currentProxyIndex + 1) % config.proxies.length;
        return proxy;
      };

      const queue = [...searchQueries];
      const workers = Array.from({ length: Math.min(config.threads, 5) }, async (_, index) => {
        while (queue.length > 0 && !this.shouldStop) {
          while (this.paused && !this.shouldStop) {
            await new Promise(r => setTimeout(r, 1000));
          }
          if (this.shouldStop) break;

          const item = queue.shift();
          if (!item) break;

          let url = '';
          if (item.engine === 'google') {
            url = `https://www.google.com/search?q=${encodeURIComponent(item.query)}`;
          } else if (item.engine === 'bing') {
            url = `https://www.bing.com/search?q=${encodeURIComponent(item.query)}`;
          } else if (item.engine === 'duckduckgo') {
            url = `https://duckduckgo.com/html/?q=${encodeURIComponent(item.query)}`;
          }

          if (this.browser) {
            await this.crawlPage(url, config.timeout, config.depth, 0, this.browser);
          }
          await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000));
        }
      });

      await Promise.all(workers);
    } catch (err: any) {
      this.emit('event', { type: 'error', message: `Engine error: ${err.message}`, timestamp: new Date().toISOString() });
      addLog(`Engine error: ${err.message}`, 'error');
    } finally {
      await this.cleanup();
      this.running = false;
      this.emit('event', { type: 'complete', message: 'Extraction complete', timestamp: new Date().toISOString() });
      addLog('Extraction complete', 'success');
    }
  }

  private async crawlPage(url: string, timeout: number, maxDepth: number, depth: number = 0, browserInstance: Browser) {
    if (this.shouldStop) return;

    // Check for document files first
    if (url.endsWith('.pdf') || url.endsWith('.xlsx') || url.endsWith('.txt')) {
      await this.extractFromFile(url);
      return;
    }

    let page: Page | null = null;
    try {
      this.emit('event', { type: 'crawling', message: `Crawling: ${url}`, timestamp: new Date().toISOString() });

      page = await browserInstance.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) req.abort();
        else req.continue();
      });

      const isSearchPage = url.includes('google.com/search') || url.includes('bing.com/search') || url.includes('duckduckgo.com');
      await page.goto(url, { 
        waitUntil: isSearchPage ? 'domcontentloaded' : 'networkidle2', 
        timeout: timeout * 1000 
      });
      const content = await page.content();
      const bodyText = await page.evaluate(() => document.body?.innerText || '');

      if (isSearchPage && depth < maxDepth) {
        const links = await page.evaluate(() => {
          const links: string[] = [];
          document.querySelectorAll('a').forEach(a => {
            const href = (a as HTMLAnchorElement).href;
            if (href && href.startsWith('http')) {
              // Filter out search engine internal links
              const isInternal = /google\.com|bing\.com|duckduckgo\.com|microsoft\.com|youtube\.com|facebook\.com\/sharer|twitter\.com\/intent/.test(href);
              if (!isInternal) {
                links.push(href);
              }
            }
          });
          return links;
        });
        const uniqueLinks = [...new Set(links)].slice(0, 30);
        for (const link of uniqueLinks) {
          if (this.shouldStop) break;
          // Deep crawl for better yield (max depth 2 for external sites)
          await this.crawlPage(link, timeout, Math.min(maxDepth, 2), depth + 1, browserInstance);
        }
      }

      await this.processText(content + ' ' + bodyText, url);

      this.emit('event', { type: 'page-scanned', message: `Scanned: ${url}`, timestamp: new Date().toISOString() });
    } catch (err: any) {
      this.emit('event', { type: 'error', message: `Error crawling ${url}: ${err.message}`, timestamp: new Date().toISOString() });
    } finally {
      if (page) { try { await page.close(); } catch { } }
    }
  }

  private async extractFromFile(url: string) {
    try {
      addLog(`Downloading document: ${url}`, 'info');
      const response = await axios.get(url, { responseType: 'arraybuffer' });
      const buffer = Buffer.from(response.data);
      let text = '';

      if (url.endsWith('.pdf')) {
        // @ts-ignore
        const data = await pdf(buffer);
        text = data.text;
      } else if (url.endsWith('.xlsx')) {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer as any);
        workbook.eachSheet(sheet => {
          sheet.eachRow(row => {
            if (row && row.values && Array.isArray(row.values)) {
              text += row.values.filter(v => v != null).map(String).join(' ') + ' ';
            }
          });
        });
      } else if (url.endsWith('.txt')) {
        text = buffer.toString();
      }

      if (text) {
        await this.processText(text, url);
        addLog(`Extracted emails from document: ${url}`, 'success');
      }
    } catch (err: any) {
      addLog(`Failed to process document ${url}: ${err.message}`, 'error');
    }
  }

  private async processText(text: string, sourceUrl: string) {
    const emails = text.match(EMAIL_REGEX) || [];
    const uniqueEmails = [...new Set(emails)];
    const domain = new URL(sourceUrl).hostname;

    addDomain(domain);
    incrementDomainPages(domain);
    
    // Extract potential phones from page text
    const phones = text.match(PHONE_REGEX) || [];
    const uniquePhones = [...new Set(phones)].map(p => p.trim()).filter(p => p.length > 8);
    const primaryPhone = uniquePhones[0] || '';

    for (const email of uniqueEmails) {
      const emailLower = email.toLowerCase();
      
      // Attempt to find a name near the email in text
      let foundName = '';
      const emailIndex = text.indexOf(email);
      if (emailIndex !== -1) {
        // Look at the context before the email (up to 100 chars)
        const contextBefore = text.substring(Math.max(0, emailIndex - 80), emailIndex);
        // Look for patterns like "Name: John Doe" or just "John Doe <email>"
        const nameMatch = contextBefore.match(/(?:Name|Contact|Owner):\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})/i) 
                        || contextBefore.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})(?:\s*<|\s*$)/);
        if (nameMatch) {
          foundName = nameMatch[1].trim();
        }
      }

      // SMARTER STAFF & PERSONAL FILTERING
      if (email.includes('%') || email.includes(' ') || email.includes('+')) continue; // Skip URL-encoded junk or strange tags
      
      const [user, mailDomain] = emailLower.split('@');
      
      // Block common assets/files masquerading as emails
      if (ASSET_EXTENSIONS.some(ext => emailLower.endsWith(ext))) continue;

      if (BLACKLIST.some((b) => mailDomain.includes(b))) continue;
      
      // Block common business role prefixes (info@, sales@, hr@, etc.)
      if (BUSINESS_ROLES.some(role => user === role)) continue;
      
      // Block Government extensions (but allow .edu schools)
      if (GOV_EXTENSIONS.some(ext => mailDomain.endsWith(ext))) continue;

      // Block Direct Company Emails: e.g., "apple@apple.com"
      const domainName = mailDomain.split('.')[0];
      const isPersonalProvider = UNIVERSAL_PERSONAL_PROVIDERS.includes(mailDomain);
      if (user === domainName && !isPersonalProvider) {
        // Skip direct company emails like "microsoft@microsoft.com"
        continue;
      }

      if (email.length > 80) continue;

      const added = addEmail(email, mailDomain, sourceUrl, primaryPhone, foundName);
      if (added) {
        this.emit('event', {
          type: 'email-found',
          message: `Found: ${email}`,
          data: { 
            id: Date.now(), 
            email, 
            domain: mailDomain, 
            sourcePage: sourceUrl, 
            phone: primaryPhone,
            name: foundName,
            status: 'pending', 
            foundAt: new Date().toISOString() 
          },
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  pause() { this.paused = !this.paused; const msg = this.paused ? 'Engine paused' : 'Engine resumed'; this.emit('event', { type: this.paused ? 'paused' : 'started', message: msg, timestamp: new Date().toISOString() }); addLog(msg, 'info'); }
  stop() { this.shouldStop = true; this.emit('event', { type: 'stopped', message: 'Engine stopping...', timestamp: new Date().toISOString() }); addLog('Engine stopped by user', 'warning'); }
  isRunning() { return this.running; }

  private async cleanup() {
    for (const b of this.browsers) {
      try { await b.close(); } catch { }
    }
    this.browsers = [];
    if (this.browser) {
      try { await this.browser.close(); } catch { }
      this.browser = null;
    }
  }
}
