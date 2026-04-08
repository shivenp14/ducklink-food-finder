import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { logger } from '../utils/logger';

interface CacheData {
  date: string;
  timestamp: number;
  events: unknown[];
  foodEvents: unknown[];
  scanDurationMs: number;
}

const getCachePath = (): string => {
  return path.join(app.getPath('userData'), 'ducklink-cache.json');
};

function loadCache(): CacheData | null {
  try {
    const filePath = getCachePath();
    if (!fs.existsSync(filePath)) return null;
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

function saveCacheToFile(data: CacheData): void {
  try {
    const filePath = getCachePath();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (error) {
    logger.error('Failed to save cache:', error);
  }
}

export function getCachedScan(): CacheData | null {
  const cached = loadCache();
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

  const data: CacheData = {
    date: today,
    timestamp: Date.now(),
    events,
    foodEvents,
    scanDurationMs,
  };

  saveCacheToFile(data);
  logger.info(`Cached ${events.length} events for ${today}`);
}

export function clearCache(): void {
  try {
    const filePath = getCachePath();
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    logger.info('Cache cleared');
  } catch (error) {
    logger.error('Failed to clear cache:', error);
  }
}

export function getCacheInfo(): { date: string; eventCount: number; timestamp: number } | null {
  const cached = loadCache();
  if (!cached) return null;

  return {
    date: cached.date,
    eventCount: cached.events.length,
    timestamp: cached.timestamp,
  };
}
