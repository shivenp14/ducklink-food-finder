import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '../main/ipc/channels';
import type { ScrapedEvent } from '../renderer/src/types';

interface ScanProgressData {
  stage: string;
  message: string;
  progress: number;
}

interface ScanResultData {
  date: string;
  events: ScrapedEvent[];
  foodEvents: ScrapedEvent[];
  scanDuration: number;
  fromCache: boolean;
}

interface ScanErrorData {
  stage: string;
  message: string;
  retryAttempt: number;
  isFinal: boolean;
}

contextBridge.exposeInMainWorld('api', {
  // Scan
  startScan: (forceRefresh?: boolean) => ipcRenderer.invoke(IPC.SCAN_START, forceRefresh),
  cancelScan: () => ipcRenderer.invoke(IPC.SCAN_CANCEL),

  // Settings
  getApiKey: () => ipcRenderer.invoke(IPC.SETTINGS_GET_API_KEY),
  setApiKey: (key: string) => ipcRenderer.invoke(IPC.SETTINGS_SET_API_KEY, key),
  hasApiKey: () => ipcRenderer.invoke(IPC.SETTINGS_HAS_API_KEY),
  deleteApiKey: () => ipcRenderer.invoke(IPC.SETTINGS_DELETE_API_KEY),

  // Cache
  clearCache: () => ipcRenderer.invoke(IPC.CACHE_CLEAR),
  getCacheInfo: () => ipcRenderer.invoke(IPC.CACHE_INFO),
  getCachedScan: () => ipcRenderer.invoke(IPC.CACHE_GET),

  // Browser
  openExternal: (url: string) => ipcRenderer.invoke(IPC.BROWSER_OPEN_EXTERNAL, url),

  // Progress listeners
  onScanProgress: (cb: (data: ScanProgressData) => void) => {
    ipcRenderer.on(IPC.SCAN_PROGRESS, (_event, data) => cb(data));
  },
  onScanComplete: (cb: (data: ScanResultData) => void) => {
    ipcRenderer.on(IPC.SCAN_COMPLETE, (_event, data) => cb(data));
  },
  onScanError: (cb: (data: ScanErrorData) => void) => {
    ipcRenderer.on(IPC.SCAN_ERROR, (_event, data) => cb(data));
  },
  onBrowserUrlChanged: (cb: (url: string) => void) => {
    ipcRenderer.on(IPC.BROWSER_URL_CHANGED, (_event, url) => cb(url));
  },
  onBrowserPreviewUpdated: (cb: (dataUrl: string) => void) => {
    ipcRenderer.on(IPC.BROWSER_PREVIEW_UPDATED, (_event, dataUrl) => cb(dataUrl));
  },
});
