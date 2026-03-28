export {};

declare global {
  interface Window {
    electronAPI: {
      minimizeWindow: () => void;
      maximizeWindow: () => void;
      closeWindow: () => void;

      startExtraction: (config: ExtractionConfig) => Promise<void>;
      pauseExtraction: () => Promise<void>;
      stopExtraction: () => Promise<void>;
      onExtractionEvent: (callback: (event: any, data: ExtractionEvent) => void) => () => void;

      getStats: () => Promise<DashboardStats>;
      getEmails: (filters?: any) => Promise<EmailRecord[]>;
      getEmailCount: (filters?: any) => Promise<number>;
      getDomains: () => Promise<DomainRecord[]>;
      getLogs: () => Promise<LogRecord[]>;

      exportData: (format: string, options?: ExportOptions) => Promise<string>;

      verifyEmails: (emails: string[]) => Promise<VerificationResult[]>;

      testProxy: (proxy: string) => Promise<ProxyTestResult>;

      checkLicense: () => Promise<LicenseStatus>;
      activateLicense: (key: string) => Promise<ActivationResult>;
      getMachineId: () => Promise<string>;

      clearEmails: () => Promise<void>;
      deleteEmail: (id: number) => Promise<void>;
      deleteEmailsByStatus: (status: string) => Promise<void>;

      openFileDialog: () => Promise<string | null>;
      saveFileDialog: (defaultName: string) => Promise<string | null>;

      // Mailer
      getSmtps: () => Promise<any[]>;
      addSmtp: (smtp: any) => Promise<void>;
      deleteSmtp: (id: number) => Promise<void>;
      clearSmtps: () => Promise<void>;
      clearMailingLogs: () => Promise<void>;
      testSmtp: (smtp: any) => Promise<{ success: boolean; error?: string }>;
      getMailingLogs: () => Promise<any[]>;
      startMailing: (config: any) => Promise<void>;
      stopMailing: () => Promise<void>;
      onMailingEvent: (callback: (event: any, data: any) => void) => () => void;

      // Proxy
      getProxies: () => Promise<any[]>;
      addProxy: (address: string) => Promise<void>;
      deleteProxy: (id: number) => Promise<void>;
      updateProxyStatus: (data: any) => Promise<void>;
      getWorkingProxies: () => Promise<string[]>;
      fetchFreeProxies: () => Promise<number>;
      addManualEmails: (data: { emails: string[], sourcePage: string, domain: string }) => Promise<number>;
      importEmailsFromFile: () => Promise<number>;
      getMailingSettings: () => Promise<Record<string, string>>;
      saveMailingSetting: (data: { key: string, value: string }) => Promise<void>;
    };
  }
}

export interface ExtractionConfig {
  keywords: string[];
  threads: number;
  depth: number;
  timeout: number;
  proxyMode: 'none' | 'rotating';
  proxies?: string[];
}

export interface ExtractionEvent {
  type: 'crawling' | 'email-found' | 'proxy-switched' | 'page-scanned' | 'error' | 'complete' | 'started' | 'paused' | 'stopped';
  message: string;
  data?: any;
  timestamp: string;
}

export interface DashboardStats {
  emailsFound: number;
  domainsDiscovered: number;
  pagesCrawled: number;
  activeJobs: number;
  isMailerRunning: boolean;
}

export interface EmailRecord {
  id: number;
  email: string;
  domain: string;
  sourcePage: string;
  phone?: string;
  name?: string;
  status: string;
  foundAt: string;
}

export interface DomainRecord {
  id: number;
  domain: string;
  pagesCrawled: number;
  emailsFound: number;
}

export interface LogRecord {
  id: number;
  message: string;
  level: 'info' | 'success' | 'warning' | 'error';
  timestamp: string;
}

export interface ExportOptions {
  columns?: string[];
  removeDuplicates?: boolean;
  format: 'csv' | 'txt' | 'xlsx';
  filterStatus?: string;
}

export interface VerificationResult {
  email: string;
  valid: boolean;
  status: string;
  mxRecords?: string[];
}

export interface ProxyTestResult {
  proxy: string;
  working: boolean;
  latency?: number;
}

export interface LicenseStatus {
  licensed: boolean;
  trial: boolean;
  trialExpired: boolean;
  hoursRemaining?: number;
  machineId?: string;
}

export interface ActivationResult {
  success: boolean;
  message: string;
}
