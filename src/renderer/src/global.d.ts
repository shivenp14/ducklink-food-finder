export {};

interface ScanProgress {
  stage: 'idle' | 'browser' | 'scraping' | 'ocr' | 'llm' | 'done';
  message: string;
  progress: number;
}

interface ScanError {
  stage: string;
  message: string;
  retryAttempt: number;
  isFinal: boolean;
}

interface ScanResult {
  date: string;
  events: unknown[];
  foodEvents: unknown[];
  scanDuration: number;
  fromCache: boolean;
}

interface CacheInfo {
  date: string;
  eventCount: number;
  timestamp: number;
}

interface WindowApi {
  startScan: (forceRefresh?: boolean) => Promise<void>;
  cancelScan: () => Promise<void>;
  getApiKey: () => Promise<string | null>;
  setApiKey: (key: string) => Promise<void>;
  hasApiKey: () => Promise<boolean>;
  deleteApiKey: () => Promise<void>;
  clearCache: () => Promise<void>;
  getCacheInfo: () => Promise<CacheInfo | null>;
  openExternal: (url: string) => Promise<void>;
  onScanProgress: (cb: (data: ScanProgress) => void) => void;
  onScanComplete: (cb: (data: ScanResult) => void) => void;
  onScanError: (cb: (data: ScanError) => void) => void;
  onBrowserUrlChanged: (cb: (url: string) => void) => void;
  onBrowserPreviewUpdated: (cb: (dataUrl: string) => void) => void;
}

declare global {
  interface Window {
    api: WindowApi;
  }
}
