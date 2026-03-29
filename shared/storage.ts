import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { type StorageData, type AppLogEntry } from './types';

// 统一存储接口：各平台（Chrome 扩展 / Web）各自实现
export interface StorageInterface {
  get(keys: string[] | null): Promise<Partial<StorageData>>;
  set(data: Partial<StorageData>): Promise<void>;
}

// --- Firestore 日志转换 ---
// Firestore 不支持嵌套数组，CompactLog [n,n,n,n] 需转为对象

export function logsToFirestore(logs: any[]): any[] {
  return logs.map(entry =>
    Array.isArray(entry) ? { _t: entry[0], _a: entry[1], _v: entry[2], _d: entry[3] } : entry
  );
}

export function logsFromFirestore(logs: any[]): any[] {
  return logs.map(entry =>
    entry && typeof entry === 'object' && '_t' in entry ? [entry._t, entry._a, entry._v, entry._d] : entry
  );
}

// --- Firebase 云同步 ---

export async function syncToCloud(storage: StorageInterface, uid: string): Promise<void> {
  const data = await storage.get(null) as StorageData;
  const ref = doc(db, 'users', uid);
  const payload = {
    ...data,
    logs: data.logs ? logsToFirestore(data.logs) : [],
    lastSyncAt: Date.now(),
  };
  await setDoc(ref, payload, { merge: true });
}

export async function syncFromCloud(uid: string): Promise<StorageData | null> {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const cloudData = snap.data() as StorageData & { lastSyncAt?: number };
  delete (cloudData as any).lastSyncAt;
  if (cloudData.logs) {
    cloudData.logs = logsFromFirestore(cloudData.logs);
  }
  return cloudData;
}

// --- 日志合并工具 ---

/** 从任意格式的日志条目中提取 timestamp */
function getLogTimestamp(entry: AppLogEntry): number {
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

/** 智能拉取：合并日志，状态取更新的一方 */
export async function pullAndMerge(storage: StorageInterface, uid: string): Promise<'cloud' | 'local' | 'merged' | 'empty'> {
  const cloudData = await syncFromCloud(uid);
  if (!cloudData) return 'empty';

  const localData = await storage.get(null) as StorageData;
  const cloudTime = cloudData.state?.lastUpdateTime || 0;
  const localTime = localData.state?.lastUpdateTime || 0;

  const localLogs = localData.logs || [];
  const cloudLogs = cloudData.logs || [];

  // 合并日志
  const mergedLogs = mergeLogs(localLogs, cloudLogs);

  // 状态取更新的一方，但日志始终合并
  if (cloudTime > localTime) {
    await storage.set({ ...cloudData, logs: mergedLogs });
    return 'cloud';
  }
  // 本地更新或相同：保留本地状态，但补入云端日志
  if (mergedLogs.length > localLogs.length) {
    await storage.set({ ...localData, logs: mergedLogs });
    return 'merged';
  }
  return 'local';
}

/** 强制拉取：云端直接覆盖本地。clearFn 负责平台特定的清除逻辑 */
export async function forcePull(storage: StorageInterface, uid: string, clearFn: () => Promise<void>): Promise<void> {
  const cloudData = await syncFromCloud(uid);
  await clearFn();
  if (cloudData) {
    await storage.set(cloudData);
  }
}
