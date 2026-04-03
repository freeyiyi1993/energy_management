import { type StorageData, type AppLogEntry } from './types';
import { logsToFirestore, logsFromFirestore, migratePomodoro } from './utils/migration';

// --- 云同步服务接口 ---
// 各平台可实现不同的云同步后端（如 Firebase、Supabase 等）

export interface CloudSyncService {
  upload(data: StorageData & { lastSyncAt: number }): Promise<void>;
  download(): Promise<StorageData | null>;
}

// --- Firebase 实现 ---

export function createFirebaseSync(uid: string): CloudSyncService {
  return {
    async upload(data) {
      const { doc, setDoc } = await import('firebase/firestore');
      const { db } = await import('./firebase');
      const ref = doc(db, 'users', uid);
      await setDoc(ref, data, { merge: true });
    },
    async download() {
      const { doc, getDoc } = await import('firebase/firestore');
      const { db } = await import('./firebase');
      const ref = doc(db, 'users', uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) return null;
      return snap.data() as StorageData & { lastSyncAt?: number };
    },
  };
}

// --- 云端上传/下载（封装格式转换逻辑） ---

export async function syncToCloud(storage: { get(keys: null): Promise<StorageData> }, cloud: CloudSyncService): Promise<void> {
  const data = await storage.get(null);
  // merge:true 下 undefined 字段不会被删除，需显式转 null
  if (data.state?.pomodoro && data.state.pomodoro.startedAt === undefined) {
    (data.state.pomodoro as unknown as Record<string, unknown>).startedAt = null;
  }
  const payload = {
    ...data,
    logs: data.logs ? logsToFirestore(data.logs) : [],
    lastSyncAt: Date.now(),
  };
  await cloud.upload(payload as StorageData & { lastSyncAt: number });
}

export async function syncFromCloud(cloud: CloudSyncService): Promise<StorageData | null> {
  const rawData = await cloud.download();
  if (!rawData) return null;
  const { lastSyncAt: _, ...cloudData } = rawData as StorageData & { lastSyncAt?: number };
  if (cloudData.logs) {
    cloudData.logs = logsFromFirestore(cloudData.logs as (AppLogEntry | { _t: number; _a: number; _v: number; _d: number })[]);
  }
  // Firestore 的 null 还原为 undefined
  if (cloudData.state?.pomodoro && (cloudData.state.pomodoro as unknown as Record<string, unknown>).startedAt === null) {
    cloudData.state.pomodoro.startedAt = undefined;
  }
  // 旧格式迁移
  migratePomodoro(cloudData.state);
  return cloudData;
}
