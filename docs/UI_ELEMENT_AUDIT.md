# UI Element Audit

Date: 2026-04-07

## Scope

This audit covers the renderer UI under `src/renderer/src` and traces visible buttons, links, and click-styled elements back to their handlers. It also flags hard-coded dashboard content that currently reads like live product data.

## Summary

- Functional controls found: 18
- Present but non-functional or placeholder controls found: 19
- Misleading controls found: 2
- Static placeholder data blocks found: 7
- Unmounted/orphaned UI components found: 4

## Action Triage Under Current Constraint

Constraint applied: do not add new functionality. Only wire controls to functionality that already exists in the codebase today.

### Fix By Connecting To Existing Functionality

These can be repointed to handlers or flows that already exist.

| Area | Element | Recommended fix | Existing functionality to reuse | Evidence |
| --- | --- | --- | --- | --- |
| Results | `View All On Map` | Relabel or repoint to an existing destination. Best current option is to route to `home` explicitly as a "Back Home" action, since that is what it already does. | `onHome` navigation flow | `src/renderer/src/screens/ResultsScreen.tsx:48-53`, `src/renderer/src/App.tsx:81-84` |
| Home | `Load Cached Results` | Keep, but relabel to match actual behavior, such as "Load Cached Results / Scan If Needed" or remove if the label must stay exact. It already uses existing cache-aware scan behavior. | `scan.startScan()` plus cache short-circuit in main process | `src/renderer/src/App.tsx:40-42`, `src/main/ipc/handlers.ts:37-58` |
| Side nav | `Event Map` | If kept, connect to `home` as a temporary alias only if you are comfortable with duplicate navigation. No map functionality exists. | `onNavigate('home')` | `src/renderer/src/components/layout/Layout.tsx:19-29` |
| Mobile nav | `Map` | Same as desktop `Event Map`: only fixable as a duplicate route to `home`, not a real map. | `onNavigate('home')` | `src/renderer/src/components/layout/Layout.tsx:65-75` |

### Remove

These have no existing underlying functionality to connect to without building something new.

| Area | Element | Why remove | Evidence |
| --- | --- | --- | --- |
| Side nav | `My Alerts` | No alert screen, state, or handler exists | `src/renderer/src/components/layout/Layout.tsx:30-33` |
| Side nav | `Archive` | No archive screen, route, or backing data exists | `src/renderer/src/components/layout/Layout.tsx:34-37` |
| Side nav | `Report Food` | No report flow or IPC exists | `src/renderer/src/components/layout/Layout.tsx:40-43` |
| Side nav | `Help Center` | No help route or external link exists | `src/renderer/src/components/layout/Layout.tsx:51-54` |
| Mobile nav | `Report` | No report flow or handler exists | `src/renderer/src/components/layout/Layout.tsx:76-79` |
| Home | `Privacy Policy` | Placeholder `#` link only | `src/renderer/src/screens/HomeScreen.tsx:159` |
| Home | `Terms of Service` | Placeholder `#` link only | `src/renderer/src/screens/HomeScreen.tsx:160` |
| Home | `Contact Support` | Placeholder `#` link only | `src/renderer/src/screens/HomeScreen.tsx:161` |
| Results | `Filter` | No filter state or logic exists | `src/renderer/src/screens/ResultsScreen.tsx:120-123` |
| Results | `By Distance` | No distance model, sort state, or user location exists | `src/renderer/src/screens/ResultsScreen.tsx:124-127` |
| Settings | API key visibility icon | No show/hide state exists for the password field | `src/renderer/src/screens/SettingsScreen.tsx:75-77` |
| Settings | `View Cache Directory` | No existing IPC or shell action to open cache path | `src/renderer/src/screens/SettingsScreen.tsx:139-141`, `src/preload/index.ts:32-68` |
| Settings | `Check for Updates` | No update service or handler exists | `src/renderer/src/screens/SettingsScreen.tsx:180-182` |
| Settings footer | `Privacy Policy` | Placeholder `#` link only | `src/renderer/src/screens/SettingsScreen.tsx:200` |
| Settings footer | `Terms of Service` | Placeholder `#` link only | `src/renderer/src/screens/SettingsScreen.tsx:201` |
| Settings footer | `Academic Integrity` | Placeholder `#` link only | `src/renderer/src/screens/SettingsScreen.tsx:202` |
| Home | `Babbio Center` image card | Looks clickable, but no underlying destination or action exists | `src/renderer/src/screens/HomeScreen.tsx:120-126` |
| Settings | `Image Cache` tile | Styled like an action, but no detail view exists | `src/renderer/src/screens/SettingsScreen.tsx:122-128` |
| Settings | `Event History` tile | Styled like an action, but no detail view exists | `src/renderer/src/screens/SettingsScreen.tsx:129-135` |

### Remove Or De-Emphasize As Static Content

These are not fixable with existing behavior. They should either become clearly non-interactive copy or be removed.

| Area | Element | Recommendation | Evidence |
| --- | --- | --- | --- |
| Results | Other event row container | Remove `cursor-pointer` from the row unless the whole row is wired to the existing external-open action | `src/renderer/src/screens/ResultsScreen.tsx:201-221` |
| Results | `Pizza`, `Coffee`, `Networking` chips | Keep only as non-interactive visual labels if intended; otherwise remove | `src/renderer/src/screens/ResultsScreen.tsx:129-132` |
| Results | Dummy location stats | Remove or restyle as decorative only; comment explicitly says they are dummy | `src/renderer/src/screens/ResultsScreen.tsx:71-84` |
| Home | `Hot Zones`, `Scan Accuracy`, `Academic Quadrangles` content | Remove or restyle as editorial copy, not live metrics | `src/renderer/src/screens/HomeScreen.tsx:81-101` |
| Settings | Hard-coded app metadata (`v1.0.0-stable`, `PROD-DARWIN`, `Connected`) | Remove unless you want static marketing copy | `src/renderer/src/screens/SettingsScreen.tsx:159-176` |

## High-Priority Non-Functional Controls

These elements are rendered as interactive controls but have no handler or only point to `#`.

| Area | Element | Status | Evidence |
| --- | --- | --- | --- |
| Side nav | `Event Map` | No `onClick`, does nothing | `src/renderer/src/components/layout/Layout.tsx:26-29` |
| Side nav | `My Alerts` | No `onClick`, does nothing | `src/renderer/src/components/layout/Layout.tsx:30-33` |
| Side nav | `Archive` | No `onClick`, does nothing | `src/renderer/src/components/layout/Layout.tsx:34-37` |
| Side nav | `Report Food` | No `onClick`, does nothing | `src/renderer/src/components/layout/Layout.tsx:40-43` |
| Side nav | `Help Center` | No `onClick`, does nothing | `src/renderer/src/components/layout/Layout.tsx:51-54` |
| Mobile nav | `Map` | No `onClick`, does nothing | `src/renderer/src/components/layout/Layout.tsx:72-75` |
| Mobile nav | `Report` | No `onClick`, does nothing | `src/renderer/src/components/layout/Layout.tsx:76-79` |
| Home | `Privacy Policy` | `href="#"` placeholder | `src/renderer/src/screens/HomeScreen.tsx:159` |
| Home | `Terms of Service` | `href="#"` placeholder | `src/renderer/src/screens/HomeScreen.tsx:160` |
| Home | `Contact Support` | `href="#"` placeholder | `src/renderer/src/screens/HomeScreen.tsx:161` |
| Results | `Filter` | Button with no handler | `src/renderer/src/screens/ResultsScreen.tsx:120-123` |
| Results | `By Distance` | Button with no handler | `src/renderer/src/screens/ResultsScreen.tsx:124-127` |
| Settings | API key visibility icon | Button with no handler, does not toggle input type | `src/renderer/src/screens/SettingsScreen.tsx:75-77` |
| Settings | `View Cache Directory` | Button with no handler | `src/renderer/src/screens/SettingsScreen.tsx:139-141` |
| Settings | `Check for Updates` | Button with no handler | `src/renderer/src/screens/SettingsScreen.tsx:180-182` |
| Settings footer | `Privacy Policy` | `href="#"` placeholder | `src/renderer/src/screens/SettingsScreen.tsx:200` |
| Settings footer | `Terms of Service` | `href="#"` placeholder | `src/renderer/src/screens/SettingsScreen.tsx:201` |
| Settings footer | `Academic Integrity` | `href="#"` placeholder | `src/renderer/src/screens/SettingsScreen.tsx:202` |

## Click-Styled Elements That Are Not Actually Clickable

These are not always buttons, but the UI strongly suggests interactivity.

| Area | Element | Problem | Evidence |
| --- | --- | --- | --- |
| Home | `Babbio Center` image card | Has `cursor-pointer` and hover zoom, but no click behavior | `src/renderer/src/screens/HomeScreen.tsx:120-126` |
| Results | Other event row container | Entire row has `cursor-pointer`, but only the small external-link icon is clickable | `src/renderer/src/screens/ResultsScreen.tsx:201-221` |
| Settings | `Image Cache` tile | Styled as clickable card, no handler | `src/renderer/src/screens/SettingsScreen.tsx:122-128` |
| Settings | `Event History` tile | Styled as clickable card, no handler | `src/renderer/src/screens/SettingsScreen.tsx:129-135` |

## Misleading Controls

These do trigger code, but the label does not match the behavior.

| Area | Element | Actual behavior | Evidence |
| --- | --- | --- | --- |
| Results | `View All On Map` | Calls `onHome`, which only resets scan state and navigates back to the home screen. No map view exists in `App.tsx`. | `src/renderer/src/screens/ResultsScreen.tsx:48-53`, `src/renderer/src/App.tsx:81-84` |
| Home | `Load Cached Results` | Calls `scan.startScan()` rather than a dedicated cache-only action. It may still start a normal scan path if cache is missing or invalid. | `src/renderer/src/App.tsx:40-42`, `src/main/ipc/handlers.ts:37-58` |

## Functional Controls

These are wired to real app behavior.

| Area | Element | Behavior | Evidence |
| --- | --- | --- | --- |
| Side nav | `Live Feed` | Navigates to `home` | `src/renderer/src/components/layout/Layout.tsx:19-25` |
| Side nav | `Settings` | Navigates to `settings` | `src/renderer/src/components/layout/Layout.tsx:44-50` |
| Mobile nav | `Feed` | Navigates to `home` | `src/renderer/src/components/layout/Layout.tsx:65-71` |
| Mobile nav | `Settings` | Navigates to `settings` | `src/renderer/src/components/layout/Layout.tsx:80-86` |
| Home | `Start New Scan` | Starts scan via `scan.startScan()` | `src/renderer/src/screens/HomeScreen.tsx:43-50`, `src/renderer/src/App.tsx:36-39` |
| Home | Inline `Settings` link in warning banner | Opens settings screen | `src/renderer/src/screens/HomeScreen.tsx:69` |
| Home | `Open Settings` | Opens settings screen | `src/renderer/src/screens/HomeScreen.tsx:114-116` |
| Auth prompt | `Cancel` | Cancels scan | `src/renderer/src/components/BrowserAuthPrompt.tsx:33-38` |
| Auth prompt | `Continue` | Continues auth flow | `src/renderer/src/components/BrowserAuthPrompt.tsx:39-44` |
| Scanning | `Cancel Scan` | Cancels active scan | `src/renderer/src/screens/ScanningScreen.tsx:87-92` |
| Error screen | `Back to Home` | Resets and goes home | `src/renderer/src/components/ErrorMessage.tsx:71-76`, `src/renderer/src/App.tsx:60-63` |
| Error screen | `Try Again` | Resets and restarts scan | `src/renderer/src/components/ErrorMessage.tsx:77-82`, `src/renderer/src/App.tsx:56-59` |
| Results | `Refresh Data` / `Re-Scan Campus` | Starts scan; `Refresh Data` forces refresh when viewing cached results | `src/renderer/src/screens/ResultsScreen.tsx:42-47`, `src/renderer/src/App.tsx:71-79` |
| Results | `Retry Zone` | Re-runs scan | `src/renderer/src/screens/ResultsScreen.tsx:112` |
| Results | `Open on Ducklink` | Opens event URL with `shell.openExternal` | `src/renderer/src/screens/ResultsScreen.tsx:167-175`, `src/main/ipc/handlers.ts:154-155` |
| Results | Other event external-link icon | Opens event URL with `shell.openExternal` | `src/renderer/src/screens/ResultsScreen.tsx:214-221`, `src/main/ipc/handlers.ts:154-155` |
| Results | `Rescan Campus` in empty state | Re-runs scan | `src/renderer/src/screens/ResultsScreen.tsx:236-241` |
| Settings | Back arrow | Returns home | `src/renderer/src/screens/SettingsScreen.tsx:37-42` |
| Settings | `Update Credentials` | Saves API key through IPC | `src/renderer/src/screens/SettingsScreen.tsx:96-102`, `src/main/ipc/handlers.ts:129-132` |
| Settings | `Clear All Data` | Clears cache through IPC | `src/renderer/src/screens/SettingsScreen.tsx:142-148`, `src/main/ipc/handlers.ts:145-147` |

## Static Placeholder Content That Looks Live

These are not broken controls, but they present fabricated or hard-coded product data.

| Area | Content | Why it is placeholder | Evidence |
| --- | --- | --- | --- |
| Home dashboard | `Hot Zones` shows `-` | Not backed by any data | `src/renderer/src/screens/HomeScreen.tsx:95-98` |
| Home dashboard | `Scan Accuracy` shows `94%` | Hard-coded accuracy metric | `src/renderer/src/screens/HomeScreen.tsx:99-101` |
| Home card | `Academic Quadrangles` / `Recent History` framing | Static copy, not derived from scan results | `src/renderer/src/screens/HomeScreen.tsx:81-88` |
| Results summary | Location chips `Schaefer Hall`, `UCC Tower`, `Babbio Center` with event counts | File comment explicitly says these are dummy stats | `src/renderer/src/screens/ResultsScreen.tsx:71-84` |
| Results filters | `Pizza`, `Coffee`, `Networking` chips | Static display only, no filter state | `src/renderer/src/screens/ResultsScreen.tsx:129-132` |
| Settings info card | `v1.0.0-stable`, `PROD-DARWIN`, `Connected` | Hard-coded status/build metadata | `src/renderer/src/screens/SettingsScreen.tsx:159-176` |
| Home + Settings footers | policy/support/legal links | Visible product affordances but placeholders to `#` | `src/renderer/src/screens/HomeScreen.tsx:159-161`, `src/renderer/src/screens/SettingsScreen.tsx:200-202` |

## Unmounted / Orphaned UI Components

These component files still exist but are not imported into the active app tree.

| Component | Notes | Evidence |
| --- | --- | --- |
| `EventCard.tsx` | Older expandable event card UI not used by current results screen | `src/renderer/src/components/EventCard.tsx`, import search in `src/renderer/src` shows no consumers |
| `ScanButton.tsx` | Older scan CTA component not used | `src/renderer/src/components/ScanButton.tsx`, import search in `src/renderer/src` shows no consumers |
| `ProgressBar.tsx` | Unused helper component | `src/renderer/src/components/ProgressBar.tsx`, import search in `src/renderer/src` shows no consumers |
| `FoodBadge.tsx` | Only referenced by orphaned `EventCard` | `src/renderer/src/components/FoodBadge.tsx`, `src/renderer/src/components/EventCard.tsx:3` |

## Notes

- The scan/auth/error/settings flows are mostly wired correctly through preload and IPC.
- Most of the dead surface area is navigation, filtering, settings affordances, and footer/legal links.
- The results screen currently contains both real event actions and multiple design-only placeholders, which makes it the highest-risk screen for user confusion.
