# Ducklink Food Finder - Technical Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Electron Main Process                 │
│                                                         │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  App Window  │  │  Browser     │  │  Tray / Menu  │  │
│  │  (React UI)  │  │  Window      │  │  (minimal)    │  │
│  └──────┬───────┘  └──────┬───────┘  └───────────────┘  │
│         │                 │                              │
│         ▼                 ▼                              │
│  ┌──────────────────────────────────────────────────┐   │
│  │              IPC Bridge (preload.js)              │   │
│  └──────────────────────┬───────────────────────────┘   │
│                         │                               │
│         ┌───────────────┼───────────────┐               │
│         ▼               ▼               ▼               │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │
│  │  Playwright  │ │  Tesseract  │ │  NVIDIA     │       │
│  │  Service     │ │  Service    │ │  NIM Client │       │
│  └─────────────┘ └─────────────┘ └─────────────┘       │
│         │               │               │               │
│         ▼               ▼               ▼               │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │
│  │  Ducklink   │ │  Local      │ │  NVIDIA     │       │
│  │  Website    │ │  Files      │ │  API        │       │
│  └─────────────┘ └─────────────┘ └─────────────┘       │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │              electron-store (persistent)          │   │
│  │  - API key  - cached events  - last scan date    │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| Desktop shell | Electron | ^33.x | Mac desktop app container |
| UI framework | React | ^19.x | Component-based UI |
| Build tool | Vite (electron-vite) | ^2.x | Fast HMR dev + production builds |
| Browser automation | Playwright | ^1.x | Chromium-based scraping + SSO handling |
| OCR engine | Tesseract.js | ^5.x | Text extraction from event images |
| LLM API | NVIDIA NIM (Llama 3.1 8B) | latest | Food detection classification |
| HTTP client | axios | ^1.x | NVIDIA API calls |
| Persistent storage | electron-store | ^10.x | Cached events + settings |
| Secure storage | safeStorage (Electron built-in) | — | Encrypted API key via OS keychain |
| Styling | Tailwind CSS | ^4.x | Utility-first styling in React |

---

## Process Architecture

### Main Process (`src/main/`)

Responsible for:
- Electron app lifecycle (create windows, handle quit)
- Playwright browser instance management
- File system operations (image downloads, cache)
- IPC handler registration

```
main/
├── index.ts                  # App entry, window creation
├── ipc/
│   ├── handlers.ts           # All IPC handler registrations
│   └── channels.ts           # IPC channel name constants
├── services/
│   ├── playwright.ts         # Browser lifecycle + scraping
│   ├── scraper.ts            # Ducklink DOM extraction logic
│   ├── ocr.ts                # Tesseract wrapper
│   ├── llm.ts                # NVIDIA NIM client
│   ├── foodDetector.ts       # Orchestrates OCR → LLM pipeline
│   ├── store.ts              # electron-store wrapper (non-sensitive data)
│   └── secureStore.ts        # safeStorage wrapper (API keys)
└── utils/
    ├── retry.ts              # Generic retry with backoff
    └── logger.ts             # Logging utility
```

### Renderer Process (`src/renderer/`)

React app with screens:
- **Home** — Scan button + settings access
- **Scanning** — Progress indicator (browser, scraping, OCR, LLM stages)
- **Results** — Food events + other events list
- **Settings** — API key management

```
renderer/
├── App.tsx
├── main.tsx
├── screens/
│   ├── HomeScreen.tsx
│   ├── ScanningScreen.tsx
│   ├── ResultsScreen.tsx
│   └── SettingsScreen.tsx
├── components/
│   ├── EventCard.tsx
│   ├── FoodBadge.tsx
│   ├── ProgressBar.tsx
│   ├── BrowserAuthPrompt.tsx
│   └── ErrorMessage.tsx
├── hooks/
│   ├── useScan.ts            # Scan state machine
│   └── useEvents.ts          # Event data fetching
├── types/
│   └── index.ts              # Shared type definitions
└── styles/
    └── index.css             # Tailwind imports + custom
```

### Preload (`src/preload/`)

Context bridge exposing safe IPC channels to renderer:

```typescript
// preload/index.ts
contextBridge.exposeInMainWorld('api', {
  // Scan lifecycle
  startScan: () => ipcRenderer.invoke('scan:start'),
  continueScan: () => ipcRenderer.invoke('scan:continue'),
  cancelScan: () => ipcRenderer.invoke('scan:cancel'),

  // Events
  getEvents: () => ipcRenderer.invoke('events:get'),
  getCachedEvents: () => ipcRenderer.invoke('events:cached'),

  // Settings
  getApiKey: () => ipcRenderer.invoke('settings:getApiKey'),
  setApiKey: (key: string) => ipcRenderer.invoke('settings:setApiKey', key),
  hasApiKey: () => ipcRenderer.invoke('settings:hasApiKey'),

  // Progress updates (main → renderer)
  onScanProgress: (cb: (data: ProgressData) => void) => {
    ipcRenderer.on('scan:progress', (_, data) => cb(data));
  },
  onScanComplete: (cb: (data: ScanResult) => void) => {
    ipcRenderer.on('scan:complete', (_, data) => cb(data));
  },
  onScanError: (cb: (data: ScanError) => void) => {
    ipcRenderer.on('scan:error', (_, data) => cb(data));
  },
  onAuthRequired: (cb: () => void) => {
    ipcRenderer.on('scan:authRequired', () => cb());
  },
});
```

---

## IPC Protocol

### Channel Definitions

| Channel | Direction | Payload | Purpose |
|---------|-----------|---------|---------|
| `scan:start` | R → M | `none` | Initiate scan flow |
| `scan:continue` | R → M | `none` | User completed auth, resume |
| `scan:cancel` | R → M | `none` | Abort current scan |
| `scan:progress` | M → R | `ProgressData` | Stage + percentage update |
| `scan:complete` | M → R | `ScanResult` | Final events array |
| `scan:error` | M → R | `ScanError` | Error with retry count |
| `scan:authRequired` | M → R | `none` | SSO detected, waiting for user |
| `events:get` | R → M | `none` | Fetch today's events (fresh or cached) |
| `events:cached` | R → M | `none` | Fetch only cached events |
| `settings:getApiKey` | R → M | `none` | Retrieve decrypted API key from keychain |
| `settings:setApiKey` | R → M | `string` | Encrypt and store API key in keychain |
| `settings:hasApiKey` | R → M | `none` | Check if API key exists (no decryption) |

### ProgressData

```typescript
interface ProgressData {
  stage: 'browser' | 'auth' | 'scraping' | 'ocr' | 'llm' | 'done';
  message: string;
  progress: number;        // 0-100
  current?: number;        // current item (e.g., event 3 of 12)
  total?: number;          // total items
}
```

### ScanResult

```typescript
interface ScanResult {
  date: string;            // ISO date
  events: Event[];
  foodEvents: Event[];
  scanDuration: number;    // ms
}
```

### ScanError

```typescript
interface ScanError {
  stage: string;           // which stage failed
  message: string;
  retryAttempt: number;    // 1-3
  isFinal: boolean;        // true after 3 failures
}
```

---

## Playwright Service

### Lifecycle

```
startBrowser()
  → new Chromium window (visible to user)
  → navigate to ducklink.stevens.edu/home_login
  → wait for either:
      a) Events page URL (no SSO needed)
      b) login.stevens.edu URL (SSO detected)
  → emit authRequired if SSO

continueAfterAuth()
  → wait for redirect back to ducklink.stevens.edu
  → navigate to Events tab
  → begin scraping

scrapeEvents()
  → extract event cards from DOM
  → for each card:
      → extract title, time, location, description, image URL
      → download image to temp directory
  → return Event[]

closeBrowser()
  → close Chromium instance
```

### DOM Scraping Strategy

- Use Playwright's `page.locator()` with CSS selectors
- Fallback: text-based locators for resilience
- Handle lazy-loaded content with `page.waitForSelector()` + scroll
- Each retry re-initializes browser from scratch (no stale state)

### Browser Window Config

```typescript
const browserWindow = new BrowserWindow({
  width: 1200,
  height: 800,
  title: 'Ducklink Food Finder - Browser',
  webPreferences: {
    nodeIntegration: false,
    contextIsolation: true,
  },
});
```

Playwright connects to Electron's Chromium via `electron.launch()` or uses a separate Chromium instance with `chromium.launch({ headless: false })`. Using a separate Chromium instance is preferred to avoid conflicts with Electron's renderer.

---

## Tesseract OCR Service

### Pipeline

```
receiveImagePath(path)
  → tesseract.recognize(path, 'eng')
  → post-process:
      → trim whitespace
      → remove garbled characters
      → collapse newlines
  → return cleaned text string
```

### Configuration

```typescript
const worker = await createWorker('eng', 1, {
  logger: (m) => updateProgress(m.progress), // feed to UI
});
```

### Concurrency

- Process images sequentially (avoids memory spikes)
- Each image capped at 10s timeout
- Failed OCR returns empty string (not blocking)

### Temp File Management

- Downloaded images stored in `app.getPath('temp')/ducklink-food-finder/`
- Cleanup on app quit and after scan completion
- Images named: `{eventId}.jpg` or `{eventId}.png`

---

## NVIDIA NIM Client

### API Configuration

```typescript
import { getApiKey } from '../services/secureStore';

const apiKey = getApiKey();
if (!apiKey) {
  throw new Error('API key not configured. Please set it in Settings.');
}

const client = new OpenAI({
  apiKey,
  baseURL: 'https://integrate.api.nvidia.com/v1',
});
```

### Request Format

```typescript
const response = await client.chat.completions.create({
  model: 'meta/llama-3.1-8b-instruct',
  messages: [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: buildBatchPayload(events) },
  ],
  temperature: 0.1,       // low temp for consistent classification
  max_tokens: 1024,
  response_format: { type: 'json_object' },
});
```

### System Prompt

```
You are a food detection classifier for university events.
Analyze the provided events and determine if free food will be available.
Consider direct mentions AND indirect references:
- Restaurant names (Chipotle, Domino's, etc.)
- "Catered", "provided by", "sponsored by [restaurant]"
- Food items (pizza, donuts, bagels, tacos, etc.)
- "Free", "complimentary" combined with any food reference

Respond ONLY with valid JSON. No explanation outside the JSON.
```

### Batch Payload Format

```json
{
  "events": [
    {
      "index": 0,
      "title": "CS Club Meeting",
      "description": "Join us for our weekly meeting! Chipotle will be provided.",
      "imageText": ""
    },
    {
      "index": 1,
      "title": "Guest Speaker: AI in Healthcare",
      "description": "Dr. Smith presents latest research.",
      "imageText": "FREE PIZZA 12PM BABBIO"
    }
  ]
}
```

### Expected Response Format

```json
{
  "results": [
    {
      "index": 0,
      "hasFood": true,
      "reasoning": "Chipotle catering explicitly mentioned"
    },
    {
      "index": 1,
      "hasFood": true,
      "reasoning": "OCR text from image mentions free pizza at 12pm"
    }
  ]
}
```

### Response Validation

```typescript
function validateLLMResponse(raw: string, batchSize: number): LLMResult[] {
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed.results)) throw new Error('Missing results array');
  if (parsed.results.length !== batchSize) throw new Error('Batch size mismatch');

  for (const r of parsed.results) {
    if (typeof r.index !== 'number') throw new Error('Missing index');
    if (typeof r.hasFood !== 'boolean') throw new Error('Missing hasFood');
    if (typeof r.reasoning !== 'string') throw new Error('Missing reasoning');
  }

  return parsed.results;
}
```

### Batching Logic

```typescript
async function detectFood(events: Event[]): Promise<Event[]> {
  const BATCH_SIZE = 5;
  const batches = chunk(events, BATCH_SIZE);
  const results: Event[] = [];

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const batchResult = await retryWithBackoff(
      () => classifyBatch(batch),
      { maxRetries: 2, baseDelay: 1000 }
    );

    for (const r of batchResult) {
      results.push({
        ...batch[r.index],
        hasFood: r.hasFood,
        foodReasoning: r.reasoning,
      });
    }

    emitProgress('llm', i + 1, batches.length);
  }

  return results;
}
```

---

## Retry Strategy

### Generic Retry Utility

```typescript
interface RetryOptions {
  maxRetries: number;
  baseDelay: number;       // ms
  maxDelay: number;        // ms
  backoffMultiplier: number;
}

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < options.maxRetries) {
        const delay = Math.min(
          options.baseDelay * Math.pow(options.backoffMultiplier, attempt),
          options.maxDelay
        );
        await sleep(delay);
      }
    }
  }

  throw lastError;
}
```

### Retry Configs Per Service

| Service | Max Retries | Base Delay | Backoff |
|---------|-------------|------------|---------|
| Scraping (full flow) | 3 | 2000ms | 2x |
| LLM batch | 2 | 1000ms | 2x |
| OCR (per image) | 1 | 500ms | 1x |
| Image download | 2 | 1000ms | 2x |

---

## Scan State Machine

```
                    ┌──────────┐
                    │   IDLE   │
                    └────┬─────┘
                         │ startScan()
                         ▼
                    ┌──────────┐
                    │ BROWSER  │── fail ──▶ RETRY (up to 3)
                    └────┬─────┘                      │
                         │ SSO detected               │ all retries
                         ▼                            │ exhausted
                    ┌──────────┐                      ▼
                    │   AUTH   │─── user continues ──▶ ERROR
                    └────┬─────┘         │
                         │               │
                         ▼               ▼
                    ┌──────────┐    ┌──────────┐
                    │ SCRAPING │──▶ │   OCR    │
                    └────┬─────┘    └────┬─────┘
                         │               │
                         ▼               ▼
                    ┌──────────┐    ┌──────────┐
                    │   LLM    │──▶ │   DONE   │
                    └──────────┘    └──────────┘
```

States: `IDLE | BROWSER | AUTH | SCRAPING | OCR | LLM | DONE | ERROR`

### State Transitions

| From | To | Trigger |
|------|----|---------|
| IDLE | BROWSER | User clicks "Scan" |
| BROWSER | AUTH | Okta SSO URL detected |
| BROWSER | SCRAPING | Ducklink events page loaded (no SSO) |
| AUTH | SCRAPING | User clicks "Continue" after login |
| SCRAPING | OCR | All events extracted |
| OCR | LLM | All images processed |
| LLM | DONE | All batches classified |
| * | ERROR | Retry exhausted at any stage |

---

## Data Flow: End to End

```
[User clicks Scan]
       │
       ▼
[Main: startPlaywright()]
       │
       ▼
[Playwright: navigate to Ducklink]
       │
       ├─ SSO? → emit authRequired → [Renderer shows prompt]
       │              │
       │         [User logs in, clicks Continue]
       │              │
       │◀─────────────┘
       ▼
[Playwright: navigate to Events tab]
       │
       ▼
[Scraper: extract event cards from DOM]
       │  returns: Partial<Event>[]
       ▼
[Download event images to temp dir]
       │
       ▼
[OCR: process each image → text]
       │  merges into event.imageText
       ▼
[Food Detector: chunk events into batches of 5]
       │
       ▼
[LLM Client: POST each batch to NVIDIA NIM]
       │  returns: { index, hasFood, reasoning }[]
       ▼
[Merge LLM results into Event objects]
       │  event.hasFood = true/false
       │  event.foodReasoning = "..."
       ▼
[Sort: food events first, then by startTime]
       │
       ▼
[Cache to electron-store]
       │
       ▼
[Emit scan:complete with sorted events]
       │
       ▼
[Renderer: display ResultsScreen]
```

---

## Storage Schema

### electron-store Structure (Non-Sensitive Data Only)

```json
{
  "lastScan": {
    "date": "2026-03-31",
    "timestamp": 1711843200000,
    "events": [...],
    "scanDurationMs": 45000
  },
  "settings": {
    "autoCache": true,
    "cacheExpiryHours": 24
  }
}
```

### Secure Storage (safeStorage)

API keys are **never** stored in electron-store. Instead, Electron's `safeStorage` API encrypts the key using OS-level encryption before writing to disk:

- **macOS**: Keychain Access (`safeStorage` uses the `Electron {appName} {encryptionKey}` keychain entry)
- **Storage location**: `app.getPath('userData')/secure-api-key.enc`
- **Encryption**: AES-256-GCM via OS keychain APIs

```typescript
// src/main/services/secureStore.ts
import { safeStorage, app } from 'electron';
import fs from 'fs';
import path from 'path';

const KEY_PATH = path.join(app.getPath('userData'), 'secure-api-key.enc');

export function saveApiKey(apiKey: string): void {
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

### Cache Invalidation

- Cache is keyed by date string (`YYYY-MM-DD`)
- If same-day scan requested, return cached unless user forces refresh
- Cache expires after 24 hours or on new day

---

## Error Handling Matrix

| Error | Stage | Retry | Final Action |
|-------|-------|-------|--------------|
| Browser launch fails | browser | 3x | Show error: "Could not start browser" |
| SSO timeout (5 min) | auth | 0 | Show error: "Login timed out" |
| Ducklink page won't load | scraping | 3x | Show error: "Could not load Ducklink" |
| Event extraction fails | scraping | 3x | Show error: "Scraping failed after 3 attempts" |
| Image download fails | scraping | 2x | Continue with empty imageText |
| OCR fails for image | ocr | 1x | Continue with empty imageText |
| Encryption unavailable | settings | 0 | Show error: "System keychain not available" |
| NVIDIA API key invalid | llm | 0 | Redirect to Settings screen |
| NVIDIA API rate limit | llm | 2x + backoff | Show error: "API rate limited, try later" |
| LLM returns malformed JSON | llm | 2x | Show error: "Food detection failed for batch" |

---

## Environment & Build

### Dev Dependencies

```json
{
  "electron": "^33.x",
  "electron-vite": "^2.x",
  "vite": "^6.x",
  "typescript": "^5.x",
  "@types/react": "^19.x"
}
```

### Production Dependencies

```json
{
  "react": "^19.x",
  "react-dom": "^19.x",
  "playwright": "^1.x",
  "playwright-core": "^1.x",
  "tesseract.js": "^5.x",
  "openai": "^4.x",
  "electron-store": "^10.x",
  "axios": "^1.x"
}
```

> **Note:** `electron-store` handles non-sensitive cached data (events, settings). API keys are stored separately via Electron's built-in `safeStorage` API — no additional dependency required.

### Build Output

```
dist/
├── mac/
│   ├── Ducklink Food Finder.app
│   └── Ducklink Food Finder.dmg
```

### Packaging

- `electron-builder` for .dmg generation
- Code signing with Apple Developer certificate (optional for local use)
- Minimum macOS version: 12 (Monterey)
- Architecture: universal (arm64 + x64)
