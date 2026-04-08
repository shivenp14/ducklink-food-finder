import OpenAI from 'openai';
import { getApiKey } from './keytarStore';
import { logger } from '../utils/logger';
import { retryWithBackoff } from '../utils/retry';

const NVIDIA_API_BASE = 'https://integrate.api.nvidia.com/v1';
const MODEL = 'openai/gpt-oss-120b';

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
Analyze the provided events and determine if FREE FOOD will be served at the event.

IMPORTANT: "FREE" alone does NOT mean free food. It often means "FREE RSVP" or "FREE admission".
Only classify as hasFood=true if:

POSITIVE indicators (must have food explicitly mentioned):
- Restaurant names: Chipotle, Domino's, Panera, McDonald's, Pizza Hut, Papa John's, Dunkin', Starbucks, etc.
- Food items: pizza, donuts, bagels, tacos, sandwiches, cookies, brownies, snacks, refreshments, food, meal, lunch, dinner, breakfast
- Phrases: "free food", "catered", "food provided", "pizza provided", "snacks provided", "dinner provided", "refreshments served"
- Coffee/tea: "coffee", "tea", "boba", "latte" (drinks count as food)

NEGATIVE indicators (NOT food, even if FREE is present):
- "FREE RSVP", "FREE admission", "FREE to attend", "FREE registration"
- "FREE membership", "FREE entry"
- Any event where FREE refers to cost of attendance, not food

Be strict. If uncertain, default to hasFood=false.

Return a confidence score from 0.0 to 1.0 for each result:
- 0.9 to 1.0 = very strong evidence
- 0.7 to 0.89 = strong evidence
- 0.4 to 0.69 = mixed or weak evidence
- 0.0 to 0.39 = little to no evidence

If hasFood=false, confidence should still reflect how sure you are that food is absent.`;

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
  confidence: number;
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
        content: `Classify each event for free food availability.\n\nInput:\n${JSON.stringify(payload, null, 2)}\n\nRespond with JSON in this exact format:\n{"results": [{"index": <number>, "hasFood": <boolean>, "reasoning": "<string>", "confidence": <number>}]}`,
      },
    ],
    temperature: 0.1,
    max_tokens: 1024,
  });

  const raw = response.choices[0]?.message?.content || '';
  return parseAndValidateLLMResponse(raw, events.length);
}

export async function classifyBatchWithRetry(events: LLMBatchInput[]): Promise<LLMResult[]> {
  return retryWithBackoff(() => classifyBatch(events), {
    maxRetries: 2,
    baseDelay: 1000,
    maxDelay: 5000,
    backoffMultiplier: 2,
    onRetry: (attempt, error) => {
      logger.warn(`LLM batch retry ${attempt}: ${error.message}`);
    },
  });
}

function parseAndValidateLLMResponse(raw: string, batchSize: number): LLMResult[] {
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
    if (typeof r.confidence !== 'number' || Number.isNaN(r.confidence) || r.confidence < 0 || r.confidence > 1) {
      throw new Error(`LLM result at index ${r.index} missing valid "confidence" number`);
    }

    results.push({
      index: r.index,
      hasFood: r.hasFood,
      reasoning: typeof r.reasoning === 'string' ? r.reasoning : '',
      confidence: r.confidence,
    });
  }

  return results;
}
