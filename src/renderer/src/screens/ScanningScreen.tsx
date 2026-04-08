import { ScanProgress, ScanError } from '../types'
import ErrorMessage from '../components/ErrorMessage'
import { useState, useEffect } from 'react'

interface Props {
  state: string
  progress: ScanProgress | null
  error: ScanError | null
  onCancel: () => void
  onRetry: () => void
  onBack: () => void
}

const STAGES = [
  { key: 'browser', label: 'Launching browser', icon: 'language', desc: 'Headless instance initialized successfully.' },
  { key: 'scraping', label: 'Finding events', icon: 'search', desc: 'Upcoming events detected in portal.' },
  { key: 'ocr', label: 'Reading event flyers via OCR', icon: 'view_in_ar', desc: 'Extracting text from images...' },
  { key: 'llm', label: 'LLM Food Detection', icon: 'psychology', desc: 'Queued for semantic analysis.' },
] as const

export default function ScanningScreen({
  state,
  progress,
  error,
  onCancel,
  onRetry,
  onBack,
}: Props) {
  const [currentUrl, setCurrentUrl] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');

  useEffect(() => {
    window.api.onBrowserUrlChanged((url) => setCurrentUrl(url));
    window.api.onBrowserPreviewUpdated((dataUrl) => setPreviewUrl(dataUrl));
  }, []);

  if (state === 'error' && error?.isFinal) {
    return (
      <ErrorMessage
        message={error.message}
        stage={error.stage}
        onRetry={onRetry}
        onBack={onBack}
      />
    )
  }

  const currentStageIndex = STAGES.findIndex(
    (s) => s.key === progress?.stage
  )

  const progressPercent = Math.max(10, progress?.progress ?? 0)

  return (
    <div className="max-w-6xl mx-auto pb-12">
      {/* Hero Scanning Header */}
      <section className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-3 h-3 bg-tertiary rounded-full availability-pulse"></div>
            <span className="text-tertiary font-bold tracking-widest text-xs uppercase font-headline">Live Scrape in Progress</span>
          </div>
          <h2 className="text-5xl font-headline font-extrabold text-on-surface tracking-tight leading-tight">
            Analyzing the <br/><span className="text-primary italic">Ducklink</span> Ecosystem.
          </h2>
          <p className="text-on-surface-variant max-w-xl text-lg leading-relaxed pt-2">
            Our concierge is currently navigating campus events to identify available culinary opportunities. This typically takes 45-60 seconds.
          </p>
        </div>
        
        <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-sm border border-outline-variant/10 min-w-[280px]">
          <div className="flex justify-between items-end mb-2">
            <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Global Progress</span>
            <span className="text-2xl font-headline font-black text-primary">{Math.round(progressPercent)}%</span>
          </div>
          <div className="h-3 w-full bg-surface-container rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-primary to-primary-container rounded-full transition-all duration-300" style={{ width: `${progressPercent}%` }}></div>
          </div>
          <button
            onClick={onCancel}
            className="w-full mt-4 py-2 bg-surface-container-highest hover:bg-surface-container-high rounded-full text-xs font-bold text-on-surface-variant uppercase tracking-widest transition-colors"
          >
            Cancel Scan
          </button>
        </div>
      </section>

      {/* Asymmetric Scanning Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Detailed Process Status (The Main List) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Live Browser Preview Section */}
          <div className="bg-inverse-surface rounded-3xl overflow-hidden shadow-2xl mb-8 border border-surface-container-highest/20">
            <div className="bg-slate-800/50 px-6 py-3 flex items-center justify-between border-b border-white/5">
              <div className="flex items-center gap-4">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/50"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/50"></div>
                </div>
                <div className="h-6 w-px bg-white/10 mx-2"></div>
                <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
                  <span className="material-symbols-outlined text-xs">language</span>
                  <span className="truncate max-w-[200px]">{currentUrl || 'ducklink.stevens.edu/events'}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-red-400">Live Stream</span>
              </div>
            </div>
            
            <div className="relative aspect-video bg-slate-900 overflow-hidden group flex items-center justify-center">
              {previewUrl ? (
                <>
                  <div className="absolute top-0 left-0 w-full h-[2px] bg-primary/50 shadow-[0_0_15px_2px_rgba(163,38,56,0.8)] z-20 animate-[scan_3s_linear_infinite]" />
                  <img
                    src={previewUrl}
                    alt="Browser preview"
                    className="w-full h-full object-cover opacity-60 mix-blend-luminosity grayscale contrast-125 group-hover:scale-[1.02] transition-transform duration-[2000ms]"
                  />
                </>
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-500 gap-2">
                  <span className="material-symbols-outlined text-4xl animate-spin">sync</span>
                  <span className="text-xs font-mono">Initializing Headless Browser...</span>
                </div>
              )}
              
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="bg-black/40 backdrop-blur-sm border border-white/10 px-4 py-2 rounded-lg flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary-fixed-dim animate-spin">sync</span>
                  <span className="text-xs font-mono text-white/80">Active Session: Ducklink Scraper</span>
                </div>
              </div>
            </div>
          </div>

          {/* Analysis Pipeline */}
          <div className="bg-surface-container-low rounded-3xl p-8 space-y-8">
            <h3 className="text-xl font-headline font-bold text-on-surface px-2">Analysis Pipeline</h3>
            <div className="space-y-4">
              {STAGES.map((stage, i) => {
                const isPast = i < currentStageIndex
                const isCurrent = i === currentStageIndex
                const isFuture = i > currentStageIndex

                if (isPast) {
                  return (
                    <div key={stage.key} className="flex items-center gap-6 p-4 rounded-2xl bg-surface-container-lowest transition-all hover:scale-[1.01]">
                      <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-tertiary-container text-on-tertiary-container">
                        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-on-surface">{stage.label}</h4>
                        <p className="text-sm text-on-surface-variant">{stage.desc}</p>
                      </div>
                      <span className="text-xs font-bold text-tertiary uppercase tracking-tighter">Verified</span>
                    </div>
                  )
                }

                if (isCurrent) {
                  return (
                    <div key={stage.key} className="flex items-center gap-6 p-4 rounded-2xl bg-surface-container-lowest border-2 border-primary/10 shadow-lg shadow-primary/5 transition-all">
                      <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-primary text-on-primary">
                        <span className="material-symbols-outlined animate-spin">{stage.icon}</span>
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <h4 className="font-bold text-on-surface">{stage.label}</h4>
                        <p className="text-sm text-on-surface-variant italic truncate">
                          {progress?.message || stage.desc}
                        </p>
                      </div>
                      <div className="w-2 h-2 bg-primary rounded-full availability-pulse"></div>
                    </div>
                  )
                }

                return (
                  <div key={stage.key} className="flex items-center gap-6 p-4 rounded-2xl bg-surface-container-low opacity-60">
                    <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-surface-container-high text-slate-400">
                      <span className="material-symbols-outlined">{stage.icon}</span>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-slate-500">{stage.label}</h4>
                      <p className="text-sm text-slate-400">{stage.desc}</p>
                    </div>
                    <span className="material-symbols-outlined text-slate-300">lock</span>
                  </div>
                )
              })}

              {error && !error.isFinal && (
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl flex items-center gap-3">
                  <span className="material-symbols-outlined text-yellow-500">warning</span>
                  <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
                    Retrying... (attempt {error.retryAttempt}/3)
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: High-end Contextual Cards */}
        <div className="lg:col-span-5 space-y-8 hidden md:block">
          {/* AI Preview Card */}
          <div className="relative overflow-hidden rounded-3xl bg-inverse-surface text-inverse-on-surface p-8 shadow-2xl">
            <div className="absolute -right-8 -top-8 w-48 h-48 bg-primary/20 rounded-full blur-3xl"></div>
            <div className="relative z-10 space-y-6">
              <div className="flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-primary-fixed-dim" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                <span className="text-xs font-bold uppercase tracking-widest text-primary-fixed-dim">Intelligence Preview</span>
              </div>
              <h5 className="text-2xl font-headline font-bold">Scanning Buffer</h5>
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-white/10 backdrop-blur-md border border-white/5 font-mono text-xs text-slate-300">
                  <p className="mb-1">&gt; STAGE: {progress?.stage?.toUpperCase() || 'INITIALIZING'}</p>
                  <p className="mb-1">&gt; ANALYZING INTENT: {progressPercent}% Probability</p>
                  <p className="text-primary-fixed-dim truncate">&gt; LAST MSG: {progress?.message || 'Waiting for events...'}</p>
                </div>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Our LLM is cross-referencing event descriptions with known free-food indicators (e.g., "refreshments", "catered", "pizza").
                </p>
              </div>
            </div>
          </div>

          {/* Campus Map Glimpse */}
          <div className="bg-surface-container-low rounded-3xl overflow-hidden group">
            <div className="h-48 w-full bg-surface-dim relative">
              <img alt="Campus Grid Overlay" className="w-full h-full object-cover mix-blend-overlay grayscale group-hover:scale-110 transition-transform duration-700" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAMSo5F1Cw0haQ-jt3wFF5-H7m2TnD84dVO2k4_q6_h7zTUKSE5f_OroODbwSB6ykYwvuqMNoIxuU60sdUJKVHdZlUuOyBiKOgWqIwWgVXjQKdy2ymGGMLVqYJDt6eglCgvZt-H-SrTwLeOLLBgPXXh0Vh-s2E3aYIC1cobeufFHkUXpXm641DDJXMmtf90t3aUMNcd-T0sxYXXIOK2IjujfgQeWNDoAsKtHmnpwM56XuXwhyODxRQ6kzNFc40CC_lsRiy6qOuOscY"/>
              <div className="absolute inset-0 bg-gradient-to-t from-surface-container-low to-transparent"></div>
              <div className="absolute bottom-4 left-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>location_on</span>
                <span className="text-sm font-bold text-on-surface">Stevens North Campus</span>
              </div>
            </div>
            <div className="p-6">
              <h5 className="font-bold text-on-surface mb-2">Active Target Zones</h5>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 bg-surface-container-highest rounded-full text-xs font-medium text-on-surface-variant">Babbio Center</span>
                <span className="px-3 py-1 bg-surface-container-highest rounded-full text-xs font-medium text-on-surface-variant">Howe Center</span>
                <span className="px-3 py-1 bg-surface-container-highest rounded-full text-xs font-medium text-on-surface-variant">UCC Gateway</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
