import fs from 'fs';
import path from 'path';
import os from 'os';

const KEY_PATH = path.join(os.homedir(), '.ducklink-food-finder', 'api-key.enc');

export function setApiKey(apiKey: string): void {
  const dir = path.dirname(KEY_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
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
