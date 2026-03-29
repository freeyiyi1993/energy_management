import { type StorageData } from '../shared/types';
import {
  type StorageInterface,
  syncToCloud as sharedSyncToCloud,
  pullAndMerge as sharedPullAndMerge,
  forcePull as sharedForcePull,
} from '../shared/storage';

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

// --- Firebase 云同步（委托给 shared/storage） ---
export async function syncToCloud(uid: string): Promise<void> {
  await sharedSyncToCloud(storage, uid);
}

export async function pullAndMerge(uid: string): Promise<'cloud' | 'local' | 'merged' | 'empty'> {
  return sharedPullAndMerge(storage, uid);
}

export async function forcePull(uid: string): Promise<void> {
  await sharedForcePull(storage, uid, async () => {
    await chrome.storage.local.clear();
  });
}
