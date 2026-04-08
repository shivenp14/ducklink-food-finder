import fs from 'fs';
import path from 'path';
import { app, BrowserWindow, Rectangle, screen } from 'electron';
import { logger } from '../utils/logger';

interface PersistedWindowState {
  bounds: Rectangle;
  isMaximized: boolean;
}

const DEFAULT_BOUNDS: Rectangle = {
  width: 900,
  height: 670,
  x: 0,
  y: 0,
};

function getWindowStatePath(): string {
  return path.join(app.getPath('userData'), 'window-state.json');
}

function isValidBounds(bounds: Rectangle): boolean {
  if (bounds.width <= 0 || bounds.height <= 0) {
    return false;
  }

  return screen.getAllDisplays().some(({ workArea }) => {
    const horizontallyVisible =
      bounds.x < workArea.x + workArea.width && bounds.x + bounds.width > workArea.x;
    const verticallyVisible =
      bounds.y < workArea.y + workArea.height && bounds.y + bounds.height > workArea.y;

    return horizontallyVisible && verticallyVisible;
  });
}

export function loadWindowState(): PersistedWindowState {
  try {
    const filePath = getWindowStatePath();
    if (!fs.existsSync(filePath)) {
      return {
        bounds: DEFAULT_BOUNDS,
        isMaximized: true,
      };
    }

    const data = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(data) as Partial<PersistedWindowState>;

    const bounds = parsed.bounds;
    if (
      !bounds ||
      typeof bounds.x !== 'number' ||
      typeof bounds.y !== 'number' ||
      typeof bounds.width !== 'number' ||
      typeof bounds.height !== 'number' ||
      !isValidBounds(bounds)
    ) {
      return {
        bounds: DEFAULT_BOUNDS,
        isMaximized: true,
      };
    }

    return {
      bounds,
      isMaximized: parsed.isMaximized !== false,
    };
  } catch (error) {
    logger.error('Failed to load window state:', error);
    return {
      bounds: DEFAULT_BOUNDS,
      isMaximized: true,
    };
  }
}

export function saveWindowState(window: BrowserWindow): void {
  if (window.isDestroyed()) {
    return;
  }

  const state: PersistedWindowState = {
    bounds: window.isMaximized() ? window.getNormalBounds() : window.getBounds(),
    isMaximized: window.isMaximized(),
  };

  try {
    fs.writeFileSync(getWindowStatePath(), JSON.stringify(state, null, 2));
  } catch (error) {
    logger.error('Failed to save window state:', error);
  }
}
