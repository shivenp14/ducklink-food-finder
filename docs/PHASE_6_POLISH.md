# Phase 6: Polish & Distribution

## Goal
Add daily result caching to avoid redundant scans, a manual refresh button, a full settings panel (API key management + cache control), app icon, and macOS .dmg packaging for distribution.

---

## Milestones

| # | Milestone | Deliverable |
|---|-----------|-------------|
| 6.1 | Daily cache | Scan results cached in electron-store, keyed by date |
| 6.2 | Cache-aware scan flow | Auto-load cache on launch, skip scan if same-day cache exists |
| 6.3 | Manual refresh | Force re-scan button that bypasses cache |
| 6.4 | Settings panel | API key management, cache info, clear cache action |
| 6.5 | App icon | Custom .icns/.png icon for dock and DMG |
| 6.6 | macOS packaging | electron-builder producing a signed .dmg |

---

## 6.1 Daily Cache Service

### File: `src/main/services/cache.ts`

```typescript
import Store from 'electron-store';
import { logger } from '../utils/logger';

interface CacheSchema {
  lastScan: {
    date: string;           // ISO date (YYYY-MM-DD)
    timestamp: number;      // epoch ms
    events: unknown[];
    foodEvents: unknown[];
    scanDurationMs: number;
  } | null;
}

const store = new Store<CacheSchema>({
  name: 'ducklink-cache',
  defaults: {
    lastScan: null,
  },
});

export function getCachedScan(): CacheSchema['lastScan'] {
  const cached = store.get('lastScan');
  if (!cached) return null;

  const today = new Date().toISOString().split('T')[0];
  if (cached.date !== today) {
    logger.info(`Cache expired: cached=${cached.date}, today=${today}`);
    clearCache();
    return null;
  }

  logger.info(`Cache hit: ${cached.events.length} events from ${cached.date}`);
  return cached;
}

export function saveCache(
  events: unknown[],
  foodEvents: unknown[],
  scanDurationMs: number
): void {
  const today = new Date().toISOString().split('T')[0];

  store.set('lastScan', {
    date: today,
    timestamp: Date.now(),
    events,
    foodEvents,
    scanDurationMs,
  });

  logger.info(`Cached ${events.length} events for ${today}`);
}

export function clearCache(): void {
  store.set('lastScan', null);
  logger.info('Cache cleared');
}

export function getCacheInfo(): { date: string; eventCount: number; timestamp: number } | null {
  const cached = store.get('lastScan');
  if (!cached) return null;

  return {
    date: cached.date,
    eventCount: cached.events.length,
    timestamp: cached.timestamp,
  };
}
```

### Cache Behavior

| Scenario | Action |
|----------|--------|
| App launch, same-day cache exists | Load cached events, show ResultsScreen |
| App launch, no cache or stale cache | Show HomeScreen, no auto-load |
| User clicks Scan, same-day cache exists | Return cached results (no browser) |
| User clicks Scan, no cache | Run full scan pipeline |
| User clicks Refresh | Clear cache, run full scan |
| New day (date changed) | Cache auto-expires on read |

---

## 6.2 Updated Scan Lifecycle

### Updated `src/main/ipc/handlers.ts`

Add cache check at the start of `SCAN_START`:

```typescript
import { getCachedScan, saveCache, clearCache, getCacheInfo } from '../services/cache';

ipcMain.handle(IPC.SCAN_START, async (_, forceRefresh: boolean = false) => {
  if (currentStage !== 'idle') {
    throw new Error('Scan already in progress');
  }

  // Check cache first (unless force refresh)
  if (!forceRefresh) {
    const cached = getCachedScan();
    if (cached) {
      logger.info('Returning cached results');
      currentStage = 'done';
      mainWindow?.webContents.send(IPC.SCAN_COMPLETE, {
        date: cached.date,
        events: cached.events,
        foodEvents: cached.foodEvents,
        scanDuration: cached.scanDurationMs,
        fromCache: true,
      });
      currentStage = 'idle';
      return;
    }
  }

  // ... existing full scan pipeline ...

  // After scan completes successfully:
  saveCache(sortedEvents, foodEvents, scanDuration);

  currentStage = 'done';
  emitScanComplete(sortedEvents, foodEvents, scanDuration, false);
  currentStage = 'idle';
});
```

### Updated `emitScanComplete`

```typescript
function emitScanComplete(
  events: ClassifiedEvent[],
  foodEvents: ClassifiedEvent[],
  scanDuration: number,
  fromCache: boolean = false
): void {
  mainWindow?.webContents.send(IPC.SCAN_COMPLETE, {
    date: new Date().toISOString().split('T')[0],
    events,
    foodEvents,
    scanDuration,
    fromCache,
  });
}
```

### Updated IPC Channels

Add to `src/main/ipc/channels.ts`:

```typescript
export const IPC = {
  // ... existing channels ...

  // Cache
  CACHE_CLEAR: 'cache:clear',
  CACHE_INFO: 'cache:info',
} as const;
```

### New IPC Handlers

```typescript
ipcMain.handle(IPC.CACHE_CLEAR, () => {
  clearCache();
});

ipcMain.handle(IPC.CACHE_INFO, () => {
  return getCacheInfo();
});
```

---

## 6.3 Updated Preload Bridge

### `src/preload/index.ts` — Add cache channels

```typescript
contextBridge.exposeInMainWorld('api', {
  // ... existing ...

  // Scan with optional force refresh
  startScan: (forceRefresh?: boolean) => ipcRenderer.invoke(IPC.SCAN_START, forceRefresh),

  // Cache
  clearCache: () => ipcRenderer.invoke(IPC.CACHE_CLEAR),
  getCacheInfo: () => ipcRenderer.invoke(IPC.CACHE_INFO),
});
```

### `src/preload/index.d.ts` — Updated types

```typescript
interface WindowApi {
  // ... existing ...
  startScan: (forceRefresh?: boolean) => Promise<void>;
  clearCache: () => Promise<void>;
  getCacheInfo: () => Promise<{ date: string; eventCount: number; timestamp: number } | null>;
}
```

---

## 6.4 Manual Refresh

### Updated `src/renderer/src/hooks/useScan.ts`

```typescript
const startScan = useCallback(async (forceRefresh = false) => {
  setState('scanning');
  setError(null);
  if (forceRefresh) {
    setProgress(null);
    setEvents([]);
    setFoodEvents([]);
  }
  await window.api.startScan(forceRefresh);
}, []);
```

### Updated `src/renderer/src/screens/ResultsScreen.tsx`

Add refresh button alongside Rescan:

```tsx
interface Props {
  events: ScrapedEvent[];
  foodEvents: ScrapedEvent[];
  fromCache: boolean;
  onRescan: () => void;
  onRefresh: () => void;
  onHome: () => void;
}

export default function ResultsScreen({ events, foodEvents, fromCache, onRescan, onRefresh, onHome }: Props) {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">{events.length} Events Found</h1>
            <p className="text-sm text-gray-500 mt-1">
              {foodEvents.length} with free food
              {fromCache && ' · Loaded from cache'}
            </p>
          </div>
          <div className="flex gap-3">
            {fromCache && (
              <button
                onClick={onRefresh}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm cursor-pointer transition-colors flex items-center gap-2"
              >
                <RefreshIcon />
                Refresh
              </button>
            )}
            <button
              onClick={onRescan}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm cursor-pointer transition-colors"
            >
              Rescan
            </button>
            <button
              onClick={onHome}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 rounded-lg text-sm font-semibold cursor-pointer transition-colors"
            >
              Home
            </button>
          </div>
        </div>

        {/* ... rest of ResultsScreen unchanged ... */}
      </div>
    </div>
  );
}

function RefreshIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}
```

### Updated `src/renderer/src/App.tsx`

```tsx
{screen === 'results' && (
  <ResultsScreen
    events={scan.events}
    foodEvents={scan.foodEvents}
    fromCache={scan.fromCache}
    onRescan={() => { scan.reset(); scan.startScan(); setScreen('scanning'); }}
    onRefresh={() => { scan.reset(); scan.startScan(true); setScreen('scanning'); }}
    onHome={() => { scan.reset(); setScreen('home'); }}
  />
)}
```

### Updated `useScan` — Track `fromCache`

```typescript
const [fromCache, setFromCache] = useState(false);

// In onScanComplete:
window.api.onScanComplete((data) => {
  setEvents(data.events as ScrapedEvent[]);
  setFoodEvents(data.foodEvents as ScrapedEvent[]);
  setFromCache(data.fromCache ?? false);
  setState('done');
});

// In reset:
setFromCache(false);

// Return:
return { state, progress, error, events, foodEvents, fromCache, startScan, continueScan, cancelScan, reset };
```

---

## 6.5 Settings Panel

### Updated `src/renderer/src/screens/SettingsScreen.tsx`

```tsx
import { useState, useEffect } from 'react';

interface Props {
  onBack: () => void;
}

export default function SettingsScreen({ onBack }: Props) {
  const [apiKey, setApiKey] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [cacheInfo, setCacheInfo] = useState<{ date: string; eventCount: number; timestamp: number } | null>(null);

  useEffect(() => {
    window.api.hasApiKey().then(setHasKey);
    window.api.getCacheInfo().then(setCacheInfo);
  }, []);

  const handleSave = async () => {
    if (!apiKey.trim()) return;
    await window.api.setApiKey(apiKey.trim());
    setHasKey(true);
    setApiKey('');
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClearCache = async () => {
    await window.api.clearCache();
    setCacheInfo(null);
  };

  const handleDeleteKey = async () => {
    // Note: deleteApiKey needs to be added to IPC if not present
    setHasKey(false);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <div className="max-w-md mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-2xl font-semibold">Settings</h1>
        </div>

        {/* API Key Section */}
        <section className="bg-gray-900 rounded-xl p-5 border border-gray-800 mb-4">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
            NVIDIA API Key
          </h2>

          <div className="space-y-3">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={hasKey ? '••••••••••••••••' : 'nvapi-xxxx...'}
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-orange-500 text-sm"
            />

            {hasKey && (
              <p className="text-xs text-green-400 flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Stored securely in macOS Keychain
              </p>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={!apiKey.trim()}
                className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg font-semibold text-sm transition-colors"
              >
                {saved ? 'Saved!' : 'Save API Key'}
              </button>
              {hasKey && (
                <button
                  onClick={handleDeleteKey}
                  className="px-4 py-2 bg-gray-800 hover:bg-red-500/20 hover:text-red-400 rounded-lg text-sm transition-colors"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Cache Section */}
        <section className="bg-gray-900 rounded-xl p-5 border border-gray-800 mb-4">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Cached Data
          </h2>

          {cacheInfo ? (
            <div className="space-y-3">
              <div className="text-sm text-gray-300">
                <p>
                  <span className="text-gray-500">Date:</span> {cacheInfo.date}
                </p>
                <p>
                  <span className="text-gray-500">Events:</span> {cacheInfo.eventCount}
                </p>
                <p>
                  <span className="text-gray-500">Scanned:</span>{' '}
                  {new Date(cacheInfo.timestamp).toLocaleTimeString()}
                </p>
              </div>

              <button
                onClick={handleClearCache}
                className="w-full py-2 bg-gray-800 hover:bg-red-500/20 hover:text-red-400 rounded-lg text-sm transition-colors"
              >
                Clear Cache
              </button>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No cached data</p>
          )}
        </section>

        {/* About Section */}
        <section className="bg-gray-900 rounded-xl p-5 border border-gray-800">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
            About
          </h2>
          <p className="text-sm text-gray-400">
            Ducklink Food Finder v1.0.0
          </p>
          <p className="text-xs text-gray-600 mt-1">
            Scans Stevens Ducklink for free food at campus events using OCR and AI.
          </p>
        </section>
      </div>
    </div>
  );
}
```

### Additional IPC for API Key Deletion

Add to `src/main/ipc/channels.ts`:

```typescript
SETTINGS_DELETE_API_KEY: 'settings:deleteApiKey',
```

Add handler in `src/main/ipc/handlers.ts`:

```typescript
ipcMain.handle(IPC.SETTINGS_DELETE_API_KEY, () => {
  deleteApiKey();
});
```

Expose in preload:

```typescript
deleteApiKey: () => ipcRenderer.invoke(IPC.SETTINGS_DELETE_API_KEY),
```

---

## 6.6 App Icon

### Icon Requirements

| Property | Value |
|----------|-------|
| Format | `.icns` (macOS), `.png` (512x512 fallback) |
| Source | Design a duck + magnifying glass or food icon |
| Sizes | 16, 32, 64, 128, 256, 512, 1024px |
| Location | `resources/icon.icns`, `resources/icon.png` |

### electron-builder config in `package.json`

```json
{
  "build": {
    "appId": "com.ducklink.food-finder",
    "productName": "Ducklink Food Finder",
    "mac": {
      "category": "public.app-category.utilities",
      "icon": "resources/icon.icns",
      "target": ["dmg"],
      "hardenedRuntime": true,
      "gatekeeperAssess": false
    },
    "dmg": {
      "title": "Ducklink Food Finder",
      "icon": "resources/icon.icns",
      "contents": [
        { "x": 130, "y": 220 },
        { "x": 410, "y": 220, "type": "link", "path": "/Applications" }
      ]
    },
    "files": [
      "out/**/*",
      "resources/**/*"
    ]
  }
}
```

### Build Scripts

Add to `package.json`:

```json
{
  "scripts": {
    "build": "electron-vite build",
    "pack": "electron-builder --dir",
    "dist": "electron-builder",
    "dist:mac": "electron-builder --mac"
  }
}
```

---

## 6.7 Updated ScanResult Type

### `src/renderer/src/types/index.ts`

```typescript
export interface ScanResult {
  date: string;
  events: ScrapedEvent[];
  foodEvents: ScrapedEvent[];
  scanDuration: number;
  fromCache: boolean;     // NEW — indicates if loaded from cache
}
```

---

## 6.8 Updated HomeScreen — Auto-Load Cache

### Updated `src/renderer/src/screens/HomeScreen.tsx`

On app launch, check for cached results and offer to load them:

```tsx
import { useState, useEffect } from 'react';
import ScanButton from '../components/ScanButton';

interface Props {
  onScan: () => void;
  onLoadCached: () => void;
  onSettings: () => void;
}

export default function HomeScreen({ onScan, onLoadCached, onSettings }: Props) {
  const [hasKey, setHasKey] = useState(false);
  const [cacheInfo, setCacheInfo] = useState<{ date: string; eventCount: number } | null>(null);

  useEffect(() => {
    window.api.hasApiKey().then(setHasKey);
    window.api.getCacheInfo().then((info) => {
      if (info) {
        const today = new Date().toISOString().split('T')[0];
        if (info.date === today) {
          setCacheInfo({ date: info.date, eventCount: info.eventCount });
        }
      }
    });
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-10 px-8">
      <div className="text-center space-y-3">
        <div className="text-6xl">🦆</div>
        <h1 className="text-4xl font-bold text-orange-400">Ducklink Food Finder</h1>
        <p className="text-gray-400 max-w-xs">
          Scan Stevens Ducklink for free food at campus events
        </p>
      </div>

      {!hasKey && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-4 py-3 max-w-sm w-full">
          <p className="text-sm text-yellow-400 text-center">
            Set your NVIDIA API key in{' '}
            <button onClick={onSettings} className="underline hover:text-yellow-300">
              Settings
            </button>{' '}
            to enable food detection.
          </p>
        </div>
      )}

      {/* Cached results available */}
      {cacheInfo && (
        <button
          onClick={onLoadCached}
          className="bg-gray-900 border border-gray-700 hover:border-orange-500/40 rounded-xl px-6 py-4 max-w-sm w-full text-left transition-all"
        >
          <p className="text-sm font-medium text-gray-200">
            📋 {cacheInfo.eventCount} events from today's scan
          </p>
          <p className="text-xs text-gray-500 mt-1">Click to view cached results</p>
        </button>
      )}

      <ScanButton onClick={onScan} disabled={!hasKey} />

      <button
        onClick={onSettings}
        className="text-sm text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        Settings
      </button>
    </div>
  );
}
```

---

## 6.9 Updated App.tsx

```tsx
import { useState, useEffect } from 'react';
import HomeScreen from './screens/HomeScreen';
import ScanningScreen from './screens/ScanningScreen';
import ResultsScreen from './screens/ResultsScreen';
import SettingsScreen from './screens/SettingsScreen';
import { useScan } from './hooks/useScan';

type Screen = 'home' | 'scanning' | 'results' | 'settings';

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const scan = useScan();

  useEffect(() => {
    if (scan.state === 'done' && scan.events.length > 0) {
      setScreen('results');
    }
  }, [scan.state, scan.events]);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {screen === 'home' && (
        <HomeScreen
          onScan={() => { scan.startScan(); setScreen('scanning'); }}
          onLoadCached={() => { scan.startScan(); }}
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
      {screen === 'results' && (
        <ResultsScreen
          events={scan.events}
          foodEvents={scan.foodEvents}
          fromCache={scan.fromCache}
          onRescan={() => { scan.reset(); scan.startScan(); setScreen('scanning'); }}
          onRefresh={() => { scan.reset(); scan.startScan(true); setScreen('scanning'); }}
          onHome={() => { scan.reset(); setScreen('home'); }}
        />
      )}
      {screen === 'settings' && (
        <SettingsScreen onBack={() => setScreen('home')} />
      )}
    </div>
  );
}
```

---

## 6.10 electron-store Dependency

### Already installed? Verify in `package.json`

```json
{
  "dependencies": {
    "electron-store": "^10.x"
  }
}
```

If not installed:

```bash
npm install electron-store
```

---

## 6.11 Packaging for macOS

### Steps

1. Create `resources/icon.icns` (convert from PNG using `iconutil` or a design tool)
2. Update `package.json` with `build` config (see 6.6)
3. Install `electron-builder`:

```bash
npm install -D electron-builder
```

4. Build and package:

```bash
npm run build && npm run dist:mac
```

5. Output: `dist/mac/Ducklink Food Finder.dmg`

### Code Signing (Optional for Local Use)

For personal use, code signing is not required. For distribution:

```bash
# If you have an Apple Developer certificate:
export CSC_NAME="Developer ID Application: Your Name (TEAM_ID)"
npm run dist:mac
```

### Notarization (Optional)

For Gatekeeper compliance on other machines:

```bash
npx electron-notarize --bundle-id com.ducklink.food-finder dist/mac/Ducklink\ Food\ Finder.app
```

---

## Phase 6 Checklist

- [ ] Implement `cache.ts` service with `getCachedScan()`, `saveCache()`, `clearCache()`, `getCacheInfo()`
- [ ] Update IPC channels with `cache:clear` and `cache:info`
- [ ] Register new IPC handlers for cache operations
- [ ] Update `SCAN_START` handler to check cache first, accept `forceRefresh` param
- [ ] Update `emitScanComplete` to include `fromCache` flag
- [ ] Update preload bridge with `clearCache()`, `getCacheInfo()`, `deleteApiKey()`
- [ ] Update `useScan` hook with `fromCache` state
- [ ] Update `ResultsScreen` with cache indicator and Refresh button
- [ ] Update `HomeScreen` with cached results card (auto-load option)
- [ ] Update `SettingsScreen` with cache info section and Clear Cache button
- [ ] Add API key deletion IPC channel + handler
- [ ] Update `App.tsx` with `onLoadCached` and `onRefresh` props
- [ ] Design and create app icon (icon.icns + icon.png)
- [ ] Add `electron-builder` config to `package.json`
- [ ] Add build scripts (`pack`, `dist`, `dist:mac`)
- [ ] Test: first scan → results cached → close app → reopen → cached results shown
- [ ] Test: same-day scan → cache hit, no browser launched
- [ ] Test: next day → cache expired, scan button works normally
- [ ] Test: force refresh → bypasses cache, new scan runs
- [ ] Test: clear cache in Settings → next scan runs fresh
- [ ] Test: Settings shows cache date, count, timestamp
- [ ] Test: API key delete → key removed from Keychain
- [ ] Test: build .dmg → install → app runs with icon in dock
- [ ] Test: .dmg drag-to-Applications flow works

---

## Testing the Phase 6 Flow

1. **Cache on first scan:**
   - Launch app → no cache → HomeScreen shows scan button only
   - Click Scan → full pipeline runs → ResultsScreen
   - Quit app → relaunch → HomeScreen shows "X events from today's scan" card

2. **Cache hit:**
   - Click cached card → ResultsScreen loads instantly (no browser, no LLM)
   - Header shows "Loaded from cache" indicator
   - Refresh button appears next to Rescan

3. **Force refresh:**
   - Click Refresh → ScanningScreen → full pipeline re-runs → fresh results
   - Cache overwritten with new data

4. **Cache expiry:**
   - Change system date to tomorrow → relaunch
   - Cache card gone → scan button only

5. **Settings panel:**
   - Open Settings → shows API key status, cache info, about section
   - Clear Cache → cache card disappears from HomeScreen
   - Delete API key → scan button disabled on HomeScreen

6. **Packaging:**
   - Run `npm run dist:mac` → .dmg produced in `dist/mac/`
   - Mount .dmg → drag app to Applications → launch → icon in dock

---

## Known Limitations (Phase 6)

- **No background refresh** — cache only updates when user explicitly scans
- **No auto-launch** — app does not start at login or scan in background
- **No notifications** — no push/local notifications when new food events appear
- **Single-day cache only** — no history of past days' events
- **No cache size limit** — if events grow very large, electron-store file grows proportionally (unlikely in practice)
- **Code signing optional** — unsigned apps will trigger Gatekeeper warning on other machines
- **No auto-update** — users must manually download new .dmg for updates
- **electron-store v10+ required** — older versions use CommonJS and require different import syntax
