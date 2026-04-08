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
