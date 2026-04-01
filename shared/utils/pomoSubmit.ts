import { type StorageData } from '../types';
import { type StorageInterface } from '../storage';

/** 番茄钟完成日志的 actionId */
const POMO_ACTION_ID = 8;

/**
 * 提交番茄钟完成记录（共享逻辑）
 * @returns true 表示成功提交，false 表示去重跳过或数据异常
 */
export async function submitPomoScore(
  storage: StorageInterface,
  score: number,
): Promise<boolean> {
  const data = await storage.get(['state', 'logs']) as StorageData;
  if (!data.state) return false;

  const now = Date.now();
  const logs = data.logs || [];

  // 去重：2 分钟内已有 actionId=8 的日志则跳过
  const recentPomo = logs.find(
    log => Array.isArray(log) && log[1] === POMO_ACTION_ID && now - log[0] < 120_000,
  );
  if (recentPomo) return false;

  if (score === 100) {
    data.state.pomoPerfectCount = (data.state.pomoPerfectCount || 0) + 1;
  }
  data.state.pomoCount = (data.state.pomoCount || 0) + 1;

  logs.unshift([now, POMO_ACTION_ID, score, 0]);
  await storage.set({ state: data.state, logs });
  return true;
}
