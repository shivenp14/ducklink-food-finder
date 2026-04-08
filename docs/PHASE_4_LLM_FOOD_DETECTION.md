# Phase 4: LLM Food Detection

## Goal
Integrate NVIDIA NIM (Llama 3.1 8B) to classify scraped events as having free food or not. Feed combined description + OCR text to the LLM, parse structured responses, sort results with food events pinned at top, and display food badges in the UI.

---

## Milestones

| # | Milestone | Deliverable |
|---|-----------|-------------|
| 4.1 | LLM service | NVIDIA NIM client via OpenAI SDK with batching |
| 4.2 | Food detector | Orchestrate LLM calls, merge results into events |
| 4.3 | Pipeline integration | Wire LLM into scan lifecycle after OCR |
| 4.4 | Response validation | Parse and validate structured JSON from LLM |
| 4.5 | Result sorting | Food events first, then by start time |
| 4.6 | UI updates | Food badge, food section in ResultsScreen |
| 4.7 | Error handling | Retry batches, graceful degradation on LLM failure |

---

## 4.1 LLM Service

### File: `src/main/services/llm.ts`

```typescript
import OpenAI from 'openai';
import { getApiKey } from './secureStore';
import { logger } from '../utils/logger';
import { retryWithBackoff } from '../utils/retry';

const NVIDIA_API_BASE = 'https://integrate.api.nvidia.com/v1';
const MODEL = 'meta/llama-3.1-8b-instruct';

function getClient(): OpenAI {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('NVIDIA API key not configured. Please set it in Settings.');
  }

  return new OpenAI({
    apiKey,
    baseURL: NVIDIA_API_BASE,
  });
}

const SYSTEM_PROMPT = `You are a food detection classifier for university events.
Analyze the provided events and determine if free food will be available.
Consider direct mentions AND indirect references:
- Restaurant names (Chipotle, Domino's, Panera, etc.)
- "Catered", "provided by", "sponsored by [restaurant]"
- Food items (pizza, donuts, bagels, tacos, sandwiches, etc.)
- "Free", "complimentary" combined with any food reference
- Food-related emojis (🍕, 🍔, 🌮, etc.)

Respond ONLY with valid JSON. No explanation outside the JSON.`;

export interface LLMBatchInput {
  index: number;
  title: string;
  description: string;
  imageText: string;
}

export interface LLMResult {
  index: number;
  hasFood: boolean;
  reasoning: string;
}

export async function classifyBatch(events: LLMBatchInput[]): Promise<LLMResult[]> {
  const client = getClient();

  const payload = { events };

  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Classify each event for free food availability.\n\nInput:\n${JSON.stringify(payload, null, 2)}\n\nRespond with JSON in this exact format:\n{"results": [{"index": <number>, "hasFood": <boolean>, "reasoning": "<string>"}]}`,
      },
    ],
    temperature: 0.1,
    max_tokens: 1024,
  });

  const raw = response.choices[0]?.message?.content || '';
  return parseAndValidateLLMResponse(raw, events.length);
}

export async function classifyBatchWithRetry(events: LLMBatchInput[]): Promise<LLMResult[]> {
  return retryWithBackoff(
    () => classifyBatch(events),
    {
      maxRetries: 2,
      baseDelay: 1000,
      maxDelay: 5000,
      backoffMultiplier: 2,
      onRetry: (attempt, error) => {
        logger.warn(`LLM batch retry ${attempt}: ${error.message}`);
      },
    }
  );
}

function parseAndValidateLLMResponse(raw: string, batchSize: number): LLMResult[] {
  // Extract JSON from response (may have surrounding text)
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in LLM response');
  }

  const parsed = JSON.parse(jsonMatch[0]);

  if (!Array.isArray(parsed.results)) {
    throw new Error('LLM response missing "results" array');
  }

  if (parsed.results.length !== batchSize) {
    throw new Error(`Batch size mismatch: expected ${batchSize}, got ${parsed.results.length}`);
  }

  const results: LLMResult[] = [];

  for (const r of parsed.results) {
    if (typeof r.index !== 'number') {
      throw new Error('LLM result missing "index" field');
    }
    if (typeof r.hasFood !== 'boolean') {
      throw new Error(`LLM result at index ${r.index} missing "hasFood" boolean`);
    }
    if (typeof r.reasoning !== 'string') {
      r.reasoning = ''; // tolerate missing reasoning
    }

    results.push({
      index: r.index,
      hasFood: r.hasFood,
      reasoning: r.reasoning,
    });
  }

  return results;
}
```

### Why OpenAI SDK

The `openai` package (already in `package.json`) provides a typed, ergonomic client. NVIDIA NIM exposes an OpenAI-compatible endpoint, so no custom HTTP client is needed.

### API Configuration

| Setting | Value |
|---------|-------|
| Base URL | `https://integrate.api.nvidia.com/v1` |
| Model | `meta/llama-3.1-8b-instruct` |
| Temperature | `0.1` (low for consistent classification) |
| Max tokens | `1024` |
| Response format | JSON object (enforced via prompt) |

---

## 4.2 Food Detector Service

### File: `src/main/services/foodDetector.ts`

```typescript
import { logger } from '../utils/logger';
import { classifyBatchWithRetry, LLMBatchInput, LLMResult } from './llm';

export interface EventForClassification {
  id: string;
  name: string;
  description: string;
  ocrText: string;
  combinedText: string;
  [key: string]: unknown; // preserve other fields
}

export interface ClassifiedEvent extends EventForClassification {
  hasFood: boolean;
  foodReasoning: string;
}

export type FoodDetectorProgressCallback = (
  currentBatch: number,
  totalBatches: number,
  eventsInBatch: number
) => void;

const BATCH_SIZE = 5;

export async function detectFood(
  events: EventForClassification[],
  onProgress?: FoodDetectorProgressCallback
): Promise<ClassifiedEvent[]> {
  if (events.length === 0) {
    logger.info('No events to classify');
    return events.map((e) => ({ ...e, hasFood: false, foodReasoning: '' }));
  }

  const batches = chunkEvents(events, BATCH_SIZE);
  const results: ClassifiedEvent[] = [];

  logger.info(`Classifying ${events.length} events in ${batches.length} batches`);

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    onProgress?.(i + 1, batches.length, batch.length);

    const inputs: LLMBatchInput[] = batch.map((event, localIndex) => ({
      index: localIndex,
      title: event.name,
      description: event.description,
      imageText: event.ocrText,
    }));

    try {
      const batchResults = await classifyBatchWithRetry(inputs);

      for (const r of batchResults) {
        const original = batch[r.index];
        results.push({
          ...original,
          hasFood: r.hasFood,
          foodReasoning: r.reasoning,
        });
      }
    } catch (error) {
      logger.error(`LLM batch ${i + 1} failed after retries: ${(error as Error).message}`);
      // Graceful degradation: mark batch as no food
      for (const event of batch) {
        results.push({
          ...event,
          hasFood: false,
          foodReasoning: 'Food detection failed for this batch',
        });
      }
    }
  }

  const foodCount = results.filter((e) => e.hasFood).length;
  logger.info(`Classification complete: ${foodCount}/${results.length} events have food`);

  return results;
}

export function sortEventsByFood(events: ClassifiedEvent[]): ClassifiedEvent[] {
  return [...events].sort((a, b) => {
    // Food events first
    if (a.hasFood && !b.hasFood) return -1;
    if (!a.hasFood && b.hasFood) return 1;

    // Within same food category, sort by start time
    return compareTime(a.startTime, b.startTime);
  });
}

function chunkEvents<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function compareTime(a: string, b: string): number {
  // Handle empty times
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;

  const toMinutes = (t: string): number => {
    const match = t.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!match) return 9999;
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const period = match[3].toUpperCase();
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
  };

  return toMinutes(a) - toMinutes(b);
}
```

### Batch Sizing Rationale

| Batch Size | Pros | Cons |
|-----------|------|------|
| 1 | Simplest, per-event retry | Many API calls, high latency |
| 5 (chosen) | Fewer calls, good balance | One bad event can fail batch |
| 10+ | Fewest calls | Higher token usage, more likely malformed response |

> **Decision:** Batch size of 5. Most scans have < 20 events, so 4 API calls max. Combined with retry (2x per batch), this provides good latency and reliability.

---

## 4.3 Updated Scan Lifecycle

### Updated Flow in `src/main/ipc/handlers.ts`

```
SCAN_START
  → browser (Phase 1)
  → auth if SSO (Phase 1)
  → scraping (Phase 2)
      1. scrapeEvents(page)
      2. downloadAllImages(events)
      3. emitProgress(40%)
  → ocr (Phase 3)
      1. processAllImages(events)
      2. combineTextForLLM()
      3. emitProgress(60%)
  → llm (Phase 4)
      1. detectFood(events, onProgress)
      2. sortEventsByFood(events)
      3. emitProgress(90%)
  → close browser
  → cache results
  → emitScanComplete()
```

### Updated Handler (LLM section added to `runScraping`)

After the OCR stage in `handlers.ts`, add:

```typescript
import { detectFood, sortEventsByFood, ClassifiedEvent } from '../services/foodDetector';

// After OCR complete (60%), add LLM stage:

currentStage = 'llm';
emitProgress('llm', 'Detecting free food with AI...', 60);

const classifiedEvents = await detectFood(
  eventsWithOCR as EventForClassification[],
  (currentBatch, totalBatches, eventsInBatch) => {
    const llmProgress = 60 + Math.round((currentBatch / totalBatches) * 30);
    emitProgress('llm', `Analyzing batch ${currentBatch}/${totalBatches} (${eventsInBatch} events)...`, llmProgress);
  }
);

const sortedEvents = sortEventsByFood(classifiedEvents);
const foodEvents = sortedEvents.filter((e) => e.hasFood);

emitProgress('llm', 'Food detection complete', 90);

await closeBrowser();

const scanDuration = Date.now() - scanStartTime;
currentStage = 'done';
emitScanComplete(sortedEvents, foodEvents, scanDuration);
```

### Updated `emitScanComplete`

```typescript
function emitScanComplete(
  events: ClassifiedEvent[],
  foodEvents: ClassifiedEvent[],
  scanDuration: number
): void {
  mainWindow?.webContents.send(IPC.SCAN_COMPLETE, {
    date: new Date().toISOString().split('T')[0],
    events,
    foodEvents,
    scanDuration,
  });
}
```

### Updated ScanStage Type

```typescript
type ScanStage = 'idle' | 'browser' | 'auth' | 'scraping' | 'ocr' | 'llm' | 'done' | 'error';
```

---

## 4.4 Progress Reporting (Updated)

### Full Stage Breakdown

| Stage | Progress Range | Message |
|-------|---------------|---------|
| browser | 0-10% | "Starting browser..." |
| auth | 10-15% | "Waiting for login..." |
| scraping | 15-35% | "Extracting events..." |
| image download | 35-40% | "Downloading images..." |
| ocr | 40-60% | "Running OCR on event images..." |
| llm | 60-90% | "Detecting free food with AI..." |
| llm (per batch) | 60-90% | "Analyzing batch 1/4 (5 events)..." |
| done | 100% | "Scan complete" |

---

## 4.5 Updated Types

### `src/renderer/src/types/index.ts` — Add `hasFood`, `foodReasoning`, update `ScrapedEvent`

```typescript
export interface ScrapedEvent {
  id: string;
  name: string;
  date: string;
  rawDateText: string;
  startTime: string;
  endTime: string;
  location: string;
  description: string;
  imageUrl: string | null;
  localImagePath: string | null;
  ocrText: string;
  combinedText: string;
  hasFood: boolean;          // NEW — set by LLM
  foodReasoning: string;     // NEW — LLM reasoning
  sourceUrl: string;
}

export interface ScanResult {
  date: string;
  events: ScrapedEvent[];       // all events, sorted (food first)
  foodEvents: ScrapedEvent[];   // only food events
  scanDuration: number;
}
```

### Updated `src/preload/index.d.ts`

No changes to channel definitions — `scan:complete` payload already carries `events` and `foodEvents`. The `unknown[]` types in `ScanResult` will be cast to `ScrapedEvent[]` in the renderer hook.

---

## 4.6 UI Updates

### Updated `src/renderer/src/screens/ResultsScreen.tsx`

```tsx
import { ScrapedEvent } from '../types';

interface Props {
  events: ScrapedEvent[];
  foodEvents: ScrapedEvent[];
  onRescan: () => void;
  onHome: () => void;
}

export default function ResultsScreen({ events, foodEvents, onRescan, onHome }: Props) {
  const otherEvents = events.filter((e) => !e.hasFood);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">{events.length} Events Found</h1>
          <div className="flex gap-3">
            <button
              onClick={onRescan}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm cursor-pointer"
            >
              Rescan
            </button>
            <button
              onClick={onHome}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 rounded-lg text-sm font-semibold cursor-pointer"
            >
              Home
            </button>
          </div>
        </div>

        {/* Food Events Section */}
        {foodEvents.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-orange-400 mb-3 flex items-center gap-2">
              🍕 Free Food ({foodEvents.length})
            </h2>
            <div className="space-y-4">
              {foodEvents.map((event) => (
                <EventCard key={event.id} event={event} showFoodBadge />
              ))}
            </div>
          </div>
        )}

        {/* Other Events Section */}
        {otherEvents.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-400 mb-3">
              📅 Other Events ({otherEvents.length})
            </h2>
            <div className="space-y-4">
              {otherEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          </div>
        )}

        {events.length === 0 && (
          <div className="text-center text-gray-500 mt-12">
            <p className="text-lg">No events found for today</p>
          </div>
        )}
      </div>
    </div>
  );
}

function EventCard({ event, showFoodBadge = false }: { event: ScrapedEvent; showFoodBadge?: boolean }) {
  return (
    <div className={`bg-gray-900 rounded-xl p-4 border ${showFoodBadge ? 'border-orange-500/40' : 'border-gray-800'}`}>
      <div className="flex gap-4">
        {event.imageUrl && (
          <img
            src={event.imageUrl}
            alt={event.name}
            className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-lg truncate">{event.name}</h3>
            {showFoodBadge && (
              <FoodBadge />
            )}
          </div>
          <p className="text-sm text-gray-400 mt-1">
            {event.startTime}
            {event.endTime ? ` - ${event.endTime}` : ''}
          </p>
          {event.location && <p className="text-sm text-gray-400">{event.location}</p>}
          {event.description && (
            <p className="text-sm text-gray-500 mt-2 line-clamp-2">{event.description}</p>
          )}
          {showFoodBadge && event.foodReasoning && (
            <p className="text-xs text-orange-400/70 mt-2 italic">{event.foodReasoning}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function FoodBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-500/20 text-orange-400 text-xs font-medium rounded-full">
      🍕 Free Food
    </span>
  );
}
```

### Updated `src/renderer/src/App.tsx`

Update `ResultsScreen` props to pass `foodEvents`:

```tsx
{screen === 'results' && (
  <ResultsScreen
    events={scan.events}
    foodEvents={scan.foodEvents}
    onRescan={() => {
      scan.reset();
      scan.startScan();
    }}
    onHome={() => {
      scan.reset();
      setScreen('home');
    }}
  />
)}
```

### Updated `src/renderer/src/hooks/useScan.ts`

Add `foodEvents` state, extracted from scan complete payload:

```typescript
const [foodEvents, setFoodEvents] = useState<ScrapedEvent[]>([]);

// In onScanComplete handler:
window.api.onScanComplete((data) => {
  setEvents(data.events as ScrapedEvent[]);
  setFoodEvents(data.foodEvents as ScrapedEvent[]);
  setState('done');
});

// In reset and cancelScan:
setFoodEvents([]);

// Return:
return { state, progress, error, events, foodEvents, startScan, continueScan, cancelScan, reset };
```

---

## 4.7 Updated Preload

### `src/preload/index.ts`

Update `ScanResultData` to include `foodEvents`:

```typescript
interface ScanResultData {
  date: string;
  events: unknown[];
  foodEvents: unknown[];
  scanDuration: number;
}
```

This is already the case — the current implementation already passes `foodEvents` through `scan:complete`.

---

## 4.8 Error Handling

### LLM Failure Modes

| Failure | Handling | Impact |
|---------|----------|--------|
| API key missing | Throw error immediately | Redirect to Settings |
| API key invalid | Throw 401 error | Show error, redirect to Settings |
| Rate limit (429) | Retry 2x with backoff | Delayed scan |
| Malformed JSON | Retry 2x (re-prompt LLM) | Delayed scan |
| Batch fails after retries | Mark batch as `hasFood: false` | Events shown without food detection |
| All batches fail | All events shown as non-food | Scan completes, no food highlights |
| Network error | Retry 2x with backoff | Delayed scan |

### API Key Validation

```typescript
// In handlers.ts, before LLM stage:
if (!hasApiKey()) {
  throw new Error('NVIDIA API key not configured. Please set it in Settings.');
}
```

### Graceful Degradation

If LLM fails for a batch, those events are marked `hasFood: false` with reasoning `"Food detection failed for this batch"`. The scan completes successfully — food events from successful batches are still highlighted.

---

## 4.9 App Lifecycle

No new cleanup needed. The `openai` client is stateless (no persistent connections). The existing `will-quit` handler already covers browser and OCR worker cleanup.

---

## Phase 4 Checklist

- [ ] Implement `llm.ts` service with `classifyBatch()`, `classifyBatchWithRetry()`, `parseAndValidateLLMResponse()`
- [ ] Implement `foodDetector.ts` service with `detectFood()`, `sortEventsByFood()`, `chunkEvents()`
- [ ] Add `hasFood` and `foodReasoning` fields to `ScrapedEvent` in scraper.ts
- [ ] Update IPC handlers with LLM stage in `runScraping()`
- [ ] Update `emitScanComplete()` to pass `foodEvents` array
- [ ] Update `ScanStage` type to include `'llm'`
- [ ] Update `useScan` hook with `foodEvents` state
- [ ] Update `ResultsScreen` with food/other sections and `FoodBadge` component
- [ ] Update `App.tsx` to pass `foodEvents` prop
- [ ] Add API key check before LLM stage in handlers
- [ ] Test: event with "free pizza" in description → `hasFood: true`
- [ ] Test: event with no food references → `hasFood: false`
- [ ] Test: event with OCR text mentioning food → `hasFood: true`
- [ ] Test: no API key → error message, redirect to Settings
- [ ] Test: invalid API key → 401 error shown
- [ ] Test: LLM returns malformed JSON → retry, then graceful degradation
- [ ] Test: batch fails after retries → events marked `hasFood: false`
- [ ] Test: results sorted food-first, then by time
- [ ] Test: food badge appears on food events
- [ ] Test: progress shows "Analyzing batch X/Y (N events)..."
- [ ] Test: food reasoning shown under food event cards

---

## Testing the Phase 4 Flow

1. Complete Phase 1-3 flow (auth → scrape → OCR)
2. Progress shows "Detecting free food with AI... 60%"
3. Progress updates: "Analyzing batch 1/4 (5 events)..." at 67%, "Analyzing batch 2/4 (5 events)..." at 75%, etc.
4. LLM completes at 90%
5. Scan completes, ResultsScreen shows two sections:
   - "🍕 Free Food (3)" — food events with orange border and badge
   - "📅 Other Events (12)" — remaining events
6. Each food event shows `foodReasoning` in small italic text
7. Click Rescan → restarts full flow
8. Click Home → returns to HomeScreen

---

## Sample LLM Interaction

### Input (batch of 3 events)

```json
{
  "events": [
    {
      "index": 0,
      "title": "CS Club Weekly Meeting",
      "description": "Join us for our weekly meeting! Chipotle will be provided.",
      "imageText": ""
    },
    {
      "index": 1,
      "title": "Guest Speaker: AI in Healthcare",
      "description": "Dr. Smith presents latest research on ML applications.",
      "imageText": ""
    },
    {
      "index": 2,
      "title": "Career Fair Prep Workshop",
      "description": "Learn how to network at career fairs.",
      "imageText": "FREE DONUTS AND COFFEE BABBIO 2ND FLOOR"
    }
  ]
}
```

### Expected LLM Response

```json
{
  "results": [
    {
      "index": 0,
      "hasFood": true,
      "reasoning": "Description mentions Chipotle will be provided, indicating catering"
    },
    {
      "index": 1,
      "hasFood": false,
      "reasoning": "No food references in description or image text"
    },
    {
      "index": 2,
      "hasFood": true,
      "reasoning": "OCR text from event image mentions free donuts and coffee"
    }
  ]
}
```

### Result After Sorting

```
🍕 Free Food (2)
  ├── CS Club Weekly Meeting — 12:00 PM  [🍕 Free Food]
  │   "Chipotle catering mentioned"
  └── Career Fair Prep Workshop — 2:00 PM  [🍕 Free Food]
      "OCR text mentions free donuts and coffee"

📅 Other Events (1)
  └── Guest Speaker: AI in Healthcare — 3:00 PM
```

---

## Dependencies

No new dependencies required. Uses existing:
- `openai` (already in `package.json`) — NVIDIA NIM client
- `axios` — not needed for LLM (openai SDK handles HTTP)
- `retryWithBackoff` (already in `src/main/utils/retry.ts`)

---

## Known Limitations (Phase 4)

- **Prompt injection risk** — Event descriptions come from user-generated content on Ducklink. A malicious event description could attempt to override the system prompt. Mitigated by low temperature and structured output format, but not eliminated.
- **LLM hallucination** — The model may incorrectly classify events. Low temperature (0.1) reduces but doesn't eliminate this.
- **Batch boundary issues** — If a batch fails, all events in that batch are marked `hasFood: false`. A better approach would be to retry individual events, but this adds complexity.
- **No caching of LLM results** — Re-scanning re-runs LLM classification. Future optimization: cache results by event content hash.
- **English-only** — LLM prompt and OCR are English-only. Events in other languages may be misclassified.
- **API cost** — Each scan consumes tokens. With batch size 5 and ~20 events, each scan uses ~4 API calls. Free tier should handle this, but monitoring is needed.
- **Reasoning quality** — LLM reasoning strings may be generic or unhelpful. Prompt refinement may be needed after observing real results.
