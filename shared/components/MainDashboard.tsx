import { Menu, Play, RefreshCw, BarChart2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { type StorageData, type CustomTaskDef, type PageType, type CompactLog, DEFAULT_TASK_DEFS } from '../types';
import { type StorageInterface } from '../storage';


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
  const taskDefs = (data.taskDefs || DEFAULT_TASK_DEFS).filter(d => d.enabled);

  const [localInputs, setLocalInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!tasks) return;
    setLocalInputs(prev => {
      const next = { ...prev };
      taskDefs.forEach(def => {
        if (def.type === 'number' && tasks[def.id] !== null && tasks[def.id] !== undefined) {
          next[def.id] = String(tasks[def.id]);
        }
      });
      return next;
    });
  }, [tasks]);

  if (!state || !tasks || !config) return null;

  const card = flat ? 'mb-3' : `bg-white rounded-lg ${compact ? 'p-2 mb-2' : 'p-3 mb-3'} shadow-sm`;
  const cardLast = flat ? '' : `bg-white rounded-lg ${compact ? 'p-2' : 'p-3'} shadow-sm`;
  const energyPercent = (state.energy / state.maxEnergy) * 100;
  let barColor = '#10b981';
  if (state.energy < 20) barColor = '#ef4444';
  else if (state.energy < 40) barColor = '#f59e0b';

  const elapsedSec = state.pomodoro.running ? (Date.now() - state.lastUpdateTime) / 1000 : 0;
  const realTimeLeft = Math.max(0, state.pomodoro.timeLeft - elapsedSec);
  const pomoPercent = 100 - (realTimeLeft / (25 * 60)) * 100;
  const m = Math.floor(realTimeLeft / 60).toString().padStart(2, '0');
  const s = (Math.floor(realTimeLeft) % 60).toString().padStart(2, '0');

  const togglePomo = async () => {
    const newState = { ...state, pomodoro: { ...state.pomodoro, running: !state.pomodoro.running }, lastUpdateTime: Date.now() };
    await storage.set({ state: newState });
    onDataChange();
  };

  const resetPomo = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const newState = { ...state, pomodoro: { ...state.pomodoro, running: false, timeLeft: 25 * 60 } };
    await storage.set({ state: newState });
    onDataChange();
  };

  const handleTaskSave = async (def: CustomTaskDef, val: number | boolean) => {
    const isCounter = def.type === 'counter';
    const maxCount = def.maxCount || 3;

    if (!isCounter && tasks[def.id] !== null && tasks[def.id] !== false && tasks[def.id] !== undefined) return;
    if (isCounter && (tasks[def.id] as number || 0) >= maxCount) return;

    const d = await storage.get(['tasks', 'state', 'logs', 'config', 'taskDefs']) as StorageData;
    if (!d.tasks || !d.state) return;

    // 二次防重：从 storage 真实读取后再检查（React state 可能因 sync 延迟而过时）
    const storedVal = d.tasks[def.id];
    if (!isCounter && storedVal !== null && storedVal !== false && storedVal !== undefined) return;
    if (isCounter && (storedVal as number || 0) >= maxCount) return;

    const currentConfig = d.config || config;
    const oldEnergy = d.state.energy;

    // 更新任务值
    if (isCounter) {
      d.tasks[def.id] = ((d.tasks[def.id] as number) || 0) + 1;
    } else {
      d.tasks[def.id] = val;
    }

    // 根据 healLevel 恢复精力（不做 clamp，忠实累加）
    if (def.id === 'sleep' && typeof val === 'number') {
      d.state.energy -= d.state.maxEnergy * (8 - Math.min(val, 8)) / 8;
    } else if (def.healLevel === 'big') {
      d.state.energy += d.state.maxEnergy * currentConfig.bigHealRatio;
    } else if (def.healLevel === 'mid') {
      d.state.energy += currentConfig.midHeal;
    } else if (def.healLevel === 'small') {
      d.state.energy += currentConfig.smallHeal;
    }
    // healLevel === 'none' → 不恢复精力

    const energyDiff = d.state.energy - oldEnergy;
    if (energyDiff < 0) {
      d.state.energyConsumed = (d.state.energyConsumed || 0) + Math.abs(energyDiff);
    }

    // 构建 actionId：内置任务用固定映射，自定义任务用 100+
    const builtinMap: Record<string, number> = {
      sleep: 0, exercise: 1, meals: 2, water: 3, stretch: 4,
      nap: 5, meditate: 6, poop: 7
    };
    const allDefs = d.taskDefs || DEFAULT_TASK_DEFS;
    const actionId = builtinMap[def.id] ?? (100 + allDefs.findIndex(d2 => d2.id === def.id));

    let numericVal = 1;
    if (isCounter) numericVal = d.tasks[def.id] as number;
    else if (typeof val === 'boolean') numericVal = val ? 1 : 0;
    else numericVal = Number(val);

    const logs = d.logs || [];
    logs.unshift([Date.now(), actionId, numericVal, Number(energyDiff.toFixed(1))]);
    await storage.set({ tasks: d.tasks, state: d.state, logs });
    onDataChange();
  };

  const renderTask = (def: CustomTaskDef) => {
    if (def.type === 'counter') {
      const count = (tasks[def.id] as number) || 0;
      const maxCount = def.maxCount || 3;
      const isMax = count >= maxCount;
      return (
        <div key={def.id} className="flex flex-col h-full justify-end">
          <button
            className={`h-[26px] rounded flex items-center justify-center text-xs font-bold transition-colors ${isMax ? 'bg-emerald-500/20 text-emerald-700 cursor-not-allowed border border-emerald-200' : 'bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200'}`}
            disabled={isMax}
            onClick={() => handleTaskSave(def, true)}
          >
            {isMax ? `✅ 已满 (${maxCount}/${maxCount})` : <><span className="mr-1">{def.icon}</span> {def.name} ({count}/{maxCount})</>}
          </button>
        </div>
      );
    }

    if (def.type === 'boolean') {
      const isDone = !!tasks[def.id];
      return (
        <div key={def.id} className="flex flex-col h-full justify-end">
          <button
            className={`h-[26px] rounded flex items-center justify-center text-xs font-bold transition-colors ${isDone ? 'bg-emerald-500/20 text-emerald-700 cursor-not-allowed border border-emerald-200' : 'bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200'}`}
            disabled={isDone}
            onClick={() => handleTaskSave(def, true)}
          >
            {isDone ? '✅ 已完成' : <><span className="mr-1">{def.icon}</span> {def.name}</>}
          </button>
        </div>
      );
    }

    // number 类型
    const isSubmitted = tasks[def.id] !== null && tasks[def.id] !== undefined;
    const localVal = localInputs[def.id] || '';
    return (
      <div key={def.id} className="flex flex-col text-xs">
        <label className="mb-1 text-gray-600">{def.icon} {def.name}{def.unit ? `(${def.unit})` : ''}</label>
        <input
          type="number"
          className="border border-gray-300 rounded p-1 text-xs outline-none focus:border-emerald-500 disabled:bg-gray-100 disabled:text-gray-500"
          placeholder={def.placeholder || ''}
          value={localVal}
          disabled={!!isSubmitted}
          onChange={(e) => setLocalInputs(prev => ({ ...prev, [def.id]: e.target.value }))}
          onBlur={(e) => {
            const v = parseFloat(e.target.value);
            if (!isNaN(v)) handleTaskSave(def, v);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.currentTarget.blur();
            }
          }}
        />
      </div>
    );
  };

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

      {/* Energy Bar */}
      <div className={card}>
        <div className="w-full h-6 bg-gray-200 rounded-full overflow-hidden relative flex items-center justify-center">
          <div className="absolute left-0 top-0 h-full transition-all duration-300 z-0" style={{ width: `${energyPercent}%`, backgroundColor: barColor }} />
          <span className="relative z-10 text-xs font-bold text-white drop-shadow-md">
            精力值:{Math.floor(state.energy)} / {state.maxEnergy}
          </span>
        </div>
      </div>

      {/* Pomodoro */}
      <div className={card}>
        <div className={`relative ${compact ? 'w-[110px]' : 'w-[140px]'} mx-auto`}>
          <div
            className={`absolute -top-1 -right-1 ${compact ? 'w-6 h-6' : 'w-7 h-7'} flex items-center justify-center bg-gray-100 rounded-full cursor-pointer z-20 opacity-60 hover:opacity-100 hover:bg-gray-200 hover:rotate-15 transition-all shadow-sm text-sm`}
            onClick={resetPomo}
            title="重新开始"
          >
            <RefreshCw size={compact ? 12 : 14} />
          </div>

          <div
            className={`${compact ? 'w-[110px] h-[110px]' : 'w-[140px] h-[140px]'} rounded-full relative flex items-center justify-center cursor-pointer transition-transform hover:scale-105`}
            style={{
              background: `conic-gradient(#10b981 ${pomoPercent}%, #e5e7eb ${pomoPercent}%)`
            }}
            onClick={togglePomo}
          >
            <div className={`${compact ? 'w-[96px] h-[96px]' : 'w-[124px] h-[124px]'} bg-white rounded-full flex flex-col items-center justify-center relative`}>
              <div className={`${compact ? 'text-2xl' : 'text-4xl'} font-bold transition-colors ${state.pomodoro.running ? 'text-emerald-500' : 'text-gray-300'}`}>
                {m}:{s}
              </div>
              <div className="text-[10px] text-gray-400 mt-1">
                总: {state.pomodoro.count} | 完美: {state.pomodoro.perfectCount}
              </div>

              {!state.pomodoro.running && (
                <div className="absolute inset-0 bg-white/85 rounded-full flex items-center justify-center text-emerald-500">
                  <Play size={compact ? 28 : 36} fill="currentColor" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tasks - 动态渲染 */}
      <div className={card}>
        <div className="grid grid-cols-2 gap-2">
          {taskDefs.map(def => renderTask(def))}
        </div>
      </div>

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

      {/* 今日日志流 */}
      {(() => {
        const builtinLogMap: Record<number, { icon: string; name: string }> = {
          0: { icon: '💤', name: '睡眠' },
          1: { icon: '🏃', name: '运动' },
          2: { icon: '🍽️', name: '三餐' },
          3: { icon: '💧', name: '饮水' },
          4: { icon: '🧘', name: '拉伸' },
          5: { icon: '😴', name: '午睡' },
          6: { icon: '🧠', name: '冥想' },
          7: { icon: '💩', name: '肠道' },
          8: { icon: '🍅', name: '番茄' },
        };

        const allDefs = data.taskDefs || DEFAULT_TASK_DEFS;

        const getActionInfo = (actionId: number) => {
          if (builtinLogMap[actionId]) return builtinLogMap[actionId];
          if (actionId >= 100) {
            const idx = actionId - 100;
            const def = allDefs[idx];
            if (def) return { icon: def.icon, name: def.name };
          }
          return { icon: '❓', name: `#${actionId}` };
        };

        // 过滤今日日志：使用 logicalDate 对应的 8:00 AM 作为起始
        const todayStart = (() => {
          if (state.logicalDate) {
            const [y, m, d] = state.logicalDate.split('-').map(Number);
            return new Date(y, m - 1, d, 8, 0, 0).getTime();
          }
          const now = new Date();
          now.setHours(8, 0, 0, 0);
          return now.getTime();
        })();

        const dataResetAt = data.dataResetAt || 0;
        const logCutoff = Math.max(todayStart, dataResetAt);
        const todayLogs = (data.logs || [])
          .filter((log): log is CompactLog => Array.isArray(log) && log.length === 4 && log[0] >= logCutoff)
          .sort((a, b) => b[0] - a[0])
          .slice(0, 20);

        const formatTime = (ts: number) => {
          const d = new Date(ts);
          return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
        };

        const formatValue = (actionId: number, val: number) => {
          if (actionId === 0) return `${val}h`;
          if (actionId === 1) return `${val}min`;
          if (actionId === 8) return `${val}%`;
          // counter / boolean
          const info = builtinLogMap[actionId];
          if (info) return String(val);
          return String(val);
        };

        return (
          <div className={cardLast}>
            <div className="text-xs font-bold text-gray-600 mb-1">今日记录</div>
            {todayLogs.length === 0 ? (
              <div className="text-xs text-gray-400">暂无记录</div>
            ) : (
              <div className="space-y-0.5">
                {todayLogs.map((log, i) => {
                  const [ts, actionId, val, diff] = log;
                  const info = getActionInfo(actionId);
                  return (
                    <div key={`${ts}-${i}`} className="flex items-center text-xs text-gray-600 gap-1">
                      <span className="text-gray-400 w-10 shrink-0">{formatTime(ts)}</span>
                      <span className="shrink-0">{info.icon}</span>
                      <span className="shrink-0">{info.name}</span>
                      <span className="text-gray-400 shrink-0">{formatValue(actionId, val)}</span>
                      <span className="ml-auto shrink-0 font-medium" style={{ color: diff > 0 ? '#10b981' : diff < 0 ? '#ef4444' : '#9ca3af' }}>
                        {diff > 0 ? `+${diff.toFixed(1)}` : diff < 0 ? diff.toFixed(1) : '0.0'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
