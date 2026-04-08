# Browser Preview Integration Plan

## Goal
Show users what the scraper is doing by making the browser visible during scanning.

**Key context**: No authentication required - the site works without signing in.

**Simplest solution**: Just make Playwright visible (non-headless).

## Implementation

### 1. Change Playwright to Visible Mode
**File:** `src/main/services/playwright.ts`

Simple one-line change:

```typescript
export async function launchBrowser(): Promise<void> {
  browser = await chromium.launch({
    headless: false,  // Changed from true - shows browser window
    executablePath: chromiumPath,
    args: ['--no-sandbox'],
  });
  
  context = await browser.newContext({
    viewport: { width: 1200, height: 800 },
  });
  
  page = await context.newPage();
}
```

That's it! Users will see the browser window open and navigate through Ducklink as events are scraped.

### 2. Show Current URL in ScanningScreen
**File:** `src/renderer/src/screens/ScanningScreen.tsx`

Emit URL changes from main process and display in the UI:

```typescript
// src/main/ipc/channels.ts
export const IPC = {
  // ... existing channels ...
  BROWSER_URL_CHANGED: 'browser:urlChanged',
} as const;
```

```typescript
// src/main/ipc/handlers.ts
// Listen for navigation and emit URL to renderer
page?.on('framenavigated', (frame) => {
  if (frame === page.mainFrame()) {
    mainWindow.webContents.send(IPC.BROWSER_URL_CHANGED, frame.url());
  }
});
```

```typescript
// src/renderer/src/screens/ScanningScreen.tsx
export default function ScanningScreen() {
  const [currentUrl, setCurrentUrl] = useState('');

  useEffect(() => {
    window.electron.onUrlChange((url) => setCurrentUrl(url));
  }, []);

  return (
    <div className="scanning-screen">
      {/* Existing progress UI */}
      <ProgressBar stage={stage} progress={progress} message={message} />
      
      {/* Show current URL being visited */}
      <div className="text-sm text-gray-400 font-mono">
        {currentUrl}
      </div>
      
      {/* Stage indicators */}
      <StageList currentStage={stage} />
    </div>
  );
}
```

## Stage Display

| Stage | Description | Browser |
|-------|-------------|---------|
| `browser` | Starting browser | Visible |
| `scraping` | Fetching events | Visible |
| `ocr` | Processing images | Hidden |
| `llm` | Analyzing food | Hidden |
| `done` | Complete | Hidden |

## Why This Works

- **Single browser**: Playwright does both scraping and display
- **No sync issues**: No separate BrowserView that can get out of sync
- **URL text is sufficient**: Users see where the scraper is navigating
- **Simpler**: No dual-browser complexity

## Testing Checklist

- [ ] Browser window appears when scanning starts
- [ ] User can see navigation through Ducklink
- [ ] Scraping completes successfully
- [ ] Browser window closes when done
- [ ] URL text updates in the UI
- [ ] All existing stages work (events, OCR, LLM)

## Notes

- Just `headless: false` - no BrowserView, no sync logic
- The browser window is visible but users don't need to interact
- Playwright does all the work automatically
- URL text in UI provides context without complexity
