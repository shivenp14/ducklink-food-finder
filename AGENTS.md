# AGENTS.md

## Repository Expectations

- This is an Electron + React desktop app built with `electron-vite` and packaged with `electron-builder`.
- Keep renderer code behind the preload bridge. Do not import Electron APIs directly into `src/renderer`.
- Prefer small, focused changes that preserve the existing UI patterns unless the task explicitly asks for a redesign.

## Before Finishing Changes

- Run the TypeScript checks:
  - `npm run typecheck`
- If you changed lint-relevant code, also run:
  - `npm run lint`
- When changing packaging, updater, preload, or IPC code, make sure both main-process and renderer changes stay in sync.

## Updater And Release Workflow

- The app uses `electron-updater`.
- Auto-updates are intended to work only in packaged builds, not in `npm run dev`.
- Updates are delivered through GitHub Releases for:
  - `shivenp14/ducklink-food-finder`
- The updater UI lives in Settings and supports:
  - `Check for Updates`
  - `Download Update`
  - `Restart to Update`

## Shipping A New App Version

1. Make the code changes.
2. Bump the app version:
   - `npm version patch`
   - Use `minor` or `major` instead when appropriate.
3. Export a GitHub token with permission to create releases and upload assets:
   - `export GH_TOKEN=...`
4. Publish the macOS release:
   - `npm run dist:mac:publish`

This publish step is expected to upload the release artifacts and updater metadata needed by `electron-updater`, including the macOS `.dmg`, `.zip`, and release metadata files.

## Packaging Notes

- macOS targets should continue to include both:
  - `dmg`
  - `zip`
- If you change `build.publish` or updater configuration, keep the runtime updater service and release instructions aligned.

## File Areas

- `src/main` contains Electron main-process code, services, and IPC handlers.
- `src/preload` contains the safe renderer bridge.
- `src/renderer` contains the React UI.
- `docs/` contains implementation notes and project documentation.

## Documentation Expectations

- If you change the release or update workflow, update `README.md`.
- If you change public behavior in a non-obvious way, document it in `docs/` or `README.md` as appropriate.
