import fs from 'fs';
import path from 'path';
import os from 'os';

const KEY_DIR = path.join(os.homedir(), '.ducklink-food-finder');
const KEY_PATH = path.join(KEY_DIR, 'api-key.enc');

export function setApiKey(apiKey: string): void {
  if (!fs.existsSync(KEY_DIR)) {
    fs.mkdirSync(KEY_DIR, { recursive: true });
  }
  fs.writeFileSync(KEY_PATH, apiKey);
}

export function getApiKey(): string | null {
  if (!fs.existsSync(KEY_PATH)) return null;
  return fs.readFileSync(KEY_PATH, 'utf-8');
}

export function hasApiKey(): boolean {
  return fs.existsSync(KEY_PATH);
}

export function deleteApiKey(): void {
  if (fs.existsSync(KEY_PATH)) {
    fs.unlinkSync(KEY_PATH);
  }
}
