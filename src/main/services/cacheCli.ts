import fs from 'fs';
import path from 'path';
import os from 'os';

interface CacheData {
  date: string;
  timestamp: number;
  events: unknown[];
  foodEvents: unknown[];
  scanDurationMs: number;
}

const CACHE_DIR = path.join(os.homedir(), '.ducklink-food-finder');
const CACHE_PATH = path.join(CACHE_DIR, 'cache.json');

function loadCache(): CacheData | null {
  try {
    if (!fs.existsSync(CACHE_PATH)) return null;
    const data = fs.readFileSync(CACHE_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

function saveCacheToFile(data: CacheData): void {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
  fs.writeFileSync(CACHE_PATH, JSON.stringify(data, null, 2));
}

export function getCachedScan(): CacheData | null {
  const cached = loadCache();
  if (!cached) return null;

  const today = new Date().toISOString().split('T')[0];
  if (cached.date !== today) {
    console.log(`Cache expired: cached=${cached.date}, today=${today}`);
    clearCache();
    return null;
  }

  console.log(`Cache hit: ${cached.events.length} events from ${cached.date}`);
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
  console.log(`Cached ${events.length} events for ${today}`);
}

export function clearCache(): void {
  if (fs.existsSync(CACHE_PATH)) {
    fs.unlinkSync(CACHE_PATH);
  }
  console.log('Cache cleared');
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
