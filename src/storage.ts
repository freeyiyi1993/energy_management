import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { type StorageData } from './types';

// 检测是否在 Chrome 扩展环境中
export const isChromeExtension = typeof chrome !== 'undefined' && !!chrome.storage?.local;

// --- Chrome 扩展存储 ---
const chromeGet = async (keys: string[] | null): Promise<Partial<StorageData>> => {
  if (keys === null) return chrome.storage.local.get(null) as unknown as Promise<StorageData>;
  return chrome.storage.local.get(keys as (keyof StorageData)[]) as unknown as Promise<Partial<StorageData>>;
};

const chromeSet = async (data: Partial<StorageData>): Promise<void> => {
  await chrome.storage.local.set(data);
};

// --- Web localStorage + Firebase ---
const LOCAL_KEY = 'energy_app_data';

function getLocalData(): StorageData {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setLocalData(data: StorageData): void {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
}

const webGet = async (keys: string[] | null): Promise<Partial<StorageData>> => {
  const all = getLocalData();
  if (keys === null) return all;
  const result: Partial<StorageData> = {};
  for (const k of keys) {
    if (k in all) (result as any)[k] = (all as any)[k];
  }
  return result;
};

const webSet = async (data: Partial<StorageData>): Promise<void> => {
  const all = getLocalData();
  Object.assign(all, data);
  setLocalData(all);
};

// --- 统一存储接口 ---
export const storage = {
  get: isChromeExtension ? chromeGet : webGet,
  set: isChromeExtension ? chromeSet : webSet,
};

// --- Firebase 云同步 ---
export async function syncToCloud(uid: string): Promise<void> {
  const data = await storage.get(null) as StorageData;
  const ref = doc(db, 'users', uid);
  await setDoc(ref, {
    ...data,
    lastSyncAt: Date.now(),
  }, { merge: true });
}

export async function syncFromCloud(uid: string): Promise<StorageData | null> {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const cloudData = snap.data() as StorageData & { lastSyncAt?: number };
  delete (cloudData as any).lastSyncAt;
  return cloudData;
}

export async function pullAndMerge(uid: string): Promise<void> {
  const cloudData = await syncFromCloud(uid);
  if (!cloudData) return;

  const localData = await storage.get(null) as StorageData;

  // 简单策略：云端数据的 lastUpdateTime 更新则用云端，否则保留本地
  const cloudTime = cloudData.state?.lastUpdateTime || 0;
  const localTime = localData.state?.lastUpdateTime || 0;

  if (cloudTime > localTime) {
    await storage.set(cloudData);
  }
}
