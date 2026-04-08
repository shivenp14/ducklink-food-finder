# Phase 5: UI & Display

## Goal
Polish all UI screens with refined components, animated loading states, expandable event cards, comprehensive error handling visuals, and a cohesive design system. Build on Phase 4's basic ResultsScreen with production-quality visual design.

---

## Milestones

| # | Milestone | Deliverable |
|---|-----------|-------------|
| 5.1 | Design system | Shared tokens, colors, spacing, typography constants |
| 5.2 | Event card redesign | Expandable cards with image, food badge, reasoning, detail toggle |
| 5.3 | Animated loading screen | Stage-aware spinner with smooth transitions and ETA |
| 5.4 | Error handling UI | Contextual error states per stage with retry/back actions |
| 5.5 | Home screen polish | Animated scan button, status indicator, last scan info |
| 5.6 | Empty & edge states | No events, no API key, offline, partial results |
| 5.7 | Responsive layout | Proper sizing for Electron window constraints |

---

## 5.1 Design System

### File: `src/renderer/src/styles/tokens.ts`

```typescript
export const colors = {
  // Backgrounds
  bgPrimary: 'bg-gray-950',
  bgSecondary: 'bg-gray-900',
  bgTertiary: 'bg-gray-800',
  bgCard: 'bg-gray-900',
  bgCardHover: 'bg-gray-800/60',

  // Accents
  accent: 'bg-orange-500',
  accentHover: 'bg-orange-600',
  accentText: 'text-orange-400',
  accentBorder: 'border-orange-500/40',
  accentBg: 'bg-orange-500/20',

  // Status
  success: 'text-green-400',
  successBg: 'bg-green-500/20',
  error: 'text-red-400',
  errorBg: 'bg-red-500/20',
  warning: 'text-yellow-400',
  warningBg: 'bg-yellow-500/20',

  // Text
  textPrimary: 'text-gray-100',
  textSecondary: 'text-gray-400',
  textMuted: 'text-gray-500',

  // Borders
  borderDefault: 'border-gray-800',
  borderSubtle: 'border-gray-700/50',
} as const;

export const spacing = {
  screenPadding: 'p-6',
  cardPadding: 'p-4',
  sectionGap: 'gap-8',
  itemGap: 'gap-4',
  inlineGap: 'gap-2',
} as const;

export const radius = {
  card: 'rounded-xl',
  badge: 'rounded-full',
  button: 'rounded-lg',
} as const;
```

### File: `src/renderer/src/components/FoodBadge.tsx`

```tsx
interface Props {
  size?: 'sm' | 'md';
}

export default function FoodBadge({ size = 'md' }: Props) {
  const sizeClasses = size === 'sm'
    ? 'px-2 py-0.5 text-xs'
    : 'px-3 py-1 text-sm';

  return (
    <span className={`inline-flex items-center gap-1.5 ${sizeClasses} bg-orange-500/20 text-orange-400 font-medium rounded-full`}>
      <span>🍕</span>
      <span>Free Food</span>
    </span>
  );
}
```

---

## 5.2 Event Card Redesign

### File: `src/renderer/src/components/EventCard.tsx`

```tsx
import { useState } from 'react';
import { ScrapedEvent } from '../types';
import FoodBadge from './FoodBadge';

interface Props {
  event: ScrapedEvent;
  showFoodBadge?: boolean;
}

export default function EventCard({ event, showFoodBadge = false }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`bg-gray-900 rounded-xl border transition-all duration-200 cursor-pointer hover:bg-gray-800/60 ${
        showFoodBadge ? 'border-orange-500/40 shadow-lg shadow-orange-500/5' : 'border-gray-800'
      }`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="p-4">
        <div className="flex gap-4">
          {event.imageUrl ? (
            <img
              src={event.imageUrl}
              alt={event.name}
              className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <div className="w-20 h-20 bg-gray-800 rounded-lg flex-shrink-0 flex items-center justify-center">
              <span className="text-2xl text-gray-600">📅</span>
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-lg leading-tight truncate">{event.name}</h3>
              {showFoodBadge && <FoodBadge size="sm" />}
            </div>

            <div className="flex items-center gap-3 mt-2 text-sm text-gray-400">
              {event.startTime && (
                <span className="flex items-center gap-1">
                  <ClockIcon />
                  {event.startTime}{event.endTime ? ` – ${event.endTime}` : ''}
                </span>
              )}
            </div>

            {event.location && (
              <p className="flex items-center gap-1 text-sm text-gray-400 mt-1">
                <LocationIcon />
                {event.location}
              </p>
            )}

            {event.description && !expanded && (
              <p className="text-sm text-gray-500 mt-2 line-clamp-2">{event.description}</p>
            )}
          </div>

          <ExpandIcon expanded={expanded} />
        </div>

        {/* Expanded detail */}
        {expanded && (
          <div className="mt-4 pt-4 border-t border-gray-800 space-y-3 animate-in">
            {event.description && (
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Description</h4>
                <p className="text-sm text-gray-300 leading-relaxed">{event.description}</p>
              </div>
            )}

            {showFoodBadge && event.foodReasoning && (
              <div className="bg-orange-500/10 rounded-lg p-3">
                <h4 className="text-xs font-semibold text-orange-400 uppercase tracking-wider mb-1">Why food?</h4>
                <p className="text-sm text-orange-300/80 italic">{event.foodReasoning}</p>
              </div>
            )}

            {event.ocrText && (
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Image Text (OCR)</h4>
                <p className="text-xs text-gray-500 font-mono bg-gray-800 rounded p-2 max-h-24 overflow-y-auto">
                  {event.ocrText}
                </p>
              </div>
            )}

            {event.sourceUrl && (
              <a
                href={event.sourceUrl}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-xs text-orange-400 hover:text-orange-300 transition-colors"
              >
                View on Ducklink ↗
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ClockIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function LocationIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function ExpandIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`w-5 h-5 text-gray-500 flex-shrink-0 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}
```

### Card States

| State | Border | Shadow | Badge | Expanded |
|-------|--------|--------|-------|----------|
| Food event | `border-orange-500/40` | `shadow-orange-500/5` | 🍕 Free Food | Shows food reasoning |
| Regular event | `border-gray-800` | none | none | Shows description |
| Hover | bg lightens | subtle | — | cursor pointer |
| Expanded | retains | retains | retains | slides open |

### Expanded Content Order

1. Description (full text)
2. Food reasoning (orange highlight box, food events only)
3. OCR text (monospace, scrollable)
4. Source link ("View on Ducklink ↗")

---

## 5.3 Animated Loading Screen

### File: `src/renderer/src/screens/ScanningScreen.tsx` (updated)

```tsx
import { ScanProgress, ScanError } from '../types';
import BrowserAuthPrompt from '../components/BrowserAuthPrompt';
import ProgressBar from '../components/ProgressBar';
import ErrorMessage from '../components/ErrorMessage';

interface Props {
  state: string;
  progress: ScanProgress | null;
  error: ScanError | null;
  onContinue: () => void;
  onCancel: () => void;
  onRetry: () => void;
  onBack: () => void;
}

const STAGES = [
  { key: 'browser', label: 'Launching browser', icon: '🌐' },
  { key: 'auth', label: 'Authenticating', icon: '🔐' },
  { key: 'scraping', label: 'Finding events', icon: '📋' },
  { key: 'ocr', label: 'Reading flyers', icon: '🔍' },
  { key: 'llm', label: 'Detecting food', icon: '🤖' },
] as const;

export default function ScanningScreen({ state, progress, error, onContinue, onCancel, onRetry, onBack }: Props) {
  if (state === 'auth') {
    return <BrowserAuthPrompt onContinue={onContinue} onCancel={onCancel} />;
  }

  if (state === 'error' && error?.isFinal) {
    return <ErrorMessage message={error.message} stage={error.stage} onRetry={onRetry} onBack={onBack} />;
  }

  const currentStageIndex = STAGES.findIndex((s) => s.key === progress?.stage);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-8 px-8">
      {/* Animated spinner */}
      <div className="relative">
        <div className="w-20 h-20 rounded-full border-4 border-gray-800 border-t-orange-500 animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl">
            {currentStageIndex >= 0 ? STAGES[currentStageIndex].icon : '⏳'}
          </span>
        </div>
      </div>

      <h2 className="text-2xl font-semibold">Scanning for Free Food</h2>

      {/* Stage progress list */}
      <div className="w-full max-w-sm space-y-3">
        {STAGES.map((stage, i) => {
          const isPast = i < currentStageIndex;
          const isCurrent = i === currentStageIndex;
          const isFuture = i > currentStageIndex;

          return (
            <div
              key={stage.key}
              className={`flex items-center gap-3 transition-all duration-300 ${
                isFuture ? 'opacity-30' : ''
              }`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${
                isPast ? 'bg-green-500/20 text-green-400' :
                isCurrent ? 'bg-orange-500/20 text-orange-400 animate-pulse' :
                'bg-gray-800 text-gray-500'
              }`}>
                {isPast ? '✓' : stage.icon}
              </div>
              <span className={`text-sm ${isCurrent ? 'text-gray-100 font-medium' : 'text-gray-500'}`}>
                {stage.label}
              </span>
              {isCurrent && progress?.message && (
                <span className="text-xs text-gray-500 ml-auto truncate max-w-[180px]">
                  {progress.message}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Overall progress bar */}
      {progress && (
        <div className="w-full max-w-sm">
          <ProgressBar value={progress.progress} />
          <p className="text-center text-xs text-gray-500 mt-2">{progress.progress}%</p>
        </div>
      )}

      {error && !error.isFinal && (
        <p className="text-sm text-yellow-400">
          Retrying... (attempt {error.retryAttempt}/3)
        </p>
      )}

      <button
        onClick={onCancel}
        className="mt-4 px-6 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors"
      >
        Cancel
      </button>
    </div>
  );
}
```

### Stage Indicators

| State | Circle | Label | Detail |
|-------|--------|-------|--------|
| Past | ✓ green | dimmed | — |
| Current | icon, orange pulse | bold, white | progress message |
| Future | icon, gray | dimmed (30% opacity) | — |

---

## 5.4 Error Handling UI

### File: `src/renderer/src/components/ErrorMessage.tsx` (updated)

```tsx
interface Props {
  message: string;
  stage: string;
  onRetry: () => void;
  onBack: () => void;
}

const STAGE_ERRORS: Record<string, { title: string; icon: string; suggestion: string }> = {
  browser: {
    title: 'Browser Launch Failed',
    icon: '🌐',
    suggestion: 'Check your internet connection and try again.',
  },
  auth: {
    title: 'Login Timed Out',
    icon: '🔐',
    suggestion: 'The Okta login took too long. Please try again and log in within 5 minutes.',
  },
  scraping: {
    title: 'Scraping Failed',
    icon: '📋',
    suggestion: 'Could not extract events from Ducklink. The page structure may have changed.',
  },
  ocr: {
    title: 'OCR Processing Failed',
    icon: '🔍',
    suggestion: 'Could not read event images. The scan will continue with text-only detection.',
  },
  llm: {
    title: 'Food Detection Failed',
    icon: '🤖',
    suggestion: 'Check your NVIDIA API key in Settings, or try again later.',
  },
};

export default function ErrorMessage({ message, stage, onRetry, onBack }: Props) {
  const config = STAGE_ERRORS[stage] || {
    title: 'Something Went Wrong',
    icon: '⚠️',
    suggestion: 'An unexpected error occurred.',
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 px-8">
      <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center">
        <span className="text-4xl">{config.icon}</span>
      </div>

      <h2 className="text-2xl font-semibold text-center text-red-400">{config.title}</h2>

      <p className="text-gray-400 text-center max-w-md">{config.suggestion}</p>

      <div className="bg-gray-900 rounded-lg p-3 max-w-md w-full">
        <p className="text-xs text-gray-500 font-mono break-all">{message}</p>
      </div>

      <div className="flex gap-4 mt-2">
        <button
          onClick={onBack}
          className="px-6 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
        >
          Back to Home
        </button>
        <button
          onClick={onRetry}
          className="px-6 py-2 bg-orange-500 hover:bg-orange-600 rounded-lg font-semibold transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
```

### Error States by Stage

| Stage | Title | Icon | Suggestion |
|-------|-------|------|------------|
| browser | Browser Launch Failed | 🌐 | Check internet connection |
| auth | Login Timed Out | 🔐 | Log in within 5 minutes |
| scraping | Scraping Failed | 📋 | Page structure may have changed |
| ocr | OCR Processing Failed | 🔍 | Continues with text-only |
| llm | Food Detection Failed | 🤖 | Check API key in Settings |

---

## 5.5 Home Screen Polish

### File: `src/renderer/src/screens/HomeScreen.tsx` (updated)

```tsx
import { useState, useEffect } from 'react';
import ScanButton from '../components/ScanButton';

interface Props {
  onScan: () => void;
  onSettings: () => void;
}

export default function HomeScreen({ onScan, onSettings }: Props) {
  const [hasKey, setHasKey] = useState(false);
  const [lastScan, setLastScan] = useState<string | null>(null);

  useEffect(() => {
    window.api.hasApiKey().then(setHasKey);
    // lastScan will come from electron-store in Phase 6
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-10 px-8">
      {/* Logo / Title */}
      <div className="text-center space-y-3">
        <div className="text-6xl">🦆</div>
        <h1 className="text-4xl font-bold text-orange-400">Ducklink Food Finder</h1>
        <p className="text-gray-400 max-w-xs">
          Scan Stevens Ducklink for free food at campus events
        </p>
      </div>

      {/* API key warning */}
      {!hasKey && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-4 py-3 max-w-sm w-full">
          <p className="text-sm text-yellow-400 text-center">
            Set your NVIDIA API key in{' '}
            <button onClick={onSettings} className="underline hover:text-yellow-300">
              Settings
            </button>{' '}
            to enable food detection.
          </p>
        </div>
      )}

      {/* Scan button */}
      <ScanButton onClick={onScan} disabled={!hasKey} />

      {/* Last scan info */}
      {lastScan && (
        <p className="text-xs text-gray-600">Last scan: {lastScan}</p>
      )}

      {/* Settings link */}
      <button
        onClick={onSettings}
        className="text-sm text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        Settings
      </button>
    </div>
  );
}
```

### File: `src/renderer/src/components/ScanButton.tsx` (updated)

```tsx
interface Props {
  onClick: () => void;
  disabled?: boolean;
}

export default function ScanButton({ onClick, disabled = false }: Props) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        group relative px-10 py-5 text-xl font-semibold rounded-2xl
        transition-all duration-200
        ${disabled
          ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
          : 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30 hover:scale-105 active:scale-95'
        }
      `}
    >
      {!disabled && (
        <span className="absolute inset-0 rounded-2xl bg-orange-400/20 animate-ping opacity-0 group-hover:opacity-100 group-hover:animate-none" />
      )}
      <span className="relative flex items-center gap-3">
        🔍 Scan for Events
      </span>
    </button>
  );
}
```

---

## 5.6 Empty & Edge States

### No Events Found

```tsx
// Inside ResultsScreen when events.length === 0
<div className="flex flex-col items-center justify-center min-h-[400px] gap-4 text-center">
  <span className="text-5xl">🍽️</span>
  <h2 className="text-xl font-semibold text-gray-300">No Events Today</h2>
  <p className="text-gray-500 max-w-xs">
    No events were found on Ducklink for today. Check back later or try rescanning.
  </p>
  <button onClick={onRescan} className="px-6 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm">
    Rescan
  </button>
</div>
```

### No Food Events Found

```tsx
// Inside ResultsScreen when foodEvents.length === 0 but events exist
<div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 text-center mb-6">
  <span className="text-3xl">😢</span>
  <p className="text-gray-400 mt-2">No free food detected today</p>
  <p className="text-xs text-gray-600 mt-1">
    {events.length} events found, but none appear to have free food
  </p>
</div>
```

### No API Key

```tsx
// In HomeScreen, replaces scan button
<div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-6 max-w-sm w-full text-center">
  <span className="text-3xl">🔑</span>
  <h2 className="text-lg font-semibold text-yellow-400 mt-2">API Key Required</h2>
  <p className="text-sm text-gray-400 mt-1">
    Set your NVIDIA API key to enable food detection.
  </p>
  <button onClick={onSettings} className="mt-4 px-6 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 rounded-lg text-sm font-medium transition-colors">
    Go to Settings
  </button>
</div>
```

### Partial Results (Some LLM batches failed)

```tsx
// Banner at top of ResultsScreen
{hasPartialFailure && (
  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-4 py-3 mb-6">
    <p className="text-sm text-yellow-400">
      ⚠️ Some events could not be classified. Food detection may be incomplete.
    </p>
  </div>
)}
```

---

## 5.7 Updated ResultsScreen

### File: `src/renderer/src/screens/ResultsScreen.tsx` (updated)

```tsx
import { ScrapedEvent } from '../types';
import EventCard from '../components/EventCard';
import FoodBadge from '../components/FoodBadge';

interface Props {
  events: ScrapedEvent[];
  foodEvents: ScrapedEvent[];
  onRescan: () => void;
  onHome: () => void;
}

export default function ResultsScreen({ events, foodEvents, onRescan, onHome }: Props) {
  const otherEvents = events.filter((e) => !e.hasFood);
  const hasPartialFailure = events.some((e) => e.foodReasoning === 'Food detection failed for this batch');

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">{events.length} Events Found</h1>
            <p className="text-sm text-gray-500 mt-1">
              {foodEvents.length} with free food
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onRescan}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm cursor-pointer transition-colors"
            >
              Rescan
            </button>
            <button
              onClick={onHome}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 rounded-lg text-sm font-semibold cursor-pointer transition-colors"
            >
              Home
            </button>
          </div>
        </div>

        {/* Partial failure warning */}
        {hasPartialFailure && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-4 py-3 mb-6">
            <p className="text-sm text-yellow-400">
              ⚠️ Some events could not be classified. Food detection may be incomplete.
            </p>
          </div>
        )}

        {/* Food Events Section */}
        {foodEvents.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-orange-400 mb-4 flex items-center gap-2">
              🍕 Free Food
              <span className="text-sm font-normal text-orange-400/60">
                ({foodEvents.length})
              </span>
            </h2>
            <div className="space-y-3">
              {foodEvents.map((event) => (
                <EventCard key={event.id} event={event} showFoodBadge />
              ))}
            </div>
          </div>
        )}

        {/* No food events empty state */}
        {foodEvents.length === 0 && events.length > 0 && (
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 text-center mb-8">
            <span className="text-3xl">😢</span>
            <p className="text-gray-400 mt-2">No free food detected today</p>
            <p className="text-xs text-gray-600 mt-1">
              {events.length} events found, but none appear to have free food
            </p>
          </div>
        )}

        {/* Other Events Section */}
        {otherEvents.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-400 mb-4">
              📅 Other Events
              <span className="text-sm font-normal text-gray-500 ml-2">
                ({otherEvents.length})
              </span>
            </h2>
            <div className="space-y-3">
              {otherEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          </div>
        )}

        {/* No events at all */}
        {events.length === 0 && (
          <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 text-center">
            <span className="text-5xl">🍽️</span>
            <h2 className="text-xl font-semibold text-gray-300">No Events Today</h2>
            <p className="text-gray-500 max-w-xs">
              No events were found on Ducklink for today. Check back later or try rescanning.
            </p>
            <button
              onClick={onRescan}
              className="px-6 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors"
            >
              Rescan
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## 5.8 Updated App.tsx

```tsx
import { useState, useEffect } from 'react';
import HomeScreen from './screens/HomeScreen';
import ScanningScreen from './screens/ScanningScreen';
import ResultsScreen from './screens/ResultsScreen';
import SettingsScreen from './screens/SettingsScreen';
import { useScan } from './hooks/useScan';
import { ScrapedEvent } from './types';

type Screen = 'home' | 'scanning' | 'results' | 'settings';

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const scan = useScan();

  useEffect(() => {
    if (scan.state === 'done' && scan.events.length > 0) {
      setScreen('results');
    }
  }, [scan.state, scan.events]);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {screen === 'home' && (
        <HomeScreen
          onScan={() => { scan.startScan(); setScreen('scanning'); }}
          onSettings={() => setScreen('settings')}
        />
      )}
      {screen === 'scanning' && (
        <ScanningScreen
          state={scan.state}
          progress={scan.progress}
          error={scan.error}
          onContinue={scan.continueScan}
          onCancel={() => { scan.cancelScan(); setScreen('home'); }}
          onRetry={() => { scan.reset(); scan.startScan(); }}
          onBack={() => { scan.reset(); setScreen('home'); }}
        />
      )}
      {screen === 'results' && (
        <ResultsScreen
          events={scan.events}
          foodEvents={scan.foodEvents}
          onRescan={() => { scan.reset(); scan.startScan(); setScreen('scanning'); }}
          onHome={() => { scan.reset(); setScreen('home'); }}
        />
      )}
      {screen === 'settings' && (
        <SettingsScreen onBack={() => setScreen('home')} />
      )}
    </div>
  );
}
```

---

## 5.9 Updated useScan Hook

```tsx
import { useState, useEffect, useCallback } from 'react';
import { ScanProgress, ScanError, ScrapedEvent } from '../types';

type ScanState = 'idle' | 'scanning' | 'auth' | 'error' | 'done';

export function useScan() {
  const [state, setState] = useState<ScanState>('idle');
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [error, setError] = useState<ScanError | null>(null);
  const [events, setEvents] = useState<ScrapedEvent[]>([]);
  const [foodEvents, setFoodEvents] = useState<ScrapedEvent[]>([]);

  useEffect(() => {
    window.api.onScanProgress((data) => {
      setProgress(data);
    });

    window.api.onAuthRequired(() => {
      setState('auth');
    });

    window.api.onScanError((data) => {
      setError(data);
      if (data.isFinal) setState('error');
    });

    window.api.onScanComplete((data) => {
      setEvents(data.events as ScrapedEvent[]);
      setFoodEvents(data.foodEvents as ScrapedEvent[]);
      setState('done');
    });
  }, []);

  const startScan = useCallback(async () => {
    setState('scanning');
    setError(null);
    setProgress(null);
    setEvents([]);
    setFoodEvents([]);
    await window.api.startScan();
  }, []);

  const continueScan = useCallback(async () => {
    setState('scanning');
    await window.api.continueScan();
  }, []);

  const cancelScan = useCallback(async () => {
    await window.api.cancelScan();
    setState('idle');
    setProgress(null);
    setError(null);
  }, []);

  const reset = useCallback(() => {
    setState('idle');
    setProgress(null);
    setError(null);
    setEvents([]);
    setFoodEvents([]);
  }, []);

  return { state, progress, error, events, foodEvents, startScan, continueScan, cancelScan, reset };
}
```

---

## 5.10 Updated Types

### `src/renderer/src/types/index.ts`

```typescript
export interface ScanProgress {
  stage: 'browser' | 'auth' | 'scraping' | 'ocr' | 'llm' | 'done';
  message: string;
  progress: number;
}

export interface ScanError {
  stage: string;
  message: string;
  retryAttempt: number;
  isFinal: boolean;
}

export interface ScrapedEvent {
  id: string;
  name: string;
  date: string;
  rawDateText: string;
  startTime: string;
  endTime: string;
  location: string;
  description: string;
  imageUrl: string | null;
  localImagePath: string | null;
  ocrText: string;
  combinedText: string;
  hasFood: boolean;
  foodReasoning: string;
  sourceUrl: string;
}

export interface ScanResult {
  date: string;
  events: ScrapedEvent[];
  foodEvents: ScrapedEvent[];
  scanDuration: number;
}
```

---

## 5.11 ProgressBar Update

### `src/renderer/src/components/ProgressBar.tsx` (updated)

```tsx
interface Props {
  value: number;
  showLabel?: boolean;
}

export default function ProgressBar({ value, showLabel = false }: Props) {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div className="w-80">
      <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-orange-500 to-orange-400 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel && (
        <p className="text-center text-xs text-gray-500 mt-1">{clamped}%</p>
      )}
    </div>
  );
}
```

---

## Screen Map

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  HomeScreen  │────▶│ScanningScreen│────▶│ResultsScreen │     │SettingsScreen│
│              │     │              │     │              │     │              │
│ 🦆 Title    │     │ ⭕ Spinner   │     │ 🍕 Food (N)  │     │ 🔑 API Key   │
│ ⚠️ API warn │     │ Stage list   │     │   EventCards  │     │ Save/Clear   │
│ 🔍 Scan btn │     │ Progress bar │     │ 📅 Other (N)  │     │              │
│ ⚙️ Settings │     │ Cancel btn   │     │   EventCards  │     │     ◀ Back   │
│              │     │              │     │ Rescan / Home │     │              │
│     ─── OR ──│     │   ─── OR ──  │     │              │     │              │
│ 🔑 No key   │     │ ❌ Error     │     │   ─── OR ──  │     │              │
│ "Go to      │     │ Retry / Back │     │ 😢 No food   │     │              │
│  Settings"  │     │              │     │ 🍽️ No events │     │              │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
```

---

## Phase 5 Checklist

- [ ] Create `tokens.ts` design system constants
- [ ] Build `FoodBadge` component with `sm`/`md` sizes
- [ ] Build `EventCard` component with expand/collapse, image fallback, icon rows
- [ ] Update `ScanningScreen` with stage list, animated spinner, per-stage icons
- [ ] Update `ErrorMessage` with stage-specific titles, icons, suggestions
- [ ] Update `HomeScreen` with duck logo, API key warning, last scan info
- [ ] Update `ScanButton` with disabled state, hover animation
- [ ] Update `ResultsScreen` with empty states (no events, no food, partial failure)
- [ ] Update `ProgressBar` with gradient and optional label
- [ ] Update `App.tsx` with proper screen transitions
- [ ] Update `useScan` hook with `events` and `foodEvents` state
- [ ] Update `types/index.ts` with `ScrapedEvent` full type
- [ ] Test: food event card shows orange border, badge, expand shows reasoning
- [ ] Test: regular event card expand shows description and source link
- [ ] Test: scanning screen shows animated spinner with stage progress
- [ ] Test: error screen shows stage-specific title and suggestion
- [ ] Test: home screen shows API key warning when no key set
- [ ] Test: home screen disables scan button when no API key
- [ ] Test: results screen shows "No free food" when foodEvents is empty
- [ ] Test: results screen shows "No events today" when events is empty
- [ ] Test: partial failure banner shows when some batches failed
- [ ] Test: clicking card toggles expanded state with animation
- [ ] Test: image load failure shows placeholder icon

---

## Testing the Phase 5 Flow

1. Launch app → HomeScreen with duck logo, title, scan button
2. If no API key → yellow warning banner, scan button disabled, "Go to Settings" CTA
3. Set API key in Settings → return to Home → scan button enabled
4. Click Scan → ScanningScreen with animated spinner
5. Stage list animates: browser ✓ → auth → scraping → ocr → llm
6. Current stage shows pulsing icon + detail message
7. Progress bar fills with gradient, percentage shown below
8. Error mid-scan → stage-specific error screen with retry option
9. Scan complete → ResultsScreen
10. Food events in orange-bordered cards with 🍕 badge
11. Click card → expands to show description, food reasoning, OCR text, source link
12. Click again → collapses
13. Other events in gray-bordered cards, expandable
14. If no food → "No free food detected today" banner
15. If no events → "No Events Today" empty state with rescan button
16. Rescan → returns to ScanningScreen

---

## Known Limitations (Phase 5)

- **No animation library** — CSS transitions only. Complex animations (page transitions, shared element) would need framer-motion
- **No dark/light theme toggle** — dark mode only as designed
- **No search/filter** — all events shown in flat list. Filtering by time/location is a future feature
- **No event detail page** — expand-in-place only. Full detail page may be needed for long descriptions
- **Static icons** — emoji-based icons. Custom SVG icon set would be more polished
- **No keyboard navigation** — cards not focusable/tab-navigable for accessibility
- **No virtualization** — all event cards rendered in DOM. Would need react-window if event count exceeds ~50
