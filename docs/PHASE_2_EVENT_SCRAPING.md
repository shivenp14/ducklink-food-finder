# Phase 2: Event Scraping & Extraction

## Goal
After authentication and navigation to the Events tab, scrape all events for the current day from Ducklink. Extract structured event data (name, time, location, description, images) and download images locally for OCR processing in Phase 3.

---

## Milestones

| # | Milestone | Deliverable |
|---|-----------|-------------|
| 2.1 | DOM inspection | Understand Ducklink event page structure |
| 2.2 | Scraper service | Extract event cards from DOM into structured data |
| 2.3 | Image downloader | Download event flyer images to temp directory |
| 2.4 | Pagination handler | Scroll/load all events if page uses lazy loading |
| 2.5 | IPC integration | Wire scraping into scan lifecycle + emit progress |
| 2.6 | Error handling | 3 retries with UI feedback on failure |
| 2.7 | Results display | Show scraped events in ResultsScreen |

---

## 2.1 DOM Inspection Strategy

Ducklink is built on CampusGroups. The exact selectors will be determined during development by inspecting the live page. Common patterns for CampusGroups event pages:

### Expected DOM Patterns

```html
<!-- Event card container -->
<div class="event-card" data-event-id="...">
  <div class="event-image">
    <img src="https://..." alt="Event flyer" />
  </div>
  <div class="event-details">
    <h3 class="event-title">CS Club Meeting</h3>
    <div class="event-time">Mon, Mar 31 · 12:00 PM - 1:30 PM</div>
    <div class="event-location">Babbio Center 104</div>
    <div class="event-description">Join us for our weekly meeting...</div>
  </div>
</div>
```

### Selector Discovery Process

1. Launch app in dev mode, complete auth flow
2. Open DevTools in the Playwright browser window
3. Inspect event card elements
4. Document actual selectors below
5. Build scraper around real selectors

### Selector Mapping Table

| Data Field | CSS Selector (TBD) | Fallback Strategy |
|------------|-------------------|-------------------|
| Event container | `.event-card` or `[data-event-id]` | Search for repeated card-like structures |
| Event title | `.event-title` or `h3` inside card | First heading element |
| Event date | `.event-date` or date header near card | Regex for date patterns (e.g. "Mon, Mar 31") |
| Event time | `.event-time` or time-like text | Regex for time patterns |
| Event location | `.event-location` | Text near location icon |
| Event description | `.event-description` | Remaining text content in card |
| Event image | `img` inside card | First image in card |
| Event link | `a` wrapping card or title | First link in card |

---

## 2.2 Scraper Service

### File: `src/main/services/scraper.ts`

```typescript
import { Page } from 'playwright-core';
import { logger } from '../utils/logger';
import { retryWithBackoff } from '../utils/retry';

export interface ScrapedEvent {
  id: string;
  name: string;
  date: string;            // ISO date (YYYY-MM-DD) of the event
  rawDateText: string;     // original date string from DOM (e.g. "Mon, Mar 31")
  startTime: string;
  endTime: string;
  location: string;
  description: string;
  imageUrl: string | null;
  sourceUrl: string;
}

export async function scrapeEvents(page: Page): Promise<ScrapedEvent[]> {
  logger.info('Starting event scraping...');

  const today = new Date();
  const todayISO = today.toISOString().split('T')[0];
  logger.info(`Filtering events for date: ${todayISO}`);

  // Wait for event cards to appear
  await page.waitForSelector(SELECTORS.eventCard, { timeout: 15000 }).catch(() => {
    logger.warn('Event cards not found with primary selector, trying fallbacks');
  });

  // Scroll to load all events (handle lazy loading)
  await scrollToLoadAll(page);

  // Extract all event data from DOM
  const allEvents = await page.evaluate((selectors) => {
    const cards = document.querySelectorAll(selectors.eventCard);
    return Array.from(cards).map((card, index) => {
      const title = card.querySelector(selectors.title)?.textContent?.trim() || '';
      const dateText = card.querySelector(selectors.date)?.textContent?.trim() || '';
      const timeText = card.querySelector(selectors.time)?.textContent?.trim() || '';
      const location = card.querySelector(selectors.location)?.textContent?.trim() || '';
      const description = card.querySelector(selectors.description)?.textContent?.trim() || '';
      const img = card.querySelector<HTMLImageElement>(selectors.image);
      const link = card.querySelector<HTMLAnchorElement>(selectors.link);

      return {
        id: `event-${index}-${Date.now()}`,
        name: title,
        rawDateText: dateText || timeText, // fallback to time text if no separate date
        startTime: parseStartTime(timeText),
        endTime: parseEndTime(timeText),
        location,
        description,
        imageUrl: img?.src || null,
        sourceUrl: link?.href || '',
      };
    });
  }, SELECTORS);

  logger.info(`Found ${allEvents.length} total events on page`);

  // Filter to only today's events
  const todayEvents = allEvents.filter((event) => {
    const eventDate = parseEventDate(event.rawDateText, today);
    if (!eventDate) {
      logger.debug(`Could not parse date for event: ${event.name} ("${event.rawDateText}")`);
      return false;
    }
    const matches = eventDate === todayISO;
    if (!matches) {
      logger.debug(`Skipping non-today event: ${event.name} (${eventDate} != ${todayISO})`);
    }
    return matches;
  });

  // Attach parsed ISO date to filtered events
  const result = todayEvents.map((event) => ({
    ...event,
    date: todayISO,
  }));

  logger.info(`Filtered to ${result.length} events for today`);
  return result;
}

/**
 * Parse a date string from the DOM into ISO format (YYYY-MM-DD).
 * Handles CampusGroups date formats like:
 *   "Mon, Mar 31"
 *   "Monday, March 31"
 *   "Mar 31, 2026"
 *   "3/31/2026"
 *   "March 31"
 * Falls back to comparing against known month/day patterns.
 */
function parseEventDate(rawDate: string, referenceDate: Date): string | null {
  if (!rawDate) return null;

  const year = referenceDate.getFullYear();

  // Try "Mon, Mar 31" or "Monday, March 31" — no year
  const dayMonthMatch = rawDate.match(
    /\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*,?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2})\b/i
  );
  if (dayMonthMatch) {
    const month = parseMonth(dayMonthMatch[1]);
    const day = parseInt(dayMonthMatch[2], 10);
    if (month !== null) {
      return formatISO(year, month, day);
    }
  }

  // Try "Mar 31" (no day-of-week prefix)
  const shortMatch = rawDate.match(
    /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2})\b/i
  );
  if (shortMatch) {
    const month = parseMonth(shortMatch[1]);
    const day = parseInt(shortMatch[2], 10);
    if (month !== null) {
      return formatISO(year, month, day);
    }
  }

  // Try "3/31" or "3/31/2026" or "03/31/2026"
  const numericMatch = rawDate.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (numericMatch) {
    const month = parseInt(numericMatch[1], 10);
    const day = parseInt(numericMatch[2], 10);
    const yr = numericMatch[3]
      ? numericMatch[3].length === 2
        ? 2000 + parseInt(numericMatch[3], 10)
        : parseInt(numericMatch[3], 10)
      : year;
    return formatISO(yr, month, day);
  }

  return null;
}

function parseMonth(abbr: string): number | null {
  const months: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };
  return months[abbr.toLowerCase().slice(0, 3)] ?? null;
}

function formatISO(year: number, month: number, day: number): string {
  const m = String(month + 1).padStart(2, '0'); // month is 0-indexed
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

async function scrollToLoadAll(page: Page): Promise<void> {
  const MAX_SCROLL_ATTEMPTS = 20;
  let previousHeight = 0;

  for (let i = 0; i < MAX_SCROLL_ATTEMPTS; i++) {
    const currentHeight = await page.evaluate(() => document.body.scrollHeight);

    if (currentHeight === previousHeight) {
      logger.debug(`Scroll complete after ${i + 1} attempts`);
      break;
    }

    previousHeight = currentHeight;
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000); // wait for content to load
  }
}

function parseStartTime(timeText: string): string {
  // Parse patterns like "12:00 PM - 1:30 PM"
  const match = timeText.match(/(\d{1,2}:\d{2}\s*[AP]M)/i);
  return match ? match[1].trim() : '';
}

function parseEndTime(timeText: string): string {
  const match = timeText.match(/-\s*(\d{1,2}:\d{2}\s*[AP]M)/i);
  return match ? match[1].trim() : '';
}
```

### Selector Constants

```typescript
// These will be refined after DOM inspection
const SELECTORS = {
  eventCard: '.cg-eventCard, .event-card, [class*="event"]',
  title: 'h3, h4, .event-title, [class*="title"]',
  date: '.event-date, [class*="date"]',
  time: '.event-time, [class*="time"]',
  location: '.event-location, [class*="location"]',
  description: '.event-description, [class*="description"], p',
  image: 'img',
  link: 'a',
};
```

---

## 2.3 Image Downloader

### File: `src/main/services/imageDownloader.ts`

```typescript
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { app } from 'electron';
import { logger } from '../utils/logger';
import { retryWithBackoff } from '../utils/retry';

const IMAGE_DIR = path.join(app.getPath('temp'), 'ducklink-food-finder-images');

export function ensureImageDir(): void {
  if (!fs.existsSync(IMAGE_DIR)) {
    fs.mkdirSync(IMAGE_DIR, { recursive: true });
  }
}

export async function downloadImage(url: string, eventId: string): Promise<string | null> {
  ensureImageDir();

  const extension = getImageExtension(url);
  const filename = `${eventId}${extension}`;
  const filepath = path.join(IMAGE_DIR, filename);

  try {
    const response = await retryWithBackoff(
      async () => {
        return axios.get(url, {
          responseType: 'arraybuffer',
          timeout: 10000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
          },
        });
      },
      {
        maxRetries: 2,
        baseDelay: 1000,
        maxDelay: 5000,
        backoffMultiplier: 2,
      }
    );

    fs.writeFileSync(filepath, Buffer.from(response.data));
    logger.debug(`Downloaded image: ${filename}`);
    return filepath;
  } catch (error) {
    logger.warn(`Failed to download image for ${eventId}: ${(error as Error).message}`);
    return null;
  }
}

export async function downloadAllImages(
  events: Array<{ id: string; imageUrl: string | null }>
): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  const CONCURRENT_DOWNLOADS = 3;

  const queue = events.filter((e) => e.imageUrl);

  for (let i = 0; i < queue.length; i += CONCURRENT_DOWNLOADS) {
    const batch = queue.slice(i, i + CONCURRENT_DOWNLOADS);
    const downloads = await Promise.all(
      batch.map(async (event) => {
        const localPath = await downloadImage(event.imageUrl!, event.id);
        return { id: event.id, path: localPath };
      })
    );

    for (const d of downloads) {
      if (d.path) results.set(d.id, d.path);
    }
  }

  logger.info(`Downloaded ${results.size} of ${queue.length} images`);
  return results;
}

export function cleanupImages(): void {
  if (fs.existsSync(IMAGE_DIR)) {
    fs.rmSync(IMAGE_DIR, { recursive: true, force: true });
    logger.debug('Cleaned up temp images');
  }
}

function getImageExtension(url: string): string {
  const match = url.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i);
  return match ? `.${match[1].toLowerCase()}` : '.jpg';
}
```

---

## 2.4 Updated Scan Lifecycle

### Updated Flow in `src/main/ipc/handlers.ts`

```
SCAN_START
  → browser (Phase 1)
  → auth if SSO (Phase 1)
  → scraping:
      1. scrapeEvents(page)          // extract DOM data
      2. emitProgress(25%)
      3. downloadAllImages(events)   // download flyers
      4. emitProgress(50%)
      5. return ScrapedEvent[]
  → close browser
  → emitScanComplete()
```

### Updated Handler (relevant section)

```typescript
ipcMain.handle(IPC.SCAN_START, async () => {
  // ... browser launch + auth (Phase 1) ...

  try {
    currentStage = 'scraping';
    emitProgress('scraping', 'Extracting events from page...', 25);

    const events = await retryWithBackoff(
      () => scrapeEvents(page!),
      {
        maxRetries: 3,
        baseDelay: 2000,
        maxDelay: 10000,
        backoffMultiplier: 2,
        onRetry: (attempt, error) => {
          logger.warn(`Scraping retry ${attempt}: ${error.message}`);
          emitError('scraping', error.message, attempt, false);
        },
      }
    );

    if (events.length === 0) {
      throw new Error('No events found on page');
    }

    emitProgress('scraping', `Found ${events.length} events. Downloading images...`, 50);

    const imagePaths = await downloadAllImages(events);

    const eventsWithImages = events.map((e) => ({
      ...e,
      localImagePath: imagePaths.get(e.id) || null,
    }));

    emitProgress('scraping', 'Scraping complete', 100);

    await closeBrowser();

    currentStage = 'done';
    emitScanComplete(eventsWithImages);
  } catch (error) {
    currentStage = 'error';
    const message = (error as Error).message;
    logger.error(`Scraping failed: ${message}`);
    emitError('scraping', 'Scraping failed after 3 attempts. Please try again.', 3, true);
    await closeBrowser();
  }
});
```

### Updated ScanResult Emitter

```typescript
function emitScanComplete(events: ScrapedEvent[]): void {
  mainWindow?.webContents.send(IPC.SCAN_COMPLETE, {
    date: new Date().toISOString().split('T')[0],
    events,
    foodEvents: [], // populated in Phase 4
    scanDuration: 0, // tracked with timer
  });
}
```

---

## 2.5 Temp File Cleanup (App Lifecycle)

Downloaded images accumulate in the OS temp directory. To prevent disk bloat, `cleanupImages()` is hooked to Electron's `will-quit` event in `src/main/index.ts`.

### File: `src/main/index.ts` (updated)

```typescript
import { app, shell, BrowserWindow } from 'electron';
import { join } from 'path';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';
import { registerHandlers } from './ipc/handlers';
import { closeBrowser } from './services/playwright';
import { cleanupImages } from './services/imageDownloader';
import { logger } from './utils/logger';

// ... createWindow(), app.whenReady() unchanged ...

app.on('will-quit', async () => {
  logger.info('App shutting down, cleaning up resources...');
  await closeBrowser();   // kill any lingering Playwright Chromium
  cleanupImages();        // rm -rf temp image directory
});
```

### Cleanup Guarantees

| Trigger | `closeBrowser()` | `cleanupImages()` |
|---------|-------------------|-------------------|
| Normal quit | via IPC cancel / after scan | `will-quit` |
| Cmd+Q / window close | `will-quit` | `will-quit` |
| Crash / force kill | skipped | skipped |

> **Note:** If the app crashes or is force-killed, temp files will persist until the next successful `will-quit` or the OS purges the temp directory. This is acceptable — the temp dir is small per-scan (~1-10 MB) and lives under the system temp path.

---

## 2.6 Results Screen

### File: `src/renderer/src/screens/ResultsScreen.tsx`

```tsx
import { ScrapedEvent } from '../types';

interface Props {
  events: ScrapedEvent[];
  onRescan: () => void;
  onHome: () => void;
}

export default function ResultsScreen({ events, onRescan, onHome }: Props) {
  // Phase 2: show all events unsorted
  // Phase 4: will split into food events + other events

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">
            {events.length} Events Found
          </h1>
          <div className="flex gap-3">
            <button
              onClick={onRescan}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm"
            >
              Rescan
            </button>
            <button
              onClick={onHome}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 rounded-lg text-sm font-semibold"
            >
              Home
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>

        {events.length === 0 && (
          <div className="text-center text-gray-500 mt-12">
            <p className="text-lg">No events found for today</p>
          </div>
        )}
      </div>
    </div>
  );
}

function EventCard({ event }: { event: ScrapedEvent }) {
  return (
    <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
      <div className="flex gap-4">
        {event.imageUrl && (
          <img
            src={event.imageUrl}
            alt={event.name}
            className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-lg truncate">{event.name}</h3>
          <p className="text-sm text-gray-400 mt-1">
            {event.startTime}{event.endTime ? ` - ${event.endTime}` : ''}
          </p>
          {event.location && (
            <p className="text-sm text-gray-400">{event.location}</p>
          )}
          {event.description && (
            <p className="text-sm text-gray-500 mt-2 line-clamp-2">
              {event.description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

## 2.7 Updated Types

### `src/renderer/src/types/index.ts` — Add ScrapedEvent

```typescript
export interface ScrapedEvent {
  id: string;
  name: string;
  date: string;            // ISO date (YYYY-MM-DD)
  rawDateText: string;     // original date string from DOM
  startTime: string;
  endTime: string;
  location: string;
  description: string;
  imageUrl: string | null;
  localImagePath: string | null;
  sourceUrl: string;
}
```

---

## 2.8 Updated App.tsx — Results Flow

```typescript
import ResultsScreen from './screens/ResultsScreen';

// In App component:
const [events, setEvents] = useState<ScrapedEvent[]>([]);

useEffect(() => {
  window.api.onScanComplete((data) => {
    setEvents(data.events);
    setScreen('results');
  });
}, []);

// Add results screen:
{screen === 'results' && (
  <ResultsScreen
    events={events}
    onRescan={() => { scan.reset(); scan.startScan(); }}
    onHome={() => setScreen('home')}
  />
)}
```

---

## Phase 2 Checklist

- [ ] Inspect Ducklink Events page DOM in DevTools
- [ ] Document actual CSS selectors for event cards
- [ ] Update `SELECTORS` constants in scraper.ts
- [ ] Implement `scraper.ts` with `scrapeEvents()`, `scrollToLoadAll()`, time parsing
- [ ] Implement `imageDownloader.ts` with `downloadImage()`, `downloadAllImages()`, `cleanupImages()`
- [ ] Update IPC handlers to include scraping stage
- [ ] Add retry logic (3x for scraping) to handlers
- [ ] Create `ResultsScreen` component
- [ ] Create `EventCard` component
- [ ] Update `App.tsx` with results screen routing
- [ ] Update `types/index.ts` with `ScrapedEvent`
- [ ] Update `ScanResult` type in preload and renderer
- [ ] Test: scan → auth → scrape → display events
- [ ] Test: empty page → shows "No events found"
- [ ] Test: scraping fails → 3 retries → error screen
- [ ] Test: image download failure → continues without image
- [ ] Test: date filtering → only today's events are returned
- [ ] Test: week view with mixed dates → tomorrow's events are excluded
- [ ] Verify `cleanupImages()` runs on app quit

---

## Testing the Phase 2 Flow

1. Launch app → HomeScreen
2. Click "Scan for Events" → Browser opens → Okta SSO
3. Log in → Click Continue → App navigates to Events tab
4. Progress shows "Extracting events from page... 25%"
5. Progress shows "Found X events. Downloading images... 50%"
6. Browser closes → ResultsScreen appears with event list
7. Each event card shows title, time, location, description, image thumbnail
8. Click Rescan → restarts full flow
9. Click Home → returns to HomeScreen

---

## Known Limitations (Phase 2)

- **Selectors are placeholder** — must be refined after inspecting live Ducklink page
- **Date parsing** — regex-based, handles common CampusGroups formats ("Mon, Mar 31", "3/31", "Mar 31, 2026") but may need adjustment for unusual formats
- **Time parsing** — regex-based, may not handle all CampusGroups time formats
- **No event detail pages** — only scrapes listing page; detail page scraping may be needed if descriptions are truncated
- **Scroll strategy** — simple scroll-to-bottom may miss events in other sections/tabs
- **Year assumption** — date parsing assumes events are for the current year; cross-year events (Dec/Jan boundary) may be filtered incorrectly
