# Ducklink Food Finder - Project Outline

## Overview
A **Mac desktop app** that scans Steven's Ducklink for daily events, uses OCR and an LLM to identify events offering free food, and presents them in a prioritized list.

---

## Key URLs

| Page | URL |
|------|-----|
| Ducklink Home / Login | `https://ducklink.stevens.edu/home_login` |
| Okta SSO | `https://login.stevens.edu/app/siot_campusgroups_1/exk71jcudpTflczEX697/sso/saml?SAMLRequest=...` |
| Post-Login App | `https://ducklink.stevens.edu/web_app?id=24042&menu_id=59153&if=0` |

After login, the app must navigate to the **Events tab** before scraping begins.

---

## Core Features

### 1. Event Scanning
- Scan Ducklink event listings for the current day
- Extract event details:
  - Event name
  - Time
  - Location
  - Description
  - Associated images (flyers, posters)

### 2. Food Detection (LLM-Powered)
- Extract text from event descriptions
- **OCR** all event images using Tesseract to capture text from flyers/posters
- Send combined description + OCR text to **NVIDIA NIM LLM API** for intelligent food detection
- The LLM can detect indirect food references such as:
  - "Chipotle will be at the event"
  - "Taco Tuesday"
  - "Come grab some donuts"
  - Restaurant names, catered by, etc.
- First launch prompts user for their **NVIDIA API key**, stored locally

### 3. Event Display
- Two-section list view:
  1. **Food Events** (pinned at top, highlighted)
  2. **All Other Events**
- Each event card shows:
  - Event name
  - Time & location
  - Food indicator badge (if applicable)
  - Brief description preview

### 4. Browser-Based Authentication (Okta SSO)
- "Scan for Events" button on home screen
- Opens embedded browser window (Electron BrowserWindow or Playwright)
- Navigates to Ducklink home → redirects to Okta SSO
- Detects SSO page and **pauses scanning**
- Shows prompt: "Please log in with Okta, then click Continue"
- User fills in credentials in the embedded browser
- After login, user clicks Continue → app resumes
- Navigates to Events tab and begins scraping

---

## Technical Architecture

### Stack: Electron + Playwright + NVIDIA NIM

| Layer | Technology | Reason |
|-------|------------|--------|
| **Desktop Shell** | Electron | Mac desktop app with full OS integration |
| **Browser Automation** | Playwright | Reliable SSO handling, DOM scraping, auto-wait |
| **OCR** | Tesseract.js | Extract text from event flyer images |
| **Food Detection** | NVIDIA NIM (LLM) | Intelligent classification of food-related events |
| **Storage** | electron-store | Cache API key, daily results |
| **UI** | React (inside Electron) | Component-based event list UI |

### Why NVIDIA NIM?
- Free tier available via `https://build.nvidia.com`
- Supports Llama 3.1 and other capable models
- OpenAI-compatible API (easy integration)
- Can run structured prompts for classification + reasoning

---

## User Flow

```
[Home Screen]
  │
  │  "Scan for Events" button
  ▼
[Embedded Browser Opens]
  │
  ▼
[Ducklink Home → Okta SSO Redirect]
  │
  ├─ SSO Detected ──▶ Show "Log In, then Continue" prompt
  │                        │
  │                   [User fills Okta credentials]
  │                        │
  │◀──── User clicks Continue ────┘
  │
  ▼
[Navigate to Events Tab]
  │
  ▼
[Scrape All Events for Today]
  │  ├─ Extract name, time, location, description
  │  └─ Download event images
  │
  ▼
[OCR on Event Images]
  │  └─ Extract text from flyers/posters
  │
  ▼
[LLM Food Detection]
  │  ├─ Send description + OCR text to NVIDIA NIM
  │  └─ Classify: has food / no food + reasoning
  │
  ▼
[Display Results]
  ├── 🍕 Food Events (highlighted, pinned top)
  └── 📅 All Other Events
```

---

## Data Model

### Event
```json
{
  "id": "string",
  "name": "string",
  "date": "2026-03-31",
  "startTime": "12:00 PM",
  "endTime": "1:30 PM",
  "location": "Babbio Center Room 104",
  "description": "Join us for Chipotle and games!",
  "imageUrl": "https://...",
  "ocrText": "CHIPOTLE CATERED EVENT FREE FOOD...",
  "hasFood": true,
  "foodReasoning": "Event mentions Chipotle catering and free food",
  "sourceUrl": "https://ducklink.stevens.edu/..."
}
```

### App Settings
```json
{
  "nvidiaApiKey": "nvapi-xxxx...",
  "lastScanDate": "2026-03-31",
  "cachedEvents": [...]
}
```

---

## LLM Integration (NVIDIA NIM)

### Setup
- API base: `https://integrate.api.nvidia.com/v1`
- Model: `meta/llama-3.1-8b-instruct` (fast, free tier)
- API key prompted on first launch, stored in electron-store

### Prompt Strategy
```
System: You are a food detection classifier for college events.

User: Does this event mention or imply free food will be provided?
Respond with JSON: { "hasFood": boolean, "reasoning": "string" }

Event Title: {name}
Description: {description}
Image Text (OCR): {ocrText}
```

- Batch events in a single API call when possible to reduce latency
- Parse structured JSON response for each event

---

## Implementation Phases

### Phase 1: Project Setup & Browser
- [ ] Initialize Electron + React project (electron-vite or similar)
- [ ] Install Playwright for browser automation
- [ ] Build "Scan for Events" button + embedded browser window
- [ ] Implement Okta SSO detection and pause/resume flow

### Phase 2: Event Scraping
- [ ] Navigate to Events tab post-login
- [ ] Identify Ducklink DOM structure for event cards
- [ ] Extract: name, time, location, description, image URLs
- [ ] Handle pagination / lazy loading
- [ ] Download and store event images locally

### Phase 3: OCR Pipeline
- [ ] Integrate Tesseract.js
- [ ] Run OCR on each downloaded event image
- [ ] Combine OCR text with description for LLM input

### Phase 4: LLM Food Detection
- [ ] Build NVIDIA API key onboarding screen
- [ ] Implement API client for NVIDIA NIM (OpenAI-compatible)
- [ ] Craft classification prompt
- [ ] Parse LLM responses into `hasFood` + `reasoning`

### Phase 5: UI & Display
- [ ] Design event card component (React)
- [ ] Sort: food events first, then by time
- [ ] Add food badge / highlight styling
- [ ] Loading spinner during scan
- [ ] Error handling UI

### Phase 6: Polish
- [ ] Cache results for the day (avoid re-scanning)
- [ ] Manual refresh button
- [ ] Settings panel (API key, clear cache)
- [ ] App icon and packaging for macOS (.dmg)

---

## Open Questions (Resolved)

| Question | Answer |
|----------|--------|
| Ducklink URL | `https://ducklink.stevens.edu/home_login` |
| SSO Provider | Okta |
| Platform | Mac desktop only |
| Notifications | Not needed |
| Image OCR | Must-have |
| Food detection | NVIDIA NIM LLM |

## LLM Configuration

- **Model:** `meta/llama-3.1-8b-instruct` via NVIDIA NIM
- **Batch size:** 5 events per API call
- **Input format:** JSON array of events
- **Output format:** Strict JSON array (validated, parsed, retried on malformed output)
- **API base:** `https://integrate.api.nvidia.com/v1`

### Batch Prompt Example
```
Input:
[
  { "index": 0, "title": "...", "description": "...", "imageText": "..." },
  { "index": 1, "title": "...", "description": "...", "imageText": "..." },
  ...
]

Expected Output (strict JSON):
[
  { "index": 0, "hasFood": true, "reasoning": "Mentions free pizza" },
  { "index": 1, "hasFood": false, "reasoning": "No food references" },
  ...
]
```

## Error Handling

- **Scraping retries:** Up to 3 attempts if scraping fails mid-way
- **After 3 failures:** Show error screen: "Scraping failed. Please try again."
- **Partial results:** If some events scraped before failure, discard partial and retry from scratch
- **LLM failures:** Retry individual batch up to 2 times before marking batch as failed
