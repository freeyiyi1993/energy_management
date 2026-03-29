import { useState, useEffect } from 'react';
import { storage } from './storage';
import { initWebData, startWebTicker, stopWebTicker } from './web-ticker';
import { type StorageData } from '../shared/types';
import MainDashboard from '../shared/components/MainDashboard';
import RulesPage from '../shared/components/RulesPage';
import StatsPage from '../shared/components/StatsPage';
import SettingsPage from '../shared/components/SettingsPage';
import MenuPanel from '../shared/components/MenuPanel';
import AuthPanel from './components/AuthPanel';

import { type PageType } from '../shared/types';

export default function WebApp() {
  const [currentPage, setCurrentPage] = useState<PageType>('main');
  const [menuOpen, setMenuOpen] = useState(false);
  const [data, setData] = useState<StorageData | null>(null);
  const [ready, setReady] = useState(false);

  const fetchData = async () => {
    const result = await storage.get(null);
    setData(result as StorageData);
  };

  useEffect(() => {
    const init = async () => {
      await initWebData();
      startWebTicker();
      await fetchData();
      setReady(true);
    };
    init();

    const interval = setInterval(() => {
      if (currentPage === 'main') fetchData();
    }, 1000);

    return () => {
      clearInterval(interval);
      stopWebTicker();
    };
  }, [currentPage]);

  const navigateTo = (page: PageType) => {
    setCurrentPage(page);
    setMenuOpen(false);
  };

  if (!ready || !data || !data.state) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-start justify-center pt-8 pb-8">
      <div className="w-[360px] bg-gray-50 rounded-2xl shadow-xl overflow-hidden relative">
        <div className="p-2.5 min-h-[400px]">
          <MenuPanel
            isOpen={menuOpen}
            onClose={() => setMenuOpen(false)}
            onNavigate={navigateTo}
          />

          {currentPage === 'main' && (
            <MainDashboard
              data={data}
              storage={storage}
              onOpenMenu={() => setMenuOpen(true)}
              onDataChange={fetchData}
            />
          )}

          {currentPage === 'rules' && <RulesPage data={data} onBack={() => navigateTo('main')} />}

          {currentPage === 'stats' && (
            <StatsPage data={data} onBack={() => navigateTo('main')} />
          )}

          {currentPage === 'settings' && (
            <SettingsPage data={data} storage={storage} onBack={() => navigateTo('main')} onSaved={fetchData} />
          )}
        </div>

        {/* 底部同步面板 */}
        <AuthPanel onSynced={fetchData} />
      </div>
    </div>
  );
}
