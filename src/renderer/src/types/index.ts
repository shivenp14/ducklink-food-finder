export interface ScanProgress {
  stage: 'idle' | 'browser' | 'scraping' | 'ocr' | 'llm' | 'done'
  message: string
  progress: number
}

export interface ScanError {
  stage: string
  message: string
  retryAttempt: number
  isFinal: boolean
}

export interface ScrapedEvent {
  id: string
  name: string
  date: string
  rawDateText: string
  startTime: string
  endTime: string
  location: string
  description: string
  imageUrl: string | null
  localImagePath: string | null
  localImageDataUrl: string | null
  ocrText: string
  combinedText: string
  hasFood: boolean
  foodReasoning: string
  foodConfidence: number
  sourceUrl: string
}

export interface ScanResult {
  date: string
  events: ScrapedEvent[]
  foodEvents: ScrapedEvent[]
  scanDuration: number
  fromCache: boolean
}

export interface CacheInfo {
  date: string
  eventCount: number
  timestamp: number
}
