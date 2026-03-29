import { useState, useEffect } from 'react';
import MainDashboard from '../../../shared/components/MainDashboard';
import RulesPage from '../../../shared/components/RulesPage';
import StatsPage from '../../../shared/components/StatsPage';
import SettingsPage from '../../../shared/components/SettingsPage';
import MenuPanel from '../../../shared/components/MenuPanel';
import { type StorageData, type PageType } from '../../../shared/types';
import { storage } from '../../storage';

export default function PopupApp() {
  const [currentPage, setCurrentPage] = useState<PageType>('main');
  const [menuOpen, setMenuOpen] = useState(false);
  const [data, setData] = useState<StorageData | null>(null);

  const fetchData = async () => {
    const result = await storage.get(null);
    setData(result as StorageData);
  };

  useEffect(() => {
    setTimeout(fetchData, 0);
    const interval = setInterval(() => {
      if (currentPage === 'main') {
        fetchData();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [currentPage]);

  const navigateTo = (page: PageType) => {
    setCurrentPage(page);
    setMenuOpen(false);
  };

  if (!data || !data.state) {
    return <div className="p-4 text-center text-gray-500">加载中...</div>;
  }

  return (
    <div className="relative min-h-[400px] bg-gray-50 p-2.5">
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
  );
}
