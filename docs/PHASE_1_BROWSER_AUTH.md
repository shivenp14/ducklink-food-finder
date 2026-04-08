# Phase 1: Project Setup & Browser Authentication

## Goal
Bootstrap the Electron app, wire up React UI, embed a Playwright-controlled browser window, detect Okta SSO, and implement the pause/resume authentication flow.

---

## Milestones

| # | Milestone | Deliverable |
|---|-----------|-------------|
| 1.1 | Project scaffold | Electron + React + Vite app builds and launches |
| 1.2 | Embedded browser | Playwright launches Chromium visible to user |
| 1.3 | Navigation flow | Browser navigates to Ducklink home → Okta SSO |
| 1.4 | SSO detection | App recognizes Okta login page and pauses |
| 1.5 | Auth resume | User logs in, clicks Continue, app resumes to Events tab |
| 1.6 | IPC wiring | Main ↔ Renderer communication for scan lifecycle |
| 1.7 | Settings screen | API key input + secureStorage integration |

---

## 1.1 Project Scaffold

### Init electron-vite

```bash
npm create @electron-vite/create ducklink-food-finder -- --template react-ts
cd ducklink-food-finder
npm install
```

### Directory Structure (Post-Scaffold)

```
ducklink-food-finder/
├── electron.vite.config.ts
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── src/
│   ├── main/
│   │   ├── index.ts
│   │   ├── ipc/
│   │   │   ├── channels.ts
│   │   │   └── handlers.ts
│   │   ├── services/
│   │   │   ├── playwright.ts
│   │   │   ├── store.ts
│   │   │   └── secureStore.ts
│   │   └── utils/
│   │       ├── retry.ts
│   │       └── logger.ts
│   ├── preload/
│   │   ├── index.ts
│   │   └── index.d.ts
│   └── renderer/
│       ├── index.html
│       ├── src/
│       │   ├── main.tsx
│       │   ├── App.tsx
│       │   ├── screens/
│       │   │   ├── HomeScreen.tsx
│       │   │   ├── ScanningScreen.tsx
│       │   │   └── SettingsScreen.tsx
│       │   ├── components/
│       │   │   ├── ScanButton.tsx
│       │   │   ├── BrowserAuthPrompt.tsx
│       │   │   ├── ProgressBar.tsx
│       │   │   └── ErrorMessage.tsx
│       │   ├── hooks/
│       │   │   └── useScan.ts
│       │   ├── types/
│       │   │   └── index.ts
│       │   └── lib/
│       │       └── api.ts
│       └── package.json
├── resources/
│   └── icon.png
└── package.json (root)
```

### Install Dependencies

```bash
# Production
npm install playwright-core tesseract.js openai electron-store axios

# Dev
npm install -D playwright @types/react @types/react-dom tailwindcss @tailwindcss/vite
```

> `playwright-core` is used at runtime (bundles Chromium separately). `playwright` is dev-only for `npx playwright install chromium`.

```bash
npx playwright install chromium
```

### Tailwind Setup

```typescript
// electron.vite.config.ts (renderer section)
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  renderer: {
    plugins: [react(), tailwindcss()],
  },
});
```

```css
/* src/renderer/src/index.css */
@import "tailwindcss";
```

---

## 1.2 Embedded Browser (Playwright Service)

### File: `src/main/services/playwright.ts`

```typescript
import { chromium, Browser, Page } from 'playwright-core';
import path from 'path';
import { app } from 'electron';
import { logger } from '../utils/logger';

const DUCKLINK_HOME = 'https://ducklink.stevens.edu/home_login';
const OKTA_DOMAIN = 'login.stevens.edu';
const DUCKLINK_APP = 'ducklink.stevens.edu/web_app';

let browser: Browser | null = null;
let page: Page | null = null;

export interface BrowserState {
  isAtSSO: boolean;
  isAtDucklink: boolean;
  currentUrl: string;
}

export async function launchBrowser(): Promise<void> {
  const chromiumPath = getChromiumPath();

  browser = await chromium.launch({
    headless: false,
    executablePath: chromiumPath,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    viewport: { width: 1200, height: 800 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  });

  page = await context.newPage();
  logger.info('Browser launched');
}

export async function navigateToDucklink(): Promise<BrowserState> {
  if (!page) throw new Error('Browser not initialized');

  await page.goto(DUCKLINK_HOME, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

  return detectCurrentState();
}

export function detectCurrentState(): BrowserState {
  if (!page) throw new Error('Browser not initialized');

  const url = page.url();
  return {
    isAtSSO: url.includes(OKTA_DOMAIN),
    isAtDucklink: url.includes(DUCKLINK_APP) || url.includes('ducklink.stevens.edu'),
    currentUrl: url,
  };
}

export async function waitForSSORedirect(timeoutMs: number = 300000): Promise<void> {
  if (!page) throw new Error('Browser not initialized');

  // Wait until URL leaves Okta domain
  await page.waitForFunction(
    () => !window.location.href.includes('login.stevens.edu'),
    { timeout: timeoutMs }
  );

  logger.info('SSO redirect detected, URL: ' + page.url());
}

export async function navigateToEventsTab(): Promise<void> {
  if (!page) throw new Error('Browser not initialized');

  // Wait for app to fully load after SSO redirect
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

  // Click on Events tab — selector to be refined during development
  const eventsTab = page.locator('text=Events').first();
  await eventsTab.click({ timeout: 10000 });

  // Wait for events content to load
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

  logger.info('Navigated to Events tab');
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
    page = null;
    logger.info('Browser closed');
  }
}

export function getPage(): Page | null {
  return page;
}

function getChromiumPath(): string {
  // In production, Chromium is bundled with the app
  // In dev, use Playwright's installed Chromium
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'chromium', 'chromium');
  }

  // Dev: find Playwright's Chromium
  const { executablePath } = require('playwright-core');
  return executablePath();
}
```

---

## 1.3 IPC Channels

### File: `src/main/ipc/channels.ts`

```typescript
export const IPC = {
  // Scan lifecycle
  SCAN_START: 'scan:start',
  SCAN_CONTINUE: 'scan:continue',
  SCAN_CANCEL: 'scan:cancel',

  // Main → Renderer
  SCAN_PROGRESS: 'scan:progress',
  SCAN_COMPLETE: 'scan:complete',
  SCAN_ERROR: 'scan:error',
  SCAN_AUTH_REQUIRED: 'scan:authRequired',

  // Events
  EVENTS_GET: 'events:get',
  EVENTS_CACHED: 'events:cached',

  // Settings
  SETTINGS_GET_API_KEY: 'settings:getApiKey',
  SETTINGS_SET_API_KEY: 'settings:setApiKey',
  SETTINGS_HAS_API_KEY: 'settings:hasApiKey',
} as const;
```

---

## 1.4 IPC Handlers

### File: `src/main/ipc/handlers.ts`

```typescript
import { ipcMain, BrowserWindow } from 'electron';
import { IPC } from './channels';
import { launchBrowser, navigateToDucklink, detectCurrentState, waitForSSORedirect, navigateToEventsTab, closeBrowser } from '../services/playwright';
import { getApiKey, setApiKey, hasApiKey } from '../services/secureStore';
import { retryWithBackoff } from '../utils/retry';
import { logger } from '../utils/logger';

type ScanStage = 'idle' | 'browser' | 'auth' | 'scraping' | 'done' | 'error';

let currentStage: ScanStage = 'idle';
let mainWindow: BrowserWindow | null = null;

export function registerHandlers(window: BrowserWindow): void {
  mainWindow = window;

  // ─── Scan Lifecycle ───────────────────────────────────────

  ipcMain.handle(IPC.SCAN_START, async () => {
    if (currentStage !== 'idle') {
      throw new Error('Scan already in progress');
    }

    try {
      currentStage = 'browser';
      emitProgress('browser', 'Starting browser...', 10);

      await retryWithBackoff(
        async () => {
          await launchBrowser();
          const state = await navigateToDucklink();

          if (state.isAtSSO) {
            currentStage = 'auth';
            emitAuthRequired();
            return; // pause here — wait for scan:continue
          }

          // No SSO, proceed directly
          currentStage = 'scraping';
          await navigateToEventsTab();
          emitProgress('scraping', 'Ready to scrape', 100);
          currentStage = 'idle';
        },
        {
          maxRetries: 3,
          baseDelay: 2000,
          maxDelay: 10000,
          backoffMultiplier: 2,
          onRetry: (attempt, error) => {
            logger.warn(`Browser/scraping retry ${attempt}: ${error.message}`);
            emitError('browser', error.message, attempt, false);
          },
        }
      );
    } catch (error) {
      currentStage = 'error';
      emitError('browser', (error as Error).message, 3, true);
      await closeBrowser();
      currentStage = 'idle';
    }
  });

  ipcMain.handle(IPC.SCAN_CONTINUE, async () => {
    if (currentStage !== 'auth') {
      throw new Error('No auth in progress');
    }

    try {
      emitProgress('auth', 'Waiting for SSO redirect...', 50);
      await waitForSSORedirect(300000); // 5 min timeout

      currentStage = 'scraping';
      emitProgress('scraping', 'Navigating to Events...', 70);
      await navigateToEventsTab();
      emitProgress('scraping', 'Ready to scrape', 100);
      currentStage = 'idle';
    } catch (error) {
      currentStage = 'error';
      emitError('auth', (error as Error).message, 0, true);
      await closeBrowser();
      currentStage = 'idle';
    }
  });

  ipcMain.handle(IPC.SCAN_CANCEL, async () => {
    await closeBrowser();
    currentStage = 'idle';
    emitProgress('idle', 'Scan cancelled', 0);
  });

  // ─── Settings ─────────────────────────────────────────────

  ipcMain.handle(IPC.SETTINGS_GET_API_KEY, () => {
    return getApiKey();
  });

  ipcMain.handle(IPC.SETTINGS_SET_API_KEY, (_, key: string) => {
    setApiKey(key);
  });

  ipcMain.handle(IPC.SETTINGS_HAS_API_KEY, () => {
    return hasApiKey();
  });
}

// ─── Emitters ────────────────────────────────────────────────

function emitProgress(stage: string, message: string, progress: number): void {
  mainWindow?.webContents.send(IPC.SCAN_PROGRESS, { stage, message, progress });
}

function emitAuthRequired(): void {
  mainWindow?.webContents.send(IPC.SCAN_AUTH_REQUIRED);
}

function emitError(stage: string, message: string, retryAttempt: number, isFinal: boolean): void {
  mainWindow?.webContents.send(IPC.SCAN_ERROR, { stage, message, retryAttempt, isFinal });
}
```

---

## 1.5 Secure Storage Service

### File: `src/main/services/secureStore.ts`

```typescript
import { safeStorage, app } from 'electron';
import fs from 'fs';
import path from 'path';

const KEY_PATH = path.join(app.getPath('userData'), 'secure-api-key.enc');

export function setApiKey(apiKey: string): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Encryption not available on this system');
  }
  const encrypted = safeStorage.encryptString(apiKey);
  fs.writeFileSync(KEY_PATH, encrypted);
}

export function getApiKey(): string | null {
  if (!fs.existsSync(KEY_PATH)) return null;
  const encrypted = fs.readFileSync(KEY_PATH);
  return safeStorage.decryptString(encrypted);
}

export function hasApiKey(): boolean {
  return fs.existsSync(KEY_PATH);
}

export function deleteApiKey(): void {
  if (fs.existsSync(KEY_PATH)) {
    fs.unlinkSync(KEY_PATH);
  }
}
```

---

## 1.6 Retry Utility

### File: `src/main/utils/retry.ts`

```typescript
export interface RetryOptions {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  onRetry?: (attempt: number, error: Error) => void;
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= options.maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt <= options.maxRetries) {
        options.onRetry?.(attempt, lastError);

        const delay = Math.min(
          options.baseDelay * Math.pow(options.backoffMultiplier, attempt - 1),
          options.maxDelay
        );
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  throw lastError!;
}
```

---

## 1.7 Preload Bridge

### File: `src/preload/index.ts`

```typescript
import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '../main/ipc/channels';

contextBridge.exposeInMainWorld('api', {
  // Scan
  startScan: () => ipcRenderer.invoke(IPC.SCAN_START),
  continueScan: () => ipcRenderer.invoke(IPC.SCAN_CONTINUE),
  cancelScan: () => ipcRenderer.invoke(IPC.SCAN_CANCEL),

  // Settings
  getApiKey: () => ipcRenderer.invoke(IPC.SETTINGS_GET_API_KEY),
  setApiKey: (key: string) => ipcRenderer.invoke(IPC.SETTINGS_SET_API_KEY, key),
  hasApiKey: () => ipcRenderer.invoke(IPC.SETTINGS_HAS_API_KEY),

  // Progress listeners
  onScanProgress: (cb: (data: any) => void) => {
    ipcRenderer.on(IPC.SCAN_PROGRESS, (_, data) => cb(data));
  },
  onScanComplete: (cb: (data: any) => void) => {
    ipcRenderer.on(IPC.SCAN_COMPLETE, (_, data) => cb(data));
  },
  onScanError: (cb: (data: any) => void) => {
    ipcRenderer.on(IPC.SCAN_ERROR, (_, data) => cb(data));
  },
  onAuthRequired: (cb: () => void) => {
    ipcRenderer.on(IPC.SCAN_AUTH_REQUIRED, () => cb());
  },
});
```

### File: `src/preload/index.d.ts`

```typescript
interface ScanProgress {
  stage: string;
  message: string;
  progress: number;
}

interface ScanError {
  stage: string;
  message: string;
  retryAttempt: number;
  isFinal: boolean;
}

interface WindowApi {
  startScan: () => Promise<void>;
  continueScan: () => Promise<void>;
  cancelScan: () => Promise<void>;
  getApiKey: () => Promise<string | null>;
  setApiKey: (key: string) => Promise<void>;
  hasApiKey: () => Promise<boolean>;
  onScanProgress: (cb: (data: ScanProgress) => void) => void;
  onScanComplete: (cb: (data: any) => void) => void;
  onScanError: (cb: (data: ScanError) => void) => void;
  onAuthRequired: (cb: () => void) => void;
}

declare global {
  interface Window {
    api: WindowApi;
  }
}

export {};
```

---

## 1.8 React Types

### File: `src/renderer/src/types/index.ts`

```typescript
export interface ScanProgress {
  stage: 'idle' | 'browser' | 'auth' | 'scraping' | 'ocr' | 'llm' | 'done';
  message: string;
  progress: number;
}

export interface ScanError {
  stage: string;
  message: string;
  retryAttempt: number;
  isFinal: boolean;
}

export interface Event {
  id: string;
  name: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  description: string;
  imageUrl: string | null;
  ocrText: string;
  hasFood: boolean;
  foodReasoning: string;
  sourceUrl: string;
}

export interface ScanResult {
  date: string;
  events: Event[];
  foodEvents: Event[];
  scanDuration: number;
}
```

---

## 1.9 Scan Hook

### File: `src/renderer/src/hooks/useScan.ts`

```typescript
import { useState, useEffect, useCallback } from 'react';
import { ScanProgress, ScanError } from '../types';

type ScanState = 'idle' | 'scanning' | 'auth' | 'error' | 'done';

export function useScan() {
  const [state, setState] = useState<ScanState>('idle');
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [error, setError] = useState<ScanError | null>(null);

  useEffect(() => {
    window.api.onScanProgress((data) => {
      setProgress(data);
      if (data.stage === 'done') setState('done');
    });

    window.api.onAuthRequired(() => {
      setState('auth');
    });

    window.api.onScanError((data) => {
      setError(data);
      if (data.isFinal) setState('error');
    });

    window.api.onScanComplete(() => {
      setState('done');
    });
  }, []);

  const startScan = useCallback(async () => {
    setState('scanning');
    setError(null);
    setProgress(null);
    await window.api.startScan();
  }, []);

  const continueScan = useCallback(async () => {
    setState('scanning');
    await window.api.continueScan();
  }, []);

  const cancelScan = useCallback(async () => {
    await window.api.cancelScan();
    setState('idle');
    setProgress(null);
    setError(null);
  }, []);

  const reset = useCallback(() => {
    setState('idle');
    setProgress(null);
    setError(null);
  }, []);

  return { state, progress, error, startScan, continueScan, cancelScan, reset };
}
```

---

## 1.10 React Components

### `src/renderer/src/App.tsx`

```tsx
import { useState } from 'react';
import HomeScreen from './screens/HomeScreen';
import ScanningScreen from './screens/ScanningScreen';
import SettingsScreen from './screens/SettingsScreen';
import { useScan } from './hooks/useScan';

type Screen = 'home' | 'scanning' | 'settings';

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const scan = useScan();

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {screen === 'home' && (
        <HomeScreen
          onScan={scan.startScan}
          onSettings={() => setScreen('settings')}
        />
      )}
      {screen === 'scanning' && (
        <ScanningScreen
          state={scan.state}
          progress={scan.progress}
          error={scan.error}
          onContinue={scan.continueScan}
          onCancel={() => { scan.cancelScan(); setScreen('home'); }}
          onRetry={() => { scan.reset(); scan.startScan(); }}
          onBack={() => { scan.reset(); setScreen('home'); }}
        />
      )}
      {screen === 'settings' && (
        <SettingsScreen onBack={() => setScreen('home')} />
      )}
    </div>
  );
}
```

### `src/renderer/src/screens/HomeScreen.tsx`

```tsx
import ScanButton from '../components/ScanButton';

interface Props {
  onScan: () => void;
  onSettings: () => void;
}

export default function HomeScreen({ onScan, onSettings }: Props) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-orange-400 mb-2">Ducklink Food Finder</h1>
        <p className="text-gray-400">Find free food at Stevens events</p>
      </div>

      <ScanButton onClick={onScan} />

      <button
        onClick={onSettings}
        className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
      >
        Settings
      </button>
    </div>
  );
}
```

### `src/renderer/src/components/ScanButton.tsx`

```tsx
interface Props {
  onClick: () => void;
}

export default function ScanButton({ onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className="px-8 py-4 bg-orange-500 hover:bg-orange-600 text-white text-xl font-semibold rounded-2xl shadow-lg shadow-orange-500/20 transition-all hover:scale-105 active:scale-95"
    >
      Scan for Events
    </button>
  );
}
```

### `src/renderer/src/screens/ScanningScreen.tsx`

```tsx
import { ScanProgress, ScanError } from '../types';
import BrowserAuthPrompt from '../components/BrowserAuthPrompt';
import ProgressBar from '../components/ProgressBar';
import ErrorMessage from '../components/ErrorMessage';

interface Props {
  state: string;
  progress: ScanProgress | null;
  error: ScanError | null;
  onContinue: () => void;
  onCancel: () => void;
  onRetry: () => void;
  onBack: () => void;
}

export default function ScanningScreen({ state, progress, error, onContinue, onCancel, onRetry, onBack }: Props) {
  if (state === 'auth') {
    return (
      <BrowserAuthPrompt onContinue={onContinue} onCancel={onCancel} />
    );
  }

  if (state === 'error' && error?.isFinal) {
    return (
      <ErrorMessage
        message={error.message}
        stage={error.stage}
        onRetry={onRetry}
        onBack={onBack}
      />
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6">
      <h2 className="text-2xl font-semibold">Scanning...</h2>
      {progress && (
        <>
          <p className="text-gray-400">{progress.message}</p>
          <ProgressBar value={progress.progress} />
        </>
      )}
      <button
        onClick={onCancel}
        className="mt-4 px-6 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm"
      >
        Cancel
      </button>
    </div>
  );
}
```

### `src/renderer/src/components/BrowserAuthPrompt.tsx`

```tsx
interface Props {
  onContinue: () => void;
  onCancel: () => void;
}

export default function BrowserAuthPrompt({ onContinue, onCancel }: Props) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 px-8">
      <div className="w-16 h-16 rounded-full bg-orange-500/20 flex items-center justify-center">
        <svg className="w-8 h-8 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </div>

      <h2 className="text-2xl font-semibold text-center">Okta Login Required</h2>

      <p className="text-gray-400 text-center max-w-md">
        A browser window has opened. Please log in with your Stevens Okta credentials,
        then click Continue below.
      </p>

      <div className="flex gap-4 mt-4">
        <button
          onClick={onCancel}
          className="px-6 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg"
        >
          Cancel
        </button>
        <button
          onClick={onContinue}
          className="px-6 py-2 bg-orange-500 hover:bg-orange-600 rounded-lg font-semibold"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
```

### `src/renderer/src/components/ProgressBar.tsx`

```tsx
interface Props {
  value: number;
}

export default function ProgressBar({ value }: Props) {
  return (
    <div className="w-80 h-3 bg-gray-800 rounded-full overflow-hidden">
      <div
        className="h-full bg-orange-500 rounded-full transition-all duration-300"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}
```

### `src/renderer/src/components/ErrorMessage.tsx`

```tsx
interface Props {
  message: string;
  stage: string;
  onRetry: () => void;
  onBack: () => void;
}

export default function ErrorMessage({ message, stage, onRetry, onBack }: Props) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 px-8">
      <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
        <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>

      <h2 className="text-2xl font-semibold text-center text-red-400">
        {stage === 'scraping' ? 'Scraping Failed' : 'Something Went Wrong'}
      </h2>

      <p className="text-gray-400 text-center max-w-md">{message}</p>

      <div className="flex gap-4 mt-4">
        <button
          onClick={onBack}
          className="px-6 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg"
        >
          Back
        </button>
        <button
          onClick={onRetry}
          className="px-6 py-2 bg-orange-500 hover:bg-orange-600 rounded-lg font-semibold"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
```

### `src/renderer/src/screens/SettingsScreen.tsx`

```tsx
import { useState, useEffect } from 'react';

interface Props {
  onBack: () => void;
}

export default function SettingsScreen({ onBack }: Props) {
  const [apiKey, setApiKey] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    window.api.hasApiKey().then(setHasKey);
  }, []);

  const handleSave = async () => {
    if (!apiKey.trim()) return;
    await window.api.setApiKey(apiKey.trim());
    setHasKey(true);
    setApiKey('');
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 px-8">
      <h2 className="text-2xl font-semibold">Settings</h2>

      <div className="w-full max-w-md space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-2">NVIDIA API Key</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={hasKey ? '••••••••••••••••' : 'nvapi-xxxx...'}
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-orange-500"
          />
          {hasKey && (
            <p className="text-xs text-green-400 mt-1">API key is stored securely in Keychain</p>
          )}
        </div>

        <button
          onClick={handleSave}
          disabled={!apiKey.trim()}
          className="w-full py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg font-semibold transition-colors"
        >
          {saved ? 'Saved!' : 'Save API Key'}
        </button>
      </div>

      <button
        onClick={onBack}
        className="mt-4 text-sm text-gray-500 hover:text-gray-300 transition-colors"
      >
        ← Back
      </button>
    </div>
  );
}
```

---

## Phase 1 Checklist

- [ ] Scaffold project with `electron-vite` + React + TypeScript
- [ ] Install dependencies (Playwright, Tesseract.js, OpenAI, electron-store, Tailwind)
- [ ] Run `npx playwright install chromium`
- [ ] Implement `playwright.ts` service (launch, navigate, SSO detection, close)
- [ ] Implement `secureStore.ts` service (safeStorage wrapper)
- [ ] Implement `retry.ts` utility
- [ ] Define IPC channels in `channels.ts`
- [ ] Register IPC handlers in `handlers.ts`
- [ ] Wire up preload bridge in `preload/index.ts`
- [ ] Create type definitions (`types/index.ts`, `preload/index.d.ts`)
- [ ] Build `useScan` hook
- [ ] Build HomeScreen with ScanButton
- [ ] Build ScanningScreen with progress/auth/error states
- [ ] Build BrowserAuthPrompt component
- [ ] Build ErrorMessage component
- [ ] Build ProgressBar component
- [ ] Build SettingsScreen with API key input
- [ ] Style all components with Tailwind
- [ ] Test full flow: Scan → SSO → Login → Continue → Events tab loaded
- [ ] Test retry: simulate browser failure, verify 3 retries
- [ ] Test cancel: start scan, cancel mid-flow, verify cleanup
- [ ] Test settings: save API key, verify stored in Keychain

---

## Testing the Phase 1 Flow

1. Launch app → HomeScreen shows "Scan for Events" button
2. Click "Scan for Events" → ScanningScreen shows "Starting browser..."
3. Playwright opens Chromium → navigates to Ducklink → redirects to Okta
4. BrowserAuthPrompt appears in app: "Please log in with Okta"
5. User enters credentials in Chromium window
6. User clicks "Continue" in app
7. App detects redirect away from Okta → navigates to Events tab
8. ScanningScreen shows "Ready to scrape" at 100%
9. Go to Settings → enter API key → verify saved to Keychain

---

## Known Limitations (Phase 1)

- No event scraping yet (Phase 2)
- No OCR or food detection (Phase 3-4)
- DOM selectors for Events tab are placeholder — will be refined during Phase 2 when actual page structure is inspected
- Chromium path resolution may need adjustment based on Playwright install location
