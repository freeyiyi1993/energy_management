import { useState, useEffect, useRef } from 'react';
import { Menu, BarChart2 } from 'lucide-react';
import { type StorageData, type PageType, DEFAULT_TASK_DEFS } from '../types';
import { type StorageInterface } from '../storage';
import { isFullPerfectDay, isBadDay } from '../logic';
import EnergyBar from './EnergyBar';
import PomodoroRing from './PomodoroRing';
import TaskGrid from './TaskGrid';
import ActivityLog from './ActivityLog';
import DayResultModal, { type DayResultType } from './DayResultModal';

/** 检测布尔值从 false 变为 true，首次渲染不触发 */
function useTransition(value: boolean): boolean {
  const prevRef = useRef<boolean | null>(null);
  const [fired, setFired] = useState(false);

  useEffect(() => {
    if (prevRef.current === false && value) {
      setFired(true);
    }
    prevRef.current = value;
  }, [value]);

  return fired;
}

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
  const { state, tasks, config } = data;
  const allTaskDefs = data.taskDefs || DEFAULT_TASK_DEFS;
  const taskDefs = allTaskDefs.filter(d => d.enabled);

  const nowPerfect = !!(state && tasks && isFullPerfectDay(tasks, allTaskDefs, state.pomoPerfectCount || 0));
  // 弹窗需 sleep 已录入才触发（避免开局全 null 就弹），日切惩罚用 isBadDay 不需此限制
  const nowBad = !!(state && tasks && tasks['sleep'] != null && isBadDay(tasks, state.pomoPerfectCount || 0));
  const perfectFired = useTransition(nowPerfect);
  const badFired = useTransition(nowBad);

  const [dayResult, setDayResult] = useState<DayResultType | null>(null);

  useEffect(() => {
    if (perfectFired) setDayResult('perfect');
  }, [perfectFired]);

  useEffect(() => {
    if (badFired && !perfectFired) setDayResult('bad');
  }, [badFired, perfectFired]);

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

      {dayResult && <DayResultModal type={dayResult} onClose={() => setDayResult(null)} />}
    </div>
  );
}
