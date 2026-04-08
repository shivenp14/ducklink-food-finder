import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createWorker, Worker } from 'tesseract.js';
import { logger } from '../utils/logger';

const OCR_WORKER_COUNT = 2;
const OCR_CACHE_DIR = path.join(process.env.TEMP || '/tmp', 'ducklink-food-finder-images', 'ocr-cache');

let workers: Worker[] = [];
let workerInitPromise: Promise<Worker[]> | null = null;

function ensureOcrCacheDir(): void {
  if (!fs.existsSync(OCR_CACHE_DIR)) {
    fs.mkdirSync(OCR_CACHE_DIR, { recursive: true });
  }
}

async function createOcrWorker(workerIndex: number): Promise<Worker> {
  return createWorker('eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') {
        logger.debug(`OCR worker ${workerIndex + 1} progress: ${Math.round(m.progress * 100)}%`);
      }
    },
  });
}

export async function initWorkers(): Promise<Worker[]> {
  if (workers.length > 0) return workers;
  if (workerInitPromise) return workerInitPromise;

  workerInitPromise = Promise.all(
    Array.from({ length: OCR_WORKER_COUNT }, (_, index) => createOcrWorker(index))
  );

  workers = await workerInitPromise;
  workerInitPromise = null;

  logger.info(`Initialized ${workers.length} Tesseract workers`);
  return workers;
}

function getImageHash(imagePath: string): string | null {
  try {
    const buffer = fs.readFileSync(imagePath);
    return crypto.createHash('sha1').update(buffer).digest('hex');
  } catch (error) {
    logger.warn(`Failed to hash image for OCR cache ${imagePath}: ${(error as Error).message}`);
    return null;
  }
}

function getOcrCachePath(imageHash: string): string {
  return path.join(OCR_CACHE_DIR, `${imageHash}.txt`);
}

function readCachedText(imagePath: string): string | null {
  ensureOcrCacheDir();
  const imageHash = getImageHash(imagePath);
  if (!imageHash) return null;

  const cachePath = getOcrCachePath(imageHash);
  if (!fs.existsSync(cachePath)) return null;

  try {
    const cached = fs.readFileSync(cachePath, 'utf-8');
    logger.debug(`OCR cache hit for ${imagePath}`);
    return cached;
  } catch (error) {
    logger.warn(`Failed to read OCR cache for ${imagePath}: ${(error as Error).message}`);
    return null;
  }
}

function writeCachedText(imagePath: string, text: string): void {
  if (!text) return;

  ensureOcrCacheDir();
  const imageHash = getImageHash(imagePath);
  if (!imageHash) return;

  try {
    fs.writeFileSync(getOcrCachePath(imageHash), text, 'utf-8');
  } catch (error) {
    logger.warn(`Failed to write OCR cache for ${imagePath}: ${(error as Error).message}`);
  }
}

export async function recognizeText(imagePath: string, worker: Worker): Promise<string> {
  const cached = readCachedText(imagePath);
  if (cached !== null) return cached;

  try {
    const { data } = await worker.recognize(imagePath);
    const cleaned = postProcess(data.text);
    writeCachedText(imagePath, cleaned);
    logger.debug(`OCR result for ${imagePath}: ${cleaned.length} chars`);
    return cleaned;
  } catch (error) {
    logger.warn(`OCR failed for ${imagePath}: ${(error as Error).message}`);
    return '';
  }
}

export async function terminateWorker(): Promise<void> {
  if (workerInitPromise) {
    await workerInitPromise;
  }

  if (workers.length > 0) {
    await Promise.all(workers.map((worker) => worker.terminate()));
    workers = [];
    logger.info('Tesseract workers terminated');
  }
}

function postProcess(rawText: string): string {
  return rawText
    .replace(/\s+/g, ' ')
    .replace(/[^\x20-\x7E]/g, '')
    .trim();
}

export interface EventWithOCR {
  id: string;
  name: string;
  description: string;
  ocrText: string;
  combinedText: string;
}

export type OCRProgressCallback = (current: number, total: number, eventName: string) => void;

export async function processAllImages(
  events: Array<{ id: string; name: string; localImagePath: string | null }>,
  onProgress?: OCRProgressCallback
): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  const eventsWithImages = events.filter((e) => e.localImagePath);

  if (eventsWithImages.length === 0) {
    logger.info('No images to OCR');
    return results;
  }

  logger.info(`Running OCR on ${eventsWithImages.length} images`);

  const workerPool = await initWorkers();
  let nextIndex = 0;
  let completed = 0;

  await Promise.all(
    workerPool.map(async (worker) => {
      while (nextIndex < eventsWithImages.length) {
        const event = eventsWithImages[nextIndex];
        nextIndex += 1;

        const text = await recognizeText(event.localImagePath!, worker);
        if (text) {
          results.set(event.id, text);
        }

        completed += 1;
        onProgress?.(completed, eventsWithImages.length, event.name);
      }
    })
  );

  if (results.size !== 0) {
    logger.info(`OCR cache/results populated for ${results.size} images`);
  }

  logger.info(`OCR complete: ${results.size}/${eventsWithImages.length} images produced text`);
  return results;
}

export function clearOcrCache(): void {
  if (!fs.existsSync(OCR_CACHE_DIR)) {
    return;
  }

  for (const entry of fs.readdirSync(OCR_CACHE_DIR)) {
    const entryPath = path.join(OCR_CACHE_DIR, entry);
    if (fs.statSync(entryPath).isFile()) {
      fs.unlinkSync(entryPath);
    }
  }
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
