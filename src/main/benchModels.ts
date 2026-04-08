import OpenAI from 'openai';
import { getApiKey, loadApiKeyFromKeychain } from './services/keytarStore';
import { logger } from './utils/logger';

const NVIDIA_API_BASE = 'https://integrate.api.nvidia.com/v1';

const MODELS_TO_TEST = [
  'meta/llama-3.3-70b-instruct',
  'openai/gpt-oss-120b',
  'moonshotai/kimi-k2.5',
  'z-ai/glm5',
  'nvidia/nemotron-3-super-120b-a12b',
  'qwen/qwen3-next-80b-a3b-instruct',
  'deepseek-ai/deepseek-v3.2',
  'minimaxai/minimax-m2.5',
];

const MODEL_TIMEOUT_MS = 15000;

const TEST_PROMPT = `You are a food detection classifier for university events.
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

Be strict. If uncertain, default to hasFood=false.`;

const TEST_EVENTS = {
  events: [
    {
      index: 0,
      title: 'Computer Science Club Meeting',
      description: 'Join us for our weekly meeting. Free pizza and refreshments will be provided.',
      imageText: '',
    },
    {
      index: 1,
      title: 'Career Fair 2025',
      description: 'Meet recruiters from top companies. Free admission for all students.',
      imageText: '',
    },
    {
      index: 2,
      title: 'Study Group: Data Structures',
      description: 'Group study session. Bring your own snacks.',
      imageText: '',
    },
    {
      index: 3,
      title: 'Welcome Week Party',
      description: 'Celebrate the start of the semester with free food, drinks, and music!',
      imageText: '',
    },
  ],
};

async function benchmarkModel(model: string): Promise<{ model: string; time: number; success: boolean; error?: string }> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { model, time: 0, success: false, error: 'No API key configured' };
  }

  const client = new OpenAI({
    apiKey,
    baseURL: NVIDIA_API_BASE,
  });

  const startTime = Date.now();

  try {
    const response = await Promise.race([
      client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: TEST_PROMPT },
          {
            role: 'user',
            content: `Classify each event for free food availability.\n\nInput:\n${JSON.stringify(TEST_EVENTS, null, 2)}\n\nRespond with JSON in this exact format:\n{"results": [{"index": <number>, "hasFood": <boolean>, "reasoning": "<string>"}]}`,
          },
        ],
        temperature: 0.1,
        max_tokens: 1024,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Model timeout (>15s)')), MODEL_TIMEOUT_MS)
      ),
    ]);

    const time = Date.now() - startTime;
    const raw = response.choices[0]?.message?.content ?? '';

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { model, time, success: false, error: 'No JSON in response' };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const hasResults = Array.isArray(parsed.results) && parsed.results.length > 0;

    return { model, time, success: hasResults };
  } catch (error) {
    const time = Date.now() - startTime;
    return {
      model,
      time,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function main() {
  await loadApiKeyFromKeychain();

  console.log('NVIDIA NIM Model Benchmark\n');
  console.log('Testing models for food detection task...\n');

  const results: { model: string; time: number; success: boolean; error?: string }[] = [];

  for (const model of MODELS_TO_TEST) {
    process.stdout.write(`Testing ${model}... `);

    const result = await benchmarkModel(model);
    results.push(result);

    if (result.success) {
      console.log(`${result.time}ms ✓`);
    } else {
      console.log(`FAILED - ${result.error || 'invalid response'}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log('\n=== RESULTS ===\n');
  console.log('Model'.padEnd(50) + 'Time (ms)'.padEnd(12) + 'Status');
  console.log('-'.repeat(75));

  const successfulResults = results.filter((r) => r.success).sort((a, b) => a.time - b.time);

  for (const r of results) {
    const modelShort = r.model.split('/')[1] || r.model;
    const status = r.success ? '✓' : '✗';
    const timeStr = r.success ? r.time.toString() : r.error || 'failed';
    console.log(`${modelShort.padEnd(50)}${r.time.toString().padEnd(12)}${status}`);
  }

  console.log('\n=== RANKED BY SPEED ===\n');
  successfulResults.forEach((r, i) => {
    const modelShort = r.model.split('/')[1] || r.model;
    console.log(`${i + 1}. ${modelShort}: ${r.time}ms`);
  });
}

main().catch(console.error);
