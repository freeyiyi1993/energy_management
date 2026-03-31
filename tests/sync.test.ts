import { describe, it, expect } from 'vitest';
import { type AppState } from '../shared/types';

// 复制 mergeState 核心逻辑进行测试（原函数未导出，且依赖 Firebase）
function mergeState(local: AppState, cloud: AppState): AppState {
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

const basePomo = { status: 'idle' as const, updatedAt: 0, consecutiveCount: 0 };

describe('mergeState - cross-day', () => {
  it('should take the day-rolled-over side when dates differ', () => {
    const yesterday: AppState = {
      logicalDate: '2026-03-30',
      energy: 25,
      maxEnergy: 100,
      energyConsumed: 75,
      lastUpdateTime: Date.now() - 60000,
      lowEnergyReminded: true,
      pomodoro: basePomo,
      pomoCount: 5,
      pomoPerfectCount: 3,
    };

    const today: AppState = {
      logicalDate: '2026-03-31',
      energy: 100,
      maxEnergy: 100,
      energyConsumed: 0,
      lastUpdateTime: Date.now(),
      lowEnergyReminded: false,
      pomodoro: basePomo,
      pomoCount: 0,
      pomoPerfectCount: 0,
    };

    // 本地未日切，云端已日切
    const result1 = mergeState(yesterday, today);
    expect(result1.logicalDate).toBe('2026-03-31');
    expect(result1.energy).toBe(100);
    expect(result1.energyConsumed).toBe(0);
    expect(result1.pomoCount).toBe(0);

    // 反过来：本地已日切，云端未日切
    const result2 = mergeState(today, yesterday);
    expect(result2.logicalDate).toBe('2026-03-31');
    expect(result2.energy).toBe(100);
  });

  it('should merge normally when both sides are on the same day', () => {
    const local: AppState = {
      logicalDate: '2026-03-31',
      energy: 80,
      maxEnergy: 100,
      energyConsumed: 20,
      lastUpdateTime: Date.now(),
      lowEnergyReminded: false,
      pomodoro: basePomo,
      pomoCount: 2,
      pomoPerfectCount: 1,
    };

    const cloud: AppState = {
      logicalDate: '2026-03-31',
      energy: 70,
      maxEnergy: 100,
      energyConsumed: 30,
      lastUpdateTime: Date.now() - 30000,
      lowEnergyReminded: false,
      pomodoro: basePomo,
      pomoCount: 3,
      pomoPerfectCount: 2,
    };

    const result = mergeState(local, cloud);
    expect(result.logicalDate).toBe('2026-03-31');
    expect(result.energy).toBe(70);
    expect(result.energyConsumed).toBe(30);
    expect(result.pomoCount).toBe(3);
    expect(result.pomoPerfectCount).toBe(2);
  });
});

describe('mergeState - pomodoro atomic merge', () => {
  it('should take the pomodoro with later updatedAt', () => {
    const local: AppState = {
      logicalDate: '2026-03-31',
      energy: 80,
      maxEnergy: 100,
      energyConsumed: 0,
      lastUpdateTime: Date.now(),
      lowEnergyReminded: false,
      pomodoro: { status: 'ongoing', startedAt: Date.now() - 300000, updatedAt: Date.now() - 300000, consecutiveCount: 0 },
      pomoCount: 0,
      pomoPerfectCount: 0,
    };

    const cloud: AppState = {
      logicalDate: '2026-03-31',
      energy: 80,
      maxEnergy: 100,
      energyConsumed: 0,
      lastUpdateTime: Date.now(),
      lowEnergyReminded: false,
      pomodoro: { status: 'idle', updatedAt: Date.now(), consecutiveCount: 0 },
      pomoCount: 0,
      pomoPerfectCount: 0,
    };

    // 云端更新（reset），应该覆盖本地的 ongoing
    const result = mergeState(local, cloud);
    expect(result.pomodoro.status).toBe('idle');
    expect(result.pomodoro.startedAt).toBeUndefined();
  });

  it('should keep local pomodoro when local updatedAt is newer', () => {
    const startedAt = Date.now() - 60000;
    const local: AppState = {
      logicalDate: '2026-03-31',
      energy: 80,
      maxEnergy: 100,
      energyConsumed: 0,
      lastUpdateTime: Date.now(),
      lowEnergyReminded: false,
      pomodoro: { status: 'ongoing', startedAt, updatedAt: Date.now(), consecutiveCount: 1 },
      pomoCount: 1,
      pomoPerfectCount: 0,
    };

    const cloud: AppState = {
      logicalDate: '2026-03-31',
      energy: 80,
      maxEnergy: 100,
      energyConsumed: 0,
      lastUpdateTime: Date.now() - 120000,
      lowEnergyReminded: false,
      pomodoro: { status: 'idle', updatedAt: Date.now() - 120000, consecutiveCount: 0 },
      pomoCount: 0,
      pomoPerfectCount: 0,
    };

    const result = mergeState(local, cloud);
    expect(result.pomodoro.status).toBe('ongoing');
    expect(result.pomodoro.startedAt).toBe(startedAt);
    expect(result.pomoCount).toBe(1);
  });
});
