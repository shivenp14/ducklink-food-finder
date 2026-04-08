# Phase 3: OCR Pipeline

## Goal
Integrate Tesseract.js to extract text from downloaded event flyer images, combine OCR output with event descriptions into a unified text field for LLM food detection in Phase 4.

---

## Milestones

| # | Milestone | Deliverable |
|---|-----------|-------------|
| 3.1 | OCR service | Tesseract.js wrapper with worker lifecycle management |
| 3.2 | Text post-processing | Clean garbled OCR output into readable text |
| 3.3 | Pipeline integration | Wire OCR into scan lifecycle between scraping and LLM |
| 3.4 | Progress reporting | Per-image progress updates via IPC |
| 3.5 | Error handling | Graceful degradation on OCR failures |
| 3.6 | Combined text field | Merge OCR text + description into `combinedText` for LLM input |

---

## 3.1 OCR Service

### File: `src/main/services/ocr.ts`

```typescript
import { createWorker, Worker } from 'tesseract.js';
import { logger } from '../utils/logger';

let worker: Worker | null = null;

export async function initWorker(): Promise<Worker> {
  if (worker) return worker;

  worker = await createWorker('eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') {
        logger.debug(`OCR progress: ${Math.round(m.progress * 100)}%`);
      }
    },
  });

  logger.info('Tesseract worker initialized');
  return worker;
}

export async function recognizeText(imagePath: string): Promise<string> {
  const w = await initWorker();

  try {
    const { data } = await w.recognize(imagePath);
    const cleaned = postProcess(data.text);
    logger.debug(`OCR result for ${imagePath}: ${cleaned.length} chars`);
    return cleaned;
  } catch (error) {
    logger.warn(`OCR failed for ${imagePath}: ${(error as Error).message}`);
    return '';
  }
}

export async function terminateWorker(): Promise<void> {
  if (worker) {
    await worker.terminate();
    worker = null;
    logger.info('Tesseract worker terminated');
  }
}

function postProcess(rawText: string): string {
  return rawText
    .replace(/\s+/g, ' ')         // collapse whitespace
    .replace(/[^\x20-\x7E]/g, '') // remove non-printable chars
    .trim();
}
```

### Worker Lifecycle

```
initWorker()
  → create Tesseract worker (loads WASM + eng traineddata)
  → cached in module-level variable
  → reused across all images in a scan

recognizeText(path)
  → calls worker.recognize(path)
  → returns cleaned text string
  → returns '' on failure (non-blocking)

terminateWorker()
  → worker.terminate()
  → frees WASM memory
  → called after all images processed + on app quit
```

---

## 3.2 Batch OCR Processor

### File: `src/main/services/ocr.ts` (continued)

```typescript
import { recognizeText } from './ocr';
import { logger } from '../utils/logger';

export interface OCRResult {
  eventId: string;
  ocrText: string;
}

export type OCRProgressCallback = (current: number, total: number, eventName: string) => void;

export async function processAllImages(
  events: Array<{ id: string; name: string; localImagePath: string | null }>,
  onProgress?: OCRProgressCallback
): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  const eventsWithImages = events.filter((e) => e.localImagePath);

  logger.info(`Running OCR on ${eventsWithImages.length} images`);

  for (let i = 0; i < eventsWithImages.length; i++) {
    const event = eventsWithImages[i];
    onProgress?.(i + 1, eventsWithImages.length, event.name);

    const text = await recognizeText(event.localImagePath!);
    if (text) {
      results.set(event.id, text);
    }
  }

  logger.info(`OCR complete: ${results.size}/${eventsWithImages.length} images produced text`);
  return results;
}
```

### Why Sequential Processing

| Approach | Pros | Cons |
|----------|------|------|
| Sequential | Low memory, stable | Slower for many images |
| Parallel (2-3x) | Faster | Memory spikes, WASM contention |

> **Decision:** Sequential. Most scans have < 20 images. Each OCR takes ~1-3 seconds. Total overhead is acceptable. Avoids WASM memory issues.

---

## 3.3 Text Combiner

### File: `src/main/services/ocr.ts` (continued)

The combined text is what gets sent to the LLM in Phase 4. It merges the event description with any OCR-extracted text from flyers.

```typescript
export interface EventWithOCR {
  id: string;
  name: string;
  description: string;
  ocrText: string;
  combinedText: string;   // description + ocrText merged
}

export function combineTextForLLM(
  event: { id: string; name: string; description: string },
  ocrText: string
): EventWithOCR {
  const parts: string[] = [];

  if (event.description) {
    parts.push(`Description: ${event.description}`);
  }

  if (ocrText) {
    parts.push(`Image Text (OCR): ${ocrText}`);
  }

  return {
    ...event,
    ocrText,
    combinedText: parts.join('\n'),
  };
}
```

### Combined Text Example

```
Input:
  description: "Join us for our weekly meeting! Chipotle will be provided."
  ocrText: "FREE PIZZA 12PM BABBIO CENTER"

Output:
  combinedText: "Description: Join us for our weekly meeting! Chipotle will be provided.\nImage Text (OCR): FREE PIZZA 12PM BABBIO CENTER"
```

---

## 3.4 Updated Scan Lifecycle

### Flow Integration in `src/main/ipc/handlers.ts`

```
SCAN_START
  → browser (Phase 1)
  → auth if SSO (Phase 1)
  → scraping (Phase 2)
      1. scrapeEvents(page)
      2. downloadAllImages(events)
      3. emitProgress(40%)
  → ocr (Phase 3)
      1. processAllImages(events, onProgress)
      2. combineTextForLLM() for each event
      3. emitProgress(60%)
  → close browser
  → emitScanComplete()
```

### Updated Handler (OCR section)

```typescript
import { processAllImages, combineTextForLLM, terminateWorker } from '../services/ocr';

// Inside scan handler, after scraping + image download:

emitProgress('ocr', 'Running OCR on event images...', 40);

const ocrTexts = await processAllImages(eventsWithImages, (current, total, eventName) => {
  emitProgress('ocr', `Reading image ${current}/${total}: ${eventName}`, 40 + Math.round((current / total) * 20));
});

const eventsWithOCR = eventsWithImages.map((event) => {
  const ocrText = ocrTexts.get(event.id) || '';
  return combineTextForLLM(event, ocrText);
});

emitProgress('ocr', 'OCR complete', 60);

// Phase 4 will continue from eventsWithOCR...
```

---

## 3.5 Progress Reporting

### Stage Breakdown

| Stage | Progress Range | Message |
|-------|---------------|---------|
| browser | 0-10% | "Starting browser..." |
| auth | 10-15% | "Waiting for login..." |
| scraping | 15-35% | "Extracting events..." |
| image download | 35-40% | "Downloading images..." |
| ocr | 40-60% | "Running OCR on event images..." |
| ocr (per image) | 40-60% | "Reading image 3/12: CS Club Meeting" |
| llm | 60-90% | (Phase 4) |
| done | 100% | "Scan complete" |

### Updated ProgressData

```typescript
interface ProgressData {
  stage: 'browser' | 'auth' | 'scraping' | 'ocr' | 'llm' | 'done';
  message: string;
  progress: number;        // 0-100
  current?: number;        // current item (e.g., image 3 of 12)
  total?: number;          // total items
}
```

---

## 3.6 Error Handling

### OCR Failure Modes

| Failure | Handling | Impact |
|---------|----------|--------|
| Worker fails to init | Retry once, then error | Scan stops |
| Single image OCR fails | Return empty string | Event continues with no OCR text |
| Image file corrupted | Return empty string | Event continues with no OCR text |
| Worker crashes mid-scan | Re-init worker, continue | Minimal impact |
| All images fail | Continue to LLM with description-only | LLM still works, less accurate |

### Updated Error Matrix

```typescript
// In processAllImages:
try {
  const text = await recognizeText(event.localImagePath!);
  // ...
} catch (error) {
  logger.warn(`OCR failed for ${event.name}, continuing without OCR text`);
  // Don't throw — graceful degradation
}

// In scan handler:
try {
  await initWorker();
} catch (error) {
  throw new Error('Failed to initialize OCR engine. Please restart the app.');
}
```

---

## 3.7 App Lifecycle Integration

### Updated `src/main/index.ts`

```typescript
import { terminateWorker } from './services/ocr';
import { cleanupImages } from './services/imageDownloader';
import { closeBrowser } from './services/playwright';

app.on('will-quit', async () => {
  logger.info('App shutting down, cleaning up resources...');
  await closeBrowser();
  await terminateWorker();  // free Tesseract WASM
  cleanupImages();          // rm temp images
});
```

### Cleanup Guarantees

| Trigger | `terminateWorker()` | `cleanupImages()` |
|---------|---------------------|-------------------|
| Normal quit | `will-quit` | `will-quit` |
| Cmd+Q | `will-quit` | `will-quit` |
| Crash | skipped | skipped |

---

## 3.8 Updated Types

### `src/renderer/src/types/index.ts` — Add OCR fields

```typescript
export interface Event {
  id: string;
  name: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  description: string;
  imageUrl: string | null;
  localImagePath: string | null;
  ocrText: string;           // raw OCR output
  combinedText: string;      // description + OCR, for LLM
  hasFood: boolean;
  foodReasoning: string;
  sourceUrl: string;
}
```

---

## 3.9 IPC Channel Addition

### Updated `src/main/ipc/channels.ts`

No new channels needed — OCR progress uses existing `scan:progress` channel with `stage: 'ocr'`.

---

## 3.10 Dependencies Verification

### Required Packages (already installed in Phase 1)

```json
{
  "tesseract.js": "^5.x"
}
```

No additional dependencies needed. Tesseract.js bundles its own WASM runtime and English traineddata.

---

## Phase 3 Checklist

- [ ] Implement `ocr.ts` service with `initWorker()`, `recognizeText()`, `terminateWorker()`
- [ ] Implement `processAllImages()` batch processor with progress callback
- [ ] Implement `combineTextForLLM()` text merger
- [ ] Implement `postProcess()` OCR text cleaner
- [ ] Wire OCR stage into IPC handlers between scraping and LLM
- [ ] Update progress reporting with per-image OCR messages
- [ ] Update `will-quit` handler to call `terminateWorker()`
- [ ] Update `Event` type with `ocrText` and `combinedText` fields
- [ ] Update `ScrapedEvent` → `Event` transition to include OCR fields
- [ ] Test: image with clear text → OCR extracts text correctly
- [ ] Test: image with no text → returns empty string, scan continues
- [ ] Test: corrupted image → returns empty string, scan continues
- [ ] Test: OCR worker crash → re-init and continue
- [ ] Test: no images on any event → OCR stage skips, scan continues
- [ ] Test: progress shows "Reading image X/Y: Event Name"
- [ ] Test: app quit → verify worker terminated

---

## Testing the Phase 3 Flow

1. Complete Phase 1 + 2 flow (auth → scrape → download images)
2. After image download, progress shows "Running OCR on event images... 40%"
3. Progress updates: "Reading image 1/5: CS Club Meeting" at 42%, "Reading image 2/5: Guest Speaker" at 44%, etc.
4. OCR completes at 60%
5. Events now contain `ocrText` and `combinedText` fields
6. App quit → verify no lingering Tesseract processes in Activity Monitor

### Sample OCR Output

```
Input image: flyer with "FREE PIZZA 12PM BABBIO CENTER"
OCR output: "FREE PIZZA 12PM BABBIO CENTER"

Event description: "Weekly CS meeting with guest speaker"
Combined text: "Description: Weekly CS meeting with guest speaker\nImage Text (OCR): FREE PIZZA 12PM BABBIO CENTER"
```

---

## Known Limitations (Phase 3)

- **Language support** — English only. Event flyers in other languages will produce garbled text
- **Image quality** — Low-res or blurry flyers may produce poor OCR results
- **Handwritten text** — Tesseract is optimized for printed text; handwritten flyers will likely fail
- **PDF flyers** — Only processes image files (jpg, png, gif, webp). PDF flyers are not handled
- **Sequential processing** — Slower than parallel for large image batches, but avoids WASM memory issues
- **No caching** — OCR results are not cached between scans; re-scanning re-processes all images
- **Text layout** — Complex multi-column flyer layouts may produce jumbled text order
