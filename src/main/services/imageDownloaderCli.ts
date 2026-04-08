import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { retryWithBackoff } from '../utils/retry';

const IMAGE_DIR = path.join(process.env.TEMP || '/tmp', 'ducklink-food-finder-images');

function ensureImageDir(): void {
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
          timeout: 30000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/png,image/jpeg,image/*;q=0.8',
            'Referer': 'https://ducklink.stevens.edu/',
          },
          maxRedirects: 5,
          validateStatus: (status) => status < 500,
        });
      },
      {
        maxRetries: 2,
        baseDelay: 1000,
        maxDelay: 5000,
        backoffMultiplier: 2,
      }
    );

    const contentType = response.headers['content-type'] || '';
    if (!contentType.includes('image')) {
      console.log(`  Not an image (${contentType}): ${eventId}`);
      return null;
    }

    fs.writeFileSync(filepath, Buffer.from(response.data));
    console.log(`  Downloaded: ${filename}`);
    return filepath;
  } catch {
    console.log(`  Failed to download: ${eventId}`);
    return null;
  }
}

export async function downloadAllImagesCli(
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

  console.log(`Downloaded ${results.size} of ${queue.length} images`);
  return results;
}

export function cleanupImagesCli(): void {
  if (fs.existsSync(IMAGE_DIR)) {
    fs.rmSync(IMAGE_DIR, { recursive: true, force: true });
    console.log('Cleaned up temp images');
  }
}

function getImageExtension(url: string): string {
  const match = url.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i);
  return match ? `.${match[1].toLowerCase()}` : '.jpg';
}
