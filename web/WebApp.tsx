import { useState, useEffect, useRef } from 'react';
import { storage } from './storage';
import { initWebData, startWebTicker, stopWebTicker, setLowEnergyCallback } from './web-ticker';
import { type StorageData } from '../shared/types';
import MainDashboard from '../shared/components/MainDashboard';
import RulesPage from '../shared/components/RulesPage';
import StatsPage from '../shared/components/StatsPage';
import SettingsPage from '../shared/components/SettingsPage';
import MenuPanel from '../shared/components/MenuPanel';
import AuthPanel from './components/AuthPanel';
import FinishOverlay from './components/FinishOverlay';

import { type PageType } from '../shared/types';

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

  const prevRunningRef = useRef(false);
  const prevConsecutiveRef = useRef(0);

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
    };
  }, [currentPage]);

  // 客户端检测番茄钟时间到（不等 60s ticker）
  useEffect(() => {
    if (!data?.state?.pomodoro.running) return;

    const checkCompletion = async () => {
      const elapsed = (Date.now() - data.state!.lastUpdateTime) / 1000;
      const realTimeLeft = data.state!.pomodoro.timeLeft - elapsed;

      if (realTimeLeft <= 0) {
        const d = await storage.get(['state']) as StorageData;
        if (d.state && d.state.pomodoro.running) {
          d.state.pomodoro.running = false;
          d.state.pomodoro.timeLeft = 25 * 60;
          d.state.pomodoro.consecutiveCount = (d.state.pomodoro.consecutiveCount || 0) + 1;
          if (d.state.pomodoro.consecutiveCount >= 3) {
            d.state.pomodoro.consecutiveCount = 0;
          }
          d.state.lastUpdateTime = Date.now();
          await storage.set({ state: d.state });
          fetchData();
        }
      }
    };

    const timer = setInterval(checkCompletion, 1000);
    return () => clearInterval(timer);
  }, [data?.state?.pomodoro.running, data?.state?.lastUpdateTime]); // eslint-disable-line react-hooks/exhaustive-deps

  // 检测番茄钟完成：running 从 true → false
  useEffect(() => {
    if (!data?.state || overlay) return;

    const { pomodoro } = data.state;

    if (prevRunningRef.current && !pomodoro.running) {
      const wasForcedBreak = prevConsecutiveRef.current >= 2;
      setOverlay({ type: 'pomodoro', forcedBreak: wasForcedBreak });
    }

    prevRunningRef.current = pomodoro.running;
    prevConsecutiveRef.current = pomodoro.consecutiveCount;
  }, [data, overlay]);

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

          <AuthPanel onSynced={fetchData} />
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
