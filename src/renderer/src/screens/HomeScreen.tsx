import { useState, useEffect } from 'react'
import { CacheInfo } from '../types'

interface Props {
  onScan: () => void
  onLoadCached: () => void
  onSettings: () => void
}

export default function HomeScreen({ onScan, onLoadCached, onSettings }: Props) {
  const [hasKey, setHasKey] = useState(false)
  const [cacheInfo, setCacheInfo] = useState<CacheInfo | null>(null)

  useEffect(() => {
    window.api.hasApiKey().then(setHasKey)
    window.api.getCacheInfo().then((info) => {
      if (info) {
        const today = new Date().toISOString().split('T')[0]
        if (info.date === today) {
          setCacheInfo(info)
        }
      }
    })
  }, [])

  return (
    <div className="max-w-6xl mx-auto">
      {/* Hero Header Section (Asymmetric) */}
      <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 mb-4">
            <div className="availability-pulse"></div>
            <span className="text-xs font-bold uppercase tracking-widest text-tertiary">System Online</span>
          </div>
          <h1 className="font-headline text-5xl font-extrabold text-on-surface tracking-tight mb-4">
            Intelligent Food <br/><span className="text-primary">Discovery.</span>
          </h1>
          <p className="text-on-surface-variant text-lg leading-relaxed max-w-lg">
            Leverage vision-based scanning to locate nutritional opportunities across the Stevens Institute campus. Real-time, academic precision.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <button 
            onClick={onScan}
            disabled={!hasKey}
            className={`bg-gradient-to-br from-primary to-primary-container text-on-primary rounded-full py-4 px-10 font-bold text-lg shadow-lg hover:shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3 ${!hasKey ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <span className="material-symbols-outlined">flare</span>
            Start New Scan
          </button>
          {cacheInfo && (
            <button 
              onClick={onLoadCached}
              className="bg-surface-container-high text-primary font-semibold py-3 px-10 rounded-full hover:bg-surface-dim transition-colors text-center cursor-pointer"
            >
              Load Cached Results
            </button>
          )}
        </div>
      </header>

      {/* Warning Banner */}
      {!hasKey && (
        <div className="mb-10 p-6 rounded-xl bg-error-container/40 flex items-start gap-4 border-l-4 border-error editorial-shadow">
          <span className="material-symbols-outlined text-error mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
          <div>
            <h3 className="font-bold text-on-error-container text-base">API Configuration Required</h3>
            <p className="text-sm text-on-error-container/80 mt-1">
              Your NVIDIA API key is not yet configured. Live vision processing is currently disabled. Please visit <button onClick={onSettings} className="font-bold underline decoration-error/30 hover:decoration-error cursor-pointer">Settings</button> to resolve this.
            </p>
          </div>
        </div>
      )}

      {/* Dashboard Grid (Bento Style) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Large Status Card */}
        <div className="md:col-span-8 p-8 rounded-2xl bg-surface-container-lowest editorial-shadow flex flex-col relative overflow-hidden group">
          <div className="absolute -right-16 -top-16 w-64 h-64 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-colors"></div>
          <div className="relative z-10 flex flex-col h-full">
            <div className="flex justify-between items-start mb-12">
              <div>
                <span className="text-xs font-bold text-primary tracking-widest uppercase mb-1 block">Recent History</span>
                <h3 className="text-2xl font-headline font-bold">Academic Quadrangles</h3>
              </div>
              {cacheInfo && (
                <span className="px-3 py-1 bg-tertiary-container text-on-tertiary-container text-xs font-bold rounded-full">Scanned recently</span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-8 mt-auto">
              <div>
                <p className="text-3xl font-headline font-extrabold text-on-surface">{cacheInfo ? cacheInfo.eventCount : '-'}</p>
                <p className="text-xs text-on-surface-variant font-medium uppercase tracking-tighter">Items Found</p>
              </div>
              <div>
                <p className="text-3xl font-headline font-extrabold text-on-surface">-</p>
                <p className="text-xs text-on-surface-variant font-medium uppercase tracking-tighter">Hot Zones</p>
              </div>
              <div>
                <p className="text-3xl font-headline font-extrabold text-on-surface">94%</p>
                <p className="text-xs text-on-surface-variant font-medium uppercase tracking-tighter">Scan Accuracy</p>
              </div>
            </div>
          </div>
        </div>

        {/* Secondary Small Card */}
        <div className="md:col-span-4 p-8 rounded-2xl bg-surface-container-low flex flex-col justify-between">
          <div>
            <span className="material-symbols-outlined text-primary mb-4" style={{ fontVariationSettings: "'opsz' 48" }}>settings_input_component</span>
            <h4 className="font-headline font-bold text-lg mb-2">Configure Parameters</h4>
            <p className="text-sm text-on-surface-variant">Adjust your scan radius and dietary preference filters for more precise discovery.</p>
          </div>
          <button onClick={onSettings} className="text-primary font-bold text-sm flex items-center gap-2 hover:gap-3 transition-all cursor-pointer">
            Open Settings <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </button>
        </div>

        {/* Image Feature Card */}
        <div className="md:col-span-4 rounded-2xl overflow-hidden h-64 relative editorial-shadow group">
          <img alt="Academic Building" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" src="https://lh3.googleusercontent.com/aida-public/AB6AXuACt3n2lq1yS_pGbRCnWIQzCtjNeKhpjDuOb_WdLDpwz2T2-IZzh5xqwBl829yILB3MlLSlWhuqmDu_2llqagcIX4zhVPnG8jaCQK1ElPOUikIkhkKnyqo-9n7d-iFzXjNGai1O86j0QAMrchSQBA2U89vGXGlxsuvX29wyQ8GL5ylZFH1hBJEZp0Nl1KHqwpnLT_uXxKg25IgxxR-wt5DG0NKhZoJzsfu13AZL6xsuh4EL2FkBKZBM5ZBJOxoqHgU9KKJ6Y5vF8cQ"/>
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-6">
            <p className="text-white font-headline font-bold text-lg">Babbio Center</p>
            <p className="text-white/70 text-xs">Recommended Starting Point</p>
          </div>
        </div>

        {/* Location Insight Card */}
        <div className="md:col-span-8 p-8 rounded-2xl bg-surface-container-lowest flex flex-col md:flex-row gap-8 editorial-shadow items-center">
          <div className="w-full md:w-1/3 aspect-square rounded-xl bg-surface-container overflow-hidden">
            <img alt="Campus Map" className="w-full h-full object-cover grayscale opacity-80 hover:grayscale-0 transition-all duration-300" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCEvakb07xtoFUIGPoo-Qf0gDhTVpJGc0L7BFZ-d7nmO-E81GYfIy8g80kMqELGvBEA_oiLj6Z16C4CEn4_ldNjZXeZbx0yEvR9aEL5Xlw_yBx95OqNROnTPT463MDwu67IKLh_W4c4-gWV3mik7Q_x4OtQP67RX5tiPO4nen1S0d0ZaWonE5VFSlHH1wZvR8b-5BHCZmowJb8aAJuuYBR14rF_9JqqpRH47HauKQdWvrdjk2avpFiUFBXqWOGVhPByIzwRon7i_dw"/>
          </div>
          <div className="flex-1">
            <h4 className="font-headline font-bold text-xl mb-3">Geospatial Awareness</h4>
            <p className="text-on-surface-variant text-sm leading-relaxed mb-6">
              The Concierge uses multi-layer mapping to track events across the entire Stevens skyline. From the Howe Center to Gateway South, no refreshment goes unlogged.
            </p>
            <div className="flex gap-4">
              <span className="flex items-center gap-1.5 text-xs font-bold text-on-surface-variant">
                <span className="material-symbols-outlined text-sm">near_me</span> 4 Destinations
              </span>
              <span className="flex items-center gap-1.5 text-xs font-bold text-on-surface-variant">
                <span className="material-symbols-outlined text-sm">group</span> 120+ Active Users
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
