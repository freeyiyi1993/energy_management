import { useState, useEffect, useRef } from 'react';
import { Menu, BarChart2 } from 'lucide-react';
import { type StorageData, type PageType, DEFAULT_TASK_DEFS } from '../types';
import { type StorageInterface } from '../storage';
import { isFullPerfectDay, isBadDay } from '../logic';
import EnergyBar from './EnergyBar';
import PomodoroRing from './PomodoroRing';
import TaskGrid from './TaskGrid';
import ActivityLog from './ActivityLog';
import PerfectDayCelebration from './PerfectDayCelebration';
import BadDayWarning from './BadDayWarning';

interface Props {
  data: StorageData;
  storage: StorageInterface;
  onOpenMenu: () => void;
  onDataChange: () => void;
  onNavigate?: (page: PageType) => void;
  flat?: boolean;
  compact?: boolean;
}

export default function MainDashboard({ data, storage, onOpenMenu, onDataChange, onNavigate, flat, compact }: Props) {
  const [showCelebration, setShowCelebration] = useState(false);
  const [showBadDay, setShowBadDay] = useState(false);
  const { state, tasks, config } = data;
  const taskDefs = (data.taskDefs || DEFAULT_TASK_DEFS).filter(d => d.enabled);
  const allTaskDefs = data.taskDefs || DEFAULT_TASK_DEFS;

  const nowPerfect = !!(state && tasks && isFullPerfectDay(tasks, allTaskDefs, state.pomoPerfectCount || 0));
  const nowBad = !!(state && tasks && isBadDay(tasks, state.pomoPerfectCount || 0));
  const prevPerfectRef = useRef<boolean | null>(null);
  const prevBadRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (prevPerfectRef.current === false && nowPerfect) {
      setShowCelebration(true);
    }
    prevPerfectRef.current = nowPerfect;
  }, [nowPerfect]);

  useEffect(() => {
    if (prevBadRef.current === false && nowBad) {
      setShowBadDay(true);
    }
    prevBadRef.current = nowBad;
  }, [nowBad]);

  if (!state || !tasks || !config) return null;

  const card = flat ? 'mb-3' : `bg-white rounded-lg ${compact ? 'p-2 mb-2' : 'p-3 mb-3'} shadow-sm`;
  const cardLast = flat ? '' : `bg-white rounded-lg ${compact ? 'p-2' : 'p-3'} shadow-sm`;

  return (
    <div className="animate-[fadeIn_0.2s_ease]">
      {/* Header */}
      <div className={`flex justify-between items-center ${compact ? 'mb-2' : 'mb-3'} px-1`}>
        <div className="w-7 h-7 flex items-center justify-center cursor-pointer text-gray-600 rounded-md hover:bg-gray-200 transition-colors" onClick={onOpenMenu}>
          <Menu size={20} />
        </div>
        <div className="font-bold text-base text-gray-800">精力管理</div>
        <div className="w-7"></div>
      </div>

      <EnergyBar state={state} className={card} />

      <PomodoroRing state={state} storage={storage} onDataChange={onDataChange} compact={compact} className={card} />

      <TaskGrid tasks={tasks} config={config} taskDefs={taskDefs} storage={storage} onDataChange={onDataChange} className={card} />

      {/* 数据统计入口 */}
      {onNavigate && (
        <div className={card}>
          <button
            className="w-full h-[34px] rounded flex items-center justify-center gap-2 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-colors"
            onClick={() => onNavigate('stats')}
          >
            <BarChart2 size={16} />
            数据统计
          </button>
        </div>
      )}

      <ActivityLog data={data} className={cardLast} />

      {showCelebration && <PerfectDayCelebration onClose={() => setShowCelebration(false)} />}
      {showBadDay && <BadDayWarning onClose={() => setShowBadDay(false)} />}
    </div>
  );
}
