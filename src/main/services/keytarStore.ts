import keytar from 'keytar';

const SERVICE_NAME = 'ducklink-food-finder';
const ACCOUNT_NAME = 'nvidia-api-key';

const apiKeyCache: { key: string | null } = { key: null };

export async function setApiKey(apiKey: string): Promise<void> {
  apiKeyCache.key = apiKey;
  await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, apiKey);
}

export function getApiKey(): string | null {
  return apiKeyCache.key;
}

export function hasApiKey(): boolean {
  return apiKeyCache.key !== null;
}

export async function deleteApiKey(): Promise<boolean> {
  apiKeyCache.key = null;
  return keytar.deletePassword(SERVICE_NAME, ACCOUNT_NAME);
}

export async function loadApiKeyFromKeychain(): Promise<string | null> {
  const key = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
  apiKeyCache.key = key;
  return key;
}
