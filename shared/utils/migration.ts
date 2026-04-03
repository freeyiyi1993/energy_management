import { type AppLogEntry, type PomodoroTimer, type StorageData, DEFAULT_TASK_DEFS } from '../types';

// --- 旧格式迁移 ---

/** 检测并迁移旧版 PomodoroState → PomodoroTimer，count/perfectCount 拆到 AppState */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- 旧格式结构不确定，需要 any 做运行时检测
export function migratePomodoro(state: Record<string, any> | null | undefined): void {
  if (!state?.pomodoro) return;
  const p = state.pomodoro;
  // 已是新格式
  if ('status' in p) return;
  // 旧格式：有 running 字段
  state.pomodoro = {
    status: p.running ? 'ongoing' : 'idle',
    startedAt: p.startedAt ?? undefined,
    updatedAt: state.lastUpdateTime || Date.now(),
    consecutiveCount: p.consecutiveCount || 0,
  } as PomodoroTimer;
  state.pomoCount = state.pomoCount ?? p.count ?? 0;
  state.pomoPerfectCount = state.pomoPerfectCount ?? p.perfectCount ?? 0;
}

/** 内置任务的 countsForPerfectDay 强制从 DEFAULT_TASK_DEFS 同步，自定义任务缺失时补 false */
export function migrateTaskDefs(taskDefs: StorageData['taskDefs']): StorageData['taskDefs'] {
  if (!taskDefs) return undefined;
  const defaultMap = new Map(DEFAULT_TASK_DEFS.map(d => [d.id, d]));
  return taskDefs.map(def => {
    const defaultDef = defaultMap.get(def.id);
    if (defaultDef && def.builtin) {
      def.countsForPerfectDay = defaultDef.countsForPerfectDay;
    } else if (def.countsForPerfectDay === undefined) {
      def.countsForPerfectDay = false;
    }
    return def;
  });
}

// --- Firestore 日志转换 ---
// Firestore 不支持嵌套数组，CompactLog [n,n,n,n] 需转为对象

export function logsToFirestore(logs: AppLogEntry[]): (AppLogEntry | { _t: number; _a: number; _v: number; _d: number })[] {
  return logs.map(entry =>
    Array.isArray(entry) ? { _t: entry[0], _a: entry[1], _v: entry[2], _d: entry[3] } : entry
  );
}

export function logsFromFirestore(logs: (AppLogEntry | { _t: number; _a: number; _v: number; _d: number })[]): AppLogEntry[] {
  return logs.map(entry =>
    (entry && typeof entry === 'object' && '_t' in entry) ? [entry._t, entry._a, entry._v, entry._d] as AppLogEntry : entry as AppLogEntry
  );
}
