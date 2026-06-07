import React, { useEffect, useState } from 'react';
import { ToastProvider } from '@shared/components/Toast';
import { useAppTheme } from '@shared/hooks/useAppTheme';
import { useSettingsStore } from '@shared/stores/settingsStore';
import { useProfileStore } from '@shared/stores/profileStore';
import { useFavoritesStore } from '@shared/stores/favoritesStore';
import { SearchTab } from './tabs/SearchTab';
import { ConfigTab } from './tabs/ConfigTab';
import { AboutTab } from './tabs/AboutTab';
import { ArrowLeft, Settings, Info } from 'lucide-react';

type Tab = 'search' | 'config' | 'about';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('search');
  const loadSettings = useSettingsStore((s) => s.load);
  const loadProfiles = useProfileStore((s) => s.load);
  const loadFavorites = useFavoritesStore((s) => s.load);

  useAppTheme();

  useEffect(() => {
    loadSettings();
    loadProfiles();
    loadFavorites();
  }, [loadSettings, loadProfiles, loadFavorites]);

  const onSearch = activeTab !== 'search';

  return (
    <div className="w-[440px] max-h-[580px] flex flex-col bg-surface-50 dark:bg-surface-900 text-surface-900 dark:text-surface-100">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-brand-900 text-surface-50 shrink-0">
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold leading-tight tracking-tight">Table It D365FO</h1>
        </div>
        <nav className="flex items-center gap-0.5 shrink-0">
          {/* Back arrow — only when not on search */}
          {onSearch && (
            <button
              type="button"
              onClick={() => setActiveTab('search')}
              title="Back"
              className="p-2 rounded-lg text-white hover:bg-white/10 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveTab('config')}
            title="Config"
            className={[
              'p-2 rounded-lg transition-colors',
              activeTab === 'config' ? 'bg-white/20 text-white border border-white/30' : 'text-white hover:bg-white/10',
            ].join(' ')}
          >
            <Settings className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('about')}
            title="About"
            className={[
              'p-2 rounded-lg transition-colors',
              activeTab === 'about' ? 'bg-white/20 text-white border border-white/30' : 'text-white hover:bg-white/10',
            ].join(' ')}
          >
            <Info className="w-5 h-5" />
          </button>
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col min-h-0">
        {activeTab === 'search' && <SearchTab />}
        {activeTab === 'config' && (
          <div className="flex-1 min-h-0 overflow-y-auto">
            <ConfigTab />
          </div>
        )}
        {activeTab === 'about' && (
          <div className="flex-1 min-h-0 overflow-y-auto">
            <AboutTab />
          </div>
        )}
      </div>
    </div>
  );
}

export function PopupApp() {
  return (
    <ToastProvider>
      <App />
    </ToastProvider>
  );
}
