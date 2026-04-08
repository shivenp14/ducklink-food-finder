import React from 'react'

interface LayoutProps {
  children: React.ReactNode
  currentScreen: 'home' | 'scanning' | 'results' | 'settings'
  onNavigate: (screen: 'home' | 'scanning' | 'results' | 'settings') => void
}

export default function Layout({ children, currentScreen, onNavigate }: LayoutProps) {
  return (
    <div className="bg-surface font-body text-on-surface min-h-screen">
      {/* Side Navigation Bar */}
      <aside className="hidden lg:flex flex-col h-screen w-64 fixed left-0 top-0 py-6 px-4 bg-slate-50 dark:bg-slate-950 z-40">
        <div className="mb-8 px-2">
          <h2 className="font-headline font-extrabold text-red-900 text-lg leading-tight">Academic Concierge</h2>
          <p className="text-xs text-on-surface-variant font-medium">Stevens Institute</p>
        </div>
        <div className="flex flex-col gap-1 grow">
          <button 
            className={`flex items-center gap-3 px-4 py-3 font-bold transition-all duration-200 ease-in-out text-left rounded-lg ${currentScreen === 'home' || currentScreen === 'scanning' ? 'text-red-800 border-r-4 border-red-800 bg-red-50/50' : 'text-slate-600 hover:bg-slate-200'}`}
            onClick={() => onNavigate('home')}
          >
            <span className="material-symbols-outlined">radar</span>
            <span className="text-sm">Live Feed</span>
          </button>
        </div>
        <div className="mt-auto flex flex-col gap-1 pt-6 border-t border-surface-container">
          <button 
            className={`flex items-center gap-3 px-4 py-2 transition-colors text-sm rounded-lg ${currentScreen === 'settings' ? 'text-red-800 font-bold bg-red-50/50' : 'text-slate-600 hover:bg-slate-200'}`}
            onClick={() => onNavigate('settings')}
          >
            <span className="material-symbols-outlined text-sm">settings</span>
            <span>Settings</span>
          </button>
        </div>
      </aside>

      {/* Main Content Canvas */}
      <main className="lg:ml-64 pt-12 pb-24 lg:pb-12 px-6 md:px-12 lg:px-20 min-h-screen bg-surface">
        {children}
      </main>

      {/* Mobile Bottom Nav */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-slate-200 py-2 px-4 flex justify-around items-center z-50">
        <button 
          className={`flex flex-col items-center gap-1 ${currentScreen === 'home' || currentScreen === 'scanning' ? 'text-red-800' : 'text-slate-500'}`}
          onClick={() => onNavigate('home')}
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: currentScreen === 'home' || currentScreen === 'scanning' ? "'FILL' 1" : "'FILL' 0" }}>radar</span>
          <span className="text-[10px] font-bold">Feed</span>
        </button>
        <button 
          className={`flex flex-col items-center gap-1 ${currentScreen === 'settings' ? 'text-red-800' : 'text-slate-500'}`}
          onClick={() => onNavigate('settings')}
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: currentScreen === 'settings' ? "'FILL' 1" : "'FILL' 0" }}>settings</span>
          <span className="text-[10px] font-medium">Settings</span>
        </button>
      </div>
    </div>
  )
}
