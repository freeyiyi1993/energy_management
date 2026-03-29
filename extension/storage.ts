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
