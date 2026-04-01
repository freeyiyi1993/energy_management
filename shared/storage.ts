import { type StorageData, type StatEntry, type AppLogEntry, type Tasks, type AppState, type PomodoroTimer, DEFAULT_CONFIG, DEFAULT_TASK_DEFS } from './types';
import { getLogicalDate, getLogical8AM, buildEmptyTasks } from './utils/time';
import { type CloudSyncService, syncToCloud, syncFromCloud } from './cloudSync';

// 统一存储接口：各平台（Chrome 扩展 / Web）各自实现
export interface StorageInterface {
  get(keys: null): Promise<StorageData>;
  get(keys: string[]): Promise<Partial<StorageData>>;
  set(data: Partial<StorageData>): Promise<void>;
}

// --- 番茄钟默认值 ---

export const DEFAULT_POMODORO: PomodoroTimer = {
  status: 'idle',
  updatedAt: 0,
  consecutiveCount: 0,
};

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

// syncToCloud / syncFromCloud 已迁移到 cloudSync.ts
export { syncToCloud, syncFromCloud, type CloudSyncService } from './cloudSync';

// --- 日志合并工具 ---

/** 从任意格式的日志条目中提取 timestamp */
export function getLogTimestamp(entry: AppLogEntry): number {
  if (Array.isArray(entry)) return entry[0]; // CompactLog
  if (entry.t) return entry.t;               // 中间版本
  if (entry.time) return new Date(entry.time).getTime(); // 旧版本
  return 0;
}

/** 从任意格式的日志条目中提取 action type */
function getLogAction(entry: AppLogEntry): number | string {
  if (Array.isArray(entry)) return entry[1]; // CompactLog
  if (entry.text) return entry.text;         // 旧版本
  if (entry.txt) return entry.txt;           // 中间版本
  return '';
}

/** 生成去重 key: timestamp + action */
function logDedupeKey(entry: AppLogEntry): string {
  return `${getLogTimestamp(entry)}|${getLogAction(entry)}`;
}

/** 合并两端日志，按 timestamp 去重并排序 */
export function mergeLogs(localLogs: AppLogEntry[], cloudLogs: AppLogEntry[]): AppLogEntry[] {
  const seen = new Set<string>();
  const merged: AppLogEntry[] = [];

  for (const entry of [...localLogs, ...cloudLogs]) {
    const key = logDedupeKey(entry);
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(entry);
    }
  }

  merged.sort((a, b) => getLogTimestamp(a) - getLogTimestamp(b));
  return merged;
}

/** 合并任务状态：已完成的优先，都完成取较大值 */
function mergeTasks(local: Tasks | undefined, cloud: Tasks | undefined): Tasks {
  const merged: Tasks = { ...local };
  if (!cloud) return merged;
  for (const key of Object.keys(cloud)) {
    const lv = merged[key];
    const cv = cloud[key];
    // 本地未完成（null/false/undefined），取云端
    if (lv === null || lv === undefined || lv === false) {
      merged[key] = cv;
    } else if (typeof lv === 'number' && typeof cv === 'number' && cv > lv) {
      // 都是数字，取较大值（如 counter 类型）
      merged[key] = cv;
    }
  }
  return merged;
}

/** 合并 state：pomodoro 按 updatedAt 原子覆盖，count 类用 Math.max */
function mergeState(local: AppState | undefined, cloud: AppState | undefined): AppState | undefined {
  if (!local && !cloud) return undefined;
  if (!local) return cloud;
  if (!cloud) return local;

  // 跨日合并：一端已日切、另一端未日切时，直接取已日切一方的 state
  if (local.logicalDate !== cloud.logicalDate) {
    const newer = local.logicalDate > cloud.logicalDate ? local : cloud;
    return { ...newer, lastUpdateTime: Date.now() };
  }

  // pomodoro: 取 updatedAt 更大的一方整体覆盖
  const pomodoro = local.pomodoro.updatedAt >= cloud.pomodoro.updatedAt
    ? local.pomodoro
    : cloud.pomodoro;

  return {
    energy: Math.min(local.energy, cloud.energy),
    maxEnergy: Math.min(local.maxEnergy, cloud.maxEnergy),
    energyConsumed: Math.max(local.energyConsumed || 0, cloud.energyConsumed || 0),
    logicalDate: local.logicalDate,
    lowEnergyReminded: local.lowEnergyReminded || cloud.lowEnergyReminded,
    lastUpdateTime: Date.now(),
    pomodoro,
    pomoCount: Math.max(local.pomoCount || 0, cloud.pomoCount || 0),
    pomoPerfectCount: Math.max(local.pomoPerfectCount || 0, cloud.pomoPerfectCount || 0),
  };
}

/** 重置所有数据：写入 dataResetAt 时间戳，各端忽略此前数据 */
export async function resetAllData(storage: StorageInterface, cloud?: CloudSyncService): Promise<void> {
  const dataResetAt = Date.now();
  const existing = await storage.get(['config', 'taskDefs']);
  const config = existing.config || DEFAULT_CONFIG;
  const taskDefs = existing.taskDefs || DEFAULT_TASK_DEFS;

  const now = Date.now();
  const startOfToday = getLogical8AM();
  const minsPassedSince8AM = Math.max(0, (now - startOfToday) / 60000);
  let initialEnergy = config.maxEnergy;
  const decayRate = config.decayRate / 60;
  initialEnergy -= decayRate * minsPassedSince8AM;

  await storage.set({
    dataResetAt,
    state: {
      logicalDate: getLogicalDate(),
      maxEnergy: config.maxEnergy,
      energy: initialEnergy,
      lastUpdateTime: now,
      lowEnergyReminded: false,
      energyConsumed: 0,
      pomodoro: { ...DEFAULT_POMODORO, updatedAt: now },
      pomoCount: 0,
      pomoPerfectCount: 0,
    },
    tasks: buildEmptyTasks(taskDefs),
    logs: [],
    stats: [],
  });

  if (cloud) {
    await syncToCloud(storage, cloud);
  }
}

/** 双向同步：合并本地与云端数据，写回双端 */
export async function sync(storage: StorageInterface, cloud: CloudSyncService): Promise<'synced' | 'no_change' | 'empty'> {
  const cloudData = await syncFromCloud(cloud);

  // 云端无数据：推送本地到云端
  if (!cloudData) {
    await syncToCloud(storage, cloud);
    return 'empty';
  }

  const localData = await storage.get(null);

  // --- dataResetAt 合并：取较大值 ---
  const localResetAt = localData.dataResetAt || 0;
  const cloudResetAt = cloudData.dataResetAt || 0;
  const mergedResetAt = Math.max(localResetAt, cloudResetAt);
  const resetChanged = localResetAt !== cloudResetAt;

  const localLogs = localData.logs || [];
  const cloudLogs = cloudData.logs || [];

  // 合并日志，并按 dataResetAt 过滤
  let mergedLogs = mergeLogs(localLogs, cloudLogs);
  if (mergedResetAt > 0) {
    mergedLogs = mergedLogs.filter(log => getLogTimestamp(log) >= mergedResetAt);
  }

  // 合并 stats，按 dataResetAt 过滤
  const localStats = localData.stats || [];
  const cloudStats = cloudData.stats || [];
  let mergedStats: StatEntry[];
  if (mergedResetAt > 0) {
    const resetDateStr = new Date(mergedResetAt).toLocaleDateString('en-CA');
    // 取并集按 date 去重，再过滤
    const seen = new Set<string>();
    mergedStats = [];
    for (const s of [...localStats, ...cloudStats]) {
      if (!seen.has(s.date) && s.date >= resetDateStr) {
        seen.add(s.date);
        mergedStats.push(s);
      }
    }
    mergedStats.sort((a, b) => a.date.localeCompare(b.date));
  } else {
    mergedStats = localStats; // 无 reset 时保持本地 stats
  }

  // state 和 tasks：如果 dataResetAt 不一致，用重置方的版本
  let mergedTasks: Tasks;
  let mergedState: AppState | undefined;
  if (resetChanged) {
    const winner = localResetAt > cloudResetAt ? localData : cloudData;
    mergedState = winner.state;
    mergedTasks = winner.tasks || {};
  } else {
    // 跨日合并：一端已日切、另一端未日切，tasks 也取已日切一方
    const localDate = localData.state?.logicalDate || '';
    const cloudDate = cloudData.state?.logicalDate || '';
    if (localDate !== cloudDate) {
      const newer = localDate > cloudDate ? localData : cloudData;
      mergedTasks = newer.tasks || {};
    } else {
      mergedTasks = mergeTasks(localData.tasks, cloudData.tasks);
    }
    mergedState = mergeState(localData.state, cloudData.state);
  }

  // 检查是否有变化
  const logsChanged = mergedLogs.length !== localLogs.length || mergedLogs.length !== cloudLogs.length;
  const tasksChanged = JSON.stringify(mergedTasks) !== JSON.stringify(localData.tasks) ||
    JSON.stringify(mergedTasks) !== JSON.stringify(cloudData.tasks);
  const stateChanged = JSON.stringify(mergedState) !== JSON.stringify(localData.state) ||
    JSON.stringify(mergedState) !== JSON.stringify(cloudData.state);
  const statsChanged = JSON.stringify(mergedStats) !== JSON.stringify(localStats) ||
    JSON.stringify(mergedStats) !== JSON.stringify(cloudStats);

  if (!logsChanged && !tasksChanged && !stateChanged && !statsChanged && !resetChanged) {
    return 'no_change';
  }

  // 合并结果写入本地
  const mergedData: Partial<StorageData> = {
    ...localData,
    logs: mergedLogs,
    tasks: mergedTasks,
    stats: mergedStats,
    dataResetAt: mergedResetAt || undefined,
  };
  if (mergedState) {
    mergedData.state = mergedState;
  }
  await storage.set(mergedData);

  // 推送合并结果到云端
  await syncToCloud(storage, cloud);

  return 'synced';
}
