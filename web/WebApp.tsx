import { useState, useEffect } from 'react';
import { storage } from './storage';
import { initWebData, startWebTicker, stopWebTicker, setLowEnergyCallback, setPomodoroCompleteCallback } from './web-ticker';
import { type StorageData, type PageType } from '../shared/types';
import { checkPomodoroExpired } from '../shared/logic';
import MainDashboard from '../shared/components/MainDashboard';
import RulesPage from '../shared/components/RulesPage';
import StatsPage from '../shared/components/StatsPage';
import SettingsPage from '../shared/components/SettingsPage';
import MenuPanel from '../shared/components/MenuPanel';
import AuthPanel from './components/AuthPanel';
import FinishOverlay from './components/FinishOverlay';

type OverlayState =
  | null
  | { type: 'energy' }
  | { type: 'pomodoro'; forcedBreak: boolean };

export default function WebApp() {
  const [currentPage, setCurrentPage] = useState<PageType>('main');
  const [menuOpen, setMenuOpen] = useState(false);
  const [data, setData] = useState<StorageData | null>(null);
  const [ready, setReady] = useState(false);
  const [overlay, setOverlay] = useState<OverlayState>(null);

  const fetchData = async () => {
    const result = await storage.get(null);
    setData(result as StorageData);
  };

  // 页面刷新时检查是否需要显示低精力提醒
  useEffect(() => {
    if (data?.state && data.state.energy < 20 && !data.state.lowEnergyReminded) {
      setOverlay({ type: 'energy' });
      storage.set({ state: { ...data.state, lowEnergyReminded: true } });
    }
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const init = async () => {
      await initWebData();
      setLowEnergyCallback(() => {
        setOverlay({ type: 'energy' });
      });
      setPomodoroCompleteCallback((forcedBreak) => {
        setOverlay(prev => prev ?? { type: 'pomodoro', forcedBreak });
        fetchData();
      });
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
      setLowEnergyCallback(null);
      setPomodoroCompleteCallback(null);
    };
  }, [currentPage]);

  // 客户端检测番茄钟时间到（不等 60s ticker）
  useEffect(() => {
    if (data?.state?.pomodoro.status !== 'ongoing') return;

    const checkCompletion = async () => {
      const d = await storage.get(['state']) as StorageData;
      if (!d.state || d.state.pomodoro.status !== 'ongoing') return;

      const now = Date.now();
      const result = checkPomodoroExpired(d.state.pomodoro, now);
      if (result.expired) {
        d.state.pomodoro.status = 'idle';
        d.state.pomodoro.startedAt = undefined;
        d.state.pomodoro.updatedAt = now;
        d.state.pomodoro.consecutiveCount = result.newConsecutiveCount;
        d.state.lastUpdateTime = now;
        await storage.set({ state: d.state });
        fetchData();
        setOverlay(prev => prev ?? { type: 'pomodoro', forcedBreak: result.isForcedBreak });
      }
    };

    const timer = setInterval(checkCompletion, 1000);
    return () => clearInterval(timer);
  }, [data?.state?.pomodoro.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const navigateTo = (page: PageType) => {
    setCurrentPage(page);
    setMenuOpen(false);
  };

  const handleOverlayClose = () => {
    setOverlay(null);
    fetchData();
  };

  if (!ready || !data || !data.state) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gray-50 flex flex-col items-center px-4">
        <div className="w-full max-w-md relative flex flex-col flex-1 min-h-0 pt-4">
          <div className="flex-1 overflow-y-auto min-h-0 pb-12">
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
                flat
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

          <AuthPanel onSynced={() => fetchData()} />
        </div>
      </div>

      {/* 全屏覆盖层 */}
      {overlay && (
        <FinishOverlay
          type={overlay.type}
          forcedBreak={overlay.type === 'pomodoro' ? overlay.forcedBreak : undefined}
          onClose={handleOverlayClose}
        />
      )}
    </>
  );
}
