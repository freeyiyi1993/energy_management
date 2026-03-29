import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../shared/firebase';
import { type StorageData } from '../shared/types';
import { type StorageInterface } from '../shared/storage';

// --- Chrome 扩展存储实现 ---
const chromeGet = async (keys: string[] | null): Promise<Partial<StorageData>> => {
  if (keys === null) return chrome.storage.local.get(null) as unknown as Promise<StorageData>;
  return chrome.storage.local.get(keys as (keyof StorageData)[]) as unknown as Promise<Partial<StorageData>>;
};

const chromeSet = async (data: Partial<StorageData>): Promise<void> => {
  await chrome.storage.local.set(data);
};

export const storage: StorageInterface = {
  get: chromeGet,
  set: chromeSet,
};

// Firestore 不支持嵌套数组，CompactLog 转对象
function logsToFirestore(logs: any[]): any[] {
  return logs.map(entry =>
    Array.isArray(entry) ? { _t: entry[0], _a: entry[1], _v: entry[2], _d: entry[3] } : entry
  );
}

function logsFromFirestore(logs: any[]): any[] {
  return logs.map(entry =>
    entry && typeof entry === 'object' && '_t' in entry ? [entry._t, entry._a, entry._v, entry._d] : entry
  );
}

// --- Firebase 云同步 ---
export async function syncToCloud(uid: string): Promise<void> {
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

// 智能拉取：比较时间戳，取更新的
export async function pullAndMerge(uid: string): Promise<'cloud' | 'local' | 'empty'> {
  const cloudData = await syncFromCloud(uid);
  if (!cloudData) return 'empty';

  const localData = await storage.get(null) as StorageData;
  const cloudTime = cloudData.state?.lastUpdateTime || 0;
  const localTime = localData.state?.lastUpdateTime || 0;

  if (cloudTime > localTime) {
    await storage.set(cloudData);
    return 'cloud';
  }
  return 'local';
}

// 强制拉取：云端直接覆盖本地
export async function forcePull(uid: string): Promise<void> {
  const cloudData = await syncFromCloud(uid);
  if (!cloudData) {
    await chrome.storage.local.clear();
    return;
  }
  await chrome.storage.local.clear();
  await storage.set(cloudData);
}
