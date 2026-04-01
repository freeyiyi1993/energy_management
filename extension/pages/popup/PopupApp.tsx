import { useState, useEffect, lazy, Suspense } from 'react';
import MainDashboard from '../../../shared/components/MainDashboard';
import RulesPage from '../../../shared/components/RulesPage';
import SettingsPage from '../../../shared/components/SettingsPage';
import MenuPanel from '../../../shared/components/MenuPanel';
import ErrorBoundary from '../../../shared/components/ErrorBoundary';
import SyncPanel from '../../components/SyncPanel';
import { type StorageData, type PageType } from '../../../shared/types';
import { storage } from '../../storage';

const StatsPage = lazy(() => import('../../../shared/components/StatsPage'));

export default function PopupApp() {
  const [currentPage, setCurrentPage] = useState<PageType>('main');
  const [menuOpen, setMenuOpen] = useState(false);
  const [data, setData] = useState<StorageData | null>(null);

  const fetchData = async () => {
    try {
      const result = await storage.get(null);
      setData(result);
    } catch {
      // storage 读取失败时保持上次数据
    }
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
    <ErrorBoundary>
    <div className="relative bg-gray-50 p-2.5 pb-12">
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
          onNavigate={navigateTo}
          compact
        />
      )}

      {currentPage === 'rules' && <RulesPage data={data} onBack={() => navigateTo('main')} />}

      {currentPage === 'stats' && (
        <Suspense fallback={<div className="p-4 text-center text-gray-500">加载中...</div>}>
          <StatsPage data={data} onBack={() => navigateTo('main')} />
        </Suspense>
      )}

      {currentPage === 'settings' && (
        <SettingsPage data={data} storage={storage} onBack={() => navigateTo('main')} onSaved={fetchData} />
      )}

      <SyncPanel onSynced={fetchData} />
    </div>
    </ErrorBoundary>
  );
}
