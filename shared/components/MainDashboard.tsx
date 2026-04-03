import { useState, useEffect, useRef } from 'react';
import { Menu, BarChart2 } from 'lucide-react';
import { type StorageData, type PageType, DEFAULT_TASK_DEFS, DEFAULT_CONFIG } from '../types';
import { type StorageInterface, migrateTaskDefs } from '../storage';
import { isFullPerfectDay, isBadDay } from '../logic';
import { PERFECT_DAY_ACTION_ID } from '../constants/actionMapping';
import EnergyBar from './EnergyBar';
import PomodoroRing from './PomodoroRing';
import TaskGrid from './TaskGrid';
import ActivityLog from './ActivityLog';
import DayResultModal, { type DayResultType } from './DayResultModal';

// 防止 main→settings→main 来回导航重复弹窗
export const shownThisSession = new Set<string>();

/** 检测布尔值变为 true（含首次加载已为 true），同一会话内只触发一次 */
function useTransition(value: boolean, key: string): boolean {
  const prevRef = useRef(false);
  const [fired, setFired] = useState(false);

  useEffect(() => {
    if (!prevRef.current && value && !shownThisSession.has(key)) {
      shownThisSession.add(key);
      setFired(true);
    }
    prevRef.current = value;
  }, [value, key]);

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
  const allTaskDefs = migrateTaskDefs(data.taskDefs) || DEFAULT_TASK_DEFS;
  const taskDefs = allTaskDefs.filter(d => d.enabled);

  // 弹窗要求任务 + 完美番茄（isFullPerfectDay），和日切 maxEnergy 奖励一致
  const nowPerfect = !!(state && tasks && isFullPerfectDay(tasks, allTaskDefs, state.pomoPerfectCount || 0));
  const nowBad = !!(state && tasks && isBadDay(tasks, state.pomoPerfectCount || 0));
  const logicalDate = state?.logicalDate || '';
  const perfectFired = useTransition(nowPerfect, `perfect-${logicalDate}`);
  const badFired = useTransition(nowBad, `bad-${logicalDate}`);

  const [dayResult, setDayResult] = useState<DayResultType | null>(null);

  const handlePerfectDay = async () => {
    if (!shownThisSession.has(`perfect-${logicalDate}`)) {
      shownThisSession.add(`perfect-${logicalDate}`);
      setDayResult('perfect');
      // 即时生效：maxEnergy +bonus，同步 config 和 state，写入日志
      const d = await storage.get(['state', 'logs', 'config']);
      if (d.state) {
        const cfg = d.config || config || DEFAULT_CONFIG;
        const bonus = cfg.perfectDayBonus;
        const oldMax = d.state.maxEnergy;
        const newMax = oldMax + bonus;
        d.state.maxEnergy = newMax;
        cfg.maxEnergy = newMax;
        const logs = d.logs || [];
        logs.unshift([Date.now(), PERFECT_DAY_ACTION_ID, newMax, bonus]);
        await storage.set({ state: d.state, config: cfg, logs });
        onDataChange();
      }
    }
  };

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

      <EnergyBar state={state} config={config} tasks={tasks} className={card} />

      <PomodoroRing state={state} storage={storage} onDataChange={onDataChange} compact={compact} className={`${card} ${flat ? 'my-5' : 'my-4'}`} />

      <TaskGrid tasks={tasks} config={config} taskDefs={taskDefs} storage={storage} onDataChange={onDataChange} onPerfectDay={handlePerfectDay} className={card} />

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
