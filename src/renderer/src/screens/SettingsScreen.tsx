import { useState, useEffect } from 'react';
import { CacheInfo } from '../types';

interface Props {
  onBack: () => void;
}

export default function SettingsScreen({ onBack }: Props) {
  const [apiKey, setApiKey] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [cacheInfo, setCacheInfo] = useState<CacheInfo | null>(null);

  useEffect(() => {
    window.api.hasApiKey().then(setHasKey);
    window.api.getCacheInfo().then(setCacheInfo);
  }, []);

  const handleSave = async () => {
    if (!apiKey.trim()) return;
    await window.api.setApiKey(apiKey.trim());
    setHasKey(true);
    setApiKey('');
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClearCache = async () => {
    await window.api.clearCache();
    setCacheInfo(null);
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Page Header */}
      <div className="mb-12 flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 bg-surface-container-high hover:bg-surface-dim rounded-full transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-on-surface">arrow_back</span>
        </button>
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-on-background mb-2">System Preferences</h1>
          <p className="text-on-surface-variant text-lg">Manage your API credentials, data storage, and application behavior.</p>
        </div>
      </div>

      {/* Bento Layout Sections */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Primary Settings Card (API) */}
        <section className="md:col-span-2 space-y-8">
          <div className="bg-surface-container-lowest p-8 rounded-xl shadow-sm border border-outline-variant/10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <span className="material-symbols-outlined">key</span>
              </div>
              <h2 className="text-xl font-bold text-on-background">Vision Model Authentication</h2>
            </div>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-on-surface-variant flex justify-between" htmlFor="nvidia-api">
                  NVIDIA API Key
                  <span className="text-xs font-normal opacity-60">Required for food identification</span>
                </label>
                <div className="relative">
                  <input 
                    id="nvidia-api" 
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={hasKey ? 'nvapi-xxxxxxxxxxxxxxxxxxxxxxxx (Saved)' : 'nv_api-xxxxxxxxxxxxxxxxxxxxxxxx'}
                    className="w-full bg-surface-container-highest border-0 border-b-2 border-primary/20 focus:border-primary focus:ring-0 rounded-t-lg px-4 py-4 font-mono text-sm transition-all" 
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-tertiary-container/10 rounded-lg border border-tertiary-container/20">
                <div className="flex-shrink-0 text-tertiary-container">
                  <span className="material-symbols-outlined">verified_user</span>
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-tertiary-container">Secure Keychain Integration</h4>
                  <p className="text-xs text-tertiary-container/80">Keys are stored locally in your system's encrypted vault.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked disabled />
                  <div className="w-11 h-6 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>

              <div className="flex justify-end pt-2">
                <button 
                  onClick={handleSave}
                  disabled={!apiKey.trim()}
                  className="bg-gradient-to-br from-primary to-primary-container text-on-primary px-8 py-3 rounded-full font-bold shadow-md hover:shadow-lg active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saved ? 'Saved!' : 'Update Credentials'}
                </button>
              </div>
            </div>
          </div>

          {/* Scan Data Management */}
          <div className="bg-surface-container-low p-8 rounded-xl border border-outline-variant/10">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-on-surface-variant/10 flex items-center justify-center text-on-surface-variant">
                  <span className="material-symbols-outlined">database</span>
                </div>
                <h2 className="text-xl font-bold text-on-background">Local Cache</h2>
              </div>
              <span className="text-xs font-bold px-3 py-1 bg-surface-container-high rounded-full text-on-surface-variant">
                {cacheInfo ? `${cacheInfo.eventCount} Events` : 'Empty'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              <div className="bg-surface-container-lowest p-5 rounded-xl flex items-start gap-4">
                <span className="material-symbols-outlined text-primary">image</span>
                <div>
                  <p className="text-sm font-bold">Image Cache</p>
                  <p className="text-xs text-on-surface-variant">Auto-managed</p>
                </div>
              </div>
              <div className="bg-surface-container-lowest p-5 rounded-xl flex items-start gap-4">
                <span className="material-symbols-outlined text-primary">history</span>
                <div>
                  <p className="text-sm font-bold">Event History</p>
                  <p className="text-xs text-on-surface-variant">{cacheInfo ? cacheInfo.date : 'None'}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              <button 
                onClick={handleClearCache}
                className="w-full sm:w-auto px-6 py-3 text-error font-bold rounded-full hover:bg-error/5 transition-colors flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">delete_sweep</span>
                Clear All Data
              </button>
            </div>
          </div>
        </section>

        {/* Sidebar Metadata Sections */}
        <aside className="space-y-8">
          {/* App Status Card */}
          <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm border border-outline-variant/10">
            <h3 className="text-sm font-bold text-on-surface-variant uppercase tracking-wider mb-6">Application Info</h3>
            <div className="space-y-6">
              <div className="flex justify-between items-center pb-4 border-b border-surface-container-low">
                <span className="text-sm font-medium opacity-70">Version</span>
                <span className="text-sm font-bold font-headline">v1.0.0-stable</span>
              </div>
              <div className="flex justify-between items-center pb-4 border-b border-surface-container-low">
                <span className="text-sm font-medium opacity-70">Build Type</span>
                <span className="text-xs font-bold px-2 py-0.5 bg-tertiary-container/20 text-tertiary-container rounded">PROD-DARWIN</span>
              </div>
              <div className="flex justify-between items-center pb-4 border-b border-surface-container-low">
                <span className="text-sm font-medium opacity-70">Last Sync</span>
                <span className="text-sm font-medium">{cacheInfo ? 'Today' : 'Never'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium opacity-70">Status</span>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-tertiary shadow-[0_0_8px_rgba(0,73,58,0.5)]"></div>
                  <span className="text-sm font-bold text-tertiary">Connected</span>
                </div>
              </div>
            </div>
          </div>

          {/* Campus Visual */}
          <div className="relative h-64 rounded-2xl overflow-hidden group shadow-xl">
            <img alt="Stevens Campus" className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBzKUl5WXu2Ddb4KGIp32Txiu3WtwpMapPYquu7m3XX0W8NWrYpTmj2qz8KOzJpX7MLHNtlMBoAUw7CwrB821I4dxhSW2ISlUGMbiV5HGNLhquAhB-AUilE9f0sPE4aRGftB-n8R8UZn74z15mAhtXZY6HT3N_bSb5BRNt3kdN65ZxcmDDuGXN4_XuHAtA-zSItJC1PAQdCRnCX4M2OS7C46nrDJtQCZdm2O7D0JNoyTVGbpblmL4cJMhVfrmnFVMwil2OwXAOpWSo"/>
            <div className="absolute inset-0 bg-gradient-to-t from-primary/80 to-transparent flex flex-col justify-end p-6">
              <p className="text-white/80 text-xs font-bold uppercase tracking-widest mb-1">Location</p>
              <h4 className="text-white text-xl font-bold font-headline">Hoboken Campus</h4>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
