import { useState, useEffect, useCallback } from 'react';
import { ScanProgress, ScanError, ScrapedEvent, ScanResult } from '../types';

type ScanState = 'idle' | 'scanning' | 'error' | 'done';

export function useScan() {
  const [state, setState] = useState<ScanState>('idle');
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [error, setError] = useState<ScanError | null>(null);
  const [events, setEvents] = useState<ScrapedEvent[]>([]);
  const [foodEvents, setFoodEvents] = useState<ScrapedEvent[]>([]);
  const [fromCache, setFromCache] = useState(false);

  useEffect(() => {
    window.api.onScanProgress((data) => {
      setProgress(data);
      if (data.stage === 'done') setState('done');
    });

    window.api.onScanError((data) => {
      setError(data);
      if (data.isFinal) setState('error');
    });

    window.api.onScanComplete((data) => {
      setEvents(data.events as ScrapedEvent[]);
      setFoodEvents(data.foodEvents as ScrapedEvent[]);
      setFromCache(data.fromCache ?? false);
      setState('done');
    });
  }, []);

  const startScan = useCallback(async (forceRefresh = false) => {
    setState('scanning');
    setError(null);
    setProgress(null);
    try {
      await window.api.startScan(forceRefresh);
    } catch (err) {
      console.error('Start scan error:', err);
    }
  }, []);

  const cancelScan = useCallback(async () => {
    await window.api.cancelScan();
    setState('idle');
    setProgress(null);
    setError(null);
    setEvents([]);
    setFoodEvents([]);
    setFromCache(false);
  }, []);

  const reset = useCallback(() => {
    setState('idle');
    setProgress(null);
    setError(null);
    setEvents([]);
    setFoodEvents([]);
    setFromCache(false);
  }, []);

  const hydrateResult = useCallback((data: ScanResult) => {
    setState('done');
    setProgress(null);
    setError(null);
    setEvents(data.events);
    setFoodEvents(data.foodEvents);
    setFromCache(data.fromCache);
  }, []);

  return { state, progress, error, events, foodEvents, fromCache, startScan, cancelScan, reset, hydrateResult };
}
