import { type StorageData, type CompactLog, DEFAULT_TASK_DEFS } from '../types';
import { BUILTIN_ACTION_ID, BUILTIN_ACTION_INFO, POMO_ACTION_ID, PERFECT_DAY_ACTION_ID, BAD_DAY_ACTION_ID, CUSTOM_ACTION_ID_OFFSET } from '../constants/actionMapping';

interface Props {
  data: StorageData;
  className?: string;
}

export default function ActivityLog({ data, className }: Props) {
  const { state } = data;
  if (!state) return null;

  const allDefs = data.taskDefs || DEFAULT_TASK_DEFS;

  const getActionInfo = (actionId: number) => {
    if (BUILTIN_ACTION_INFO[actionId]) return BUILTIN_ACTION_INFO[actionId];
    if (actionId >= CUSTOM_ACTION_ID_OFFSET) {
      const idx = actionId - CUSTOM_ACTION_ID_OFFSET;
      const def = allDefs[idx];
      if (def) return { icon: def.icon, name: def.name };
    }
    return { icon: '❓', name: `#${actionId}` };
  };

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

  const formatValue = (actionId: number, val: number, diff: number) => {
    if (actionId === BUILTIN_ACTION_ID.sleep) return `${val}h`;
    if (actionId === BUILTIN_ACTION_ID.exercise) return `${val}min`;
    if (actionId === POMO_ACTION_ID) return `${val}%`;
    if (actionId === PERFECT_DAY_ACTION_ID || actionId === BAD_DAY_ACTION_ID) {
      return `上限 ${val - diff}→${val}`;
    }
    return String(val);
  };

  return (
    <div className={className}>
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
                <span className="text-gray-400 shrink-0">{formatValue(actionId, val, diff)}</span>
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
}
