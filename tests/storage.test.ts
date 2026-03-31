import { describe, it, expect, vi } from 'vitest';
import { type AppState, type PomodoroTimer } from '../shared/types';

// Mock Firebase before importing storage
vi.mock('../shared/firebase', () => ({
  auth: {},
  googleProvider: {},
  db: {},
}));

import { mergeLogs, logsToFirestore, logsFromFirestore, migratePomodoro } from '../shared/storage';

// --- mergeState (复制核心逻辑，原函数未导出) ---

function mergeState(local: AppState, cloud: AppState): AppState {
  if (local.logicalDate !== cloud.logicalDate) {
    const newer = local.logicalDate > cloud.logicalDate ? local : cloud;
    return { ...newer, lastUpdateTime: Date.now() };
  }

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

const basePomo: PomodoroTimer = { status: 'idle', updatedAt: 0, consecutiveCount: 0 };

const baseState = (overrides: Partial<AppState> = {}): AppState => ({
  logicalDate: '2026-03-31',
  energy: 65,
  maxEnergy: 65,
  energyConsumed: 0,
  lastUpdateTime: Date.now(),
  lowEnergyReminded: false,
  pomodoro: basePomo,
  pomoCount: 0,
  pomoPerfectCount: 0,
  ...overrides,
});

// --- mergeState tests ---

describe('mergeState - cross-day', () => {
  it('takes the day-rolled-over side when dates differ', () => {
    const yesterday = baseState({ logicalDate: '2026-03-30', energy: 25, pomoCount: 5, pomoPerfectCount: 3 });
    const today = baseState({ logicalDate: '2026-03-31', energy: 100 });

    const r1 = mergeState(yesterday, today);
    expect(r1.logicalDate).toBe('2026-03-31');
    expect(r1.energy).toBe(100);
    expect(r1.pomoCount).toBe(0);

    const r2 = mergeState(today, yesterday);
    expect(r2.logicalDate).toBe('2026-03-31');
  });
});

describe('mergeState - same day', () => {
  it('merges energy with Math.min, counts with Math.max', () => {
    const local = baseState({ energy: 80, energyConsumed: 20, pomoCount: 2, pomoPerfectCount: 1 });
    const cloud = baseState({ energy: 70, energyConsumed: 30, pomoCount: 3, pomoPerfectCount: 2 });
    const r = mergeState(local, cloud);
    expect(r.energy).toBe(70);
    expect(r.energyConsumed).toBe(30);
    expect(r.pomoCount).toBe(3);
    expect(r.pomoPerfectCount).toBe(2);
  });

  it('lowEnergyReminded uses OR', () => {
    const local = baseState({ lowEnergyReminded: false });
    const cloud = baseState({ lowEnergyReminded: true });
    expect(mergeState(local, cloud).lowEnergyReminded).toBe(true);
  });
});

describe('mergeState - pomodoro atomic', () => {
  it('takes the pomodoro with later updatedAt', () => {
    const now = Date.now();
    const local = baseState({
      pomodoro: { status: 'ongoing', startedAt: now - 300000, updatedAt: now - 300000, consecutiveCount: 0 },
    });
    const cloud = baseState({
      pomodoro: { status: 'idle', updatedAt: now, consecutiveCount: 0 },
    });
    const r = mergeState(local, cloud);
    expect(r.pomodoro.status).toBe('idle');
  });

  it('keeps local pomodoro when local is newer', () => {
    const now = Date.now();
    const local = baseState({
      pomodoro: { status: 'ongoing', startedAt: now - 60000, updatedAt: now, consecutiveCount: 1 },
    });
    const cloud = baseState({
      pomodoro: { status: 'idle', updatedAt: now - 120000, consecutiveCount: 0 },
    });
    const r = mergeState(local, cloud);
    expect(r.pomodoro.status).toBe('ongoing');
    expect(r.pomodoro.consecutiveCount).toBe(1);
  });

  it('equal updatedAt: takes local', () => {
    const now = Date.now();
    const local = baseState({ pomodoro: { status: 'ongoing', startedAt: now, updatedAt: now, consecutiveCount: 0 } });
    const cloud = baseState({ pomodoro: { status: 'idle', updatedAt: now, consecutiveCount: 0 } });
    expect(mergeState(local, cloud).pomodoro.status).toBe('ongoing');
  });
});

// --- mergeLogs ---

describe('mergeLogs', () => {
  it('deduplicates by timestamp+action', () => {
    const logs = [[1000, 0, 8, -5], [1000, 0, 8, -5], [2000, 1, 30, 5]] as any[];
    const merged = mergeLogs(logs, []);
    expect(merged.length).toBe(2);
  });

  it('merges from both sides and sorts', () => {
    const local = [[2000, 1, 30, 5]] as any[];
    const cloud = [[1000, 0, 8, -5]] as any[];
    const merged = mergeLogs(local, cloud);
    expect(merged.length).toBe(2);
    expect(merged[0][0]).toBe(1000); // sorted ascending
  });

  it('handles empty inputs', () => {
    expect(mergeLogs([], []).length).toBe(0);
    expect(mergeLogs([[1, 0, 1, 0]] as any[], []).length).toBe(1);
  });
});

// --- logsToFirestore / logsFromFirestore ---

describe('Firestore log conversion', () => {
  it('roundtrip: array → object → array', () => {
    const logs = [[1000, 2, 3, -1], [2000, 0, 8, -5]] as any[];
    const firestoreLogs = logsToFirestore(logs);
    expect(firestoreLogs[0]._t).toBe(1000);
    expect(firestoreLogs[0]._a).toBe(2);

    const restored = logsFromFirestore(firestoreLogs);
    expect(restored).toEqual(logs);
  });

  it('passes through non-array entries', () => {
    const logs = [{ time: '2026-01-01', text: 'old' }] as any[];
    expect(logsToFirestore(logs)).toEqual(logs);
    expect(logsFromFirestore(logs)).toEqual(logs);
  });
});

// --- migratePomodoro ---

describe('migratePomodoro', () => {
  it('converts old format to new format', () => {
    const state: any = {
      lastUpdateTime: 12345,
      pomodoro: { running: true, timeLeft: 900, startedAt: 10000, count: 3, perfectCount: 2, consecutiveCount: 1 },
    };
    migratePomodoro(state);
    expect(state.pomodoro.status).toBe('ongoing');
    expect(state.pomodoro.updatedAt).toBe(12345);
    expect(state.pomodoro.consecutiveCount).toBe(1);
    expect(state.pomoCount).toBe(3);
    expect(state.pomoPerfectCount).toBe(2);
    expect(state.pomodoro.running).toBeUndefined();
    expect(state.pomodoro.timeLeft).toBeUndefined();
  });

  it('converts idle old format', () => {
    const state: any = {
      lastUpdateTime: 5000,
      pomodoro: { running: false, timeLeft: 1500, count: 0, perfectCount: 0, consecutiveCount: 0 },
    };
    migratePomodoro(state);
    expect(state.pomodoro.status).toBe('idle');
    expect(state.pomoCount).toBe(0);
  });

  it('skips already-new format', () => {
    const state: any = {
      pomodoro: { status: 'idle', updatedAt: 999, consecutiveCount: 0 },
      pomoCount: 5,
    };
    migratePomodoro(state);
    expect(state.pomoCount).toBe(5); // not overwritten
    expect(state.pomodoro.updatedAt).toBe(999);
  });

  it('handles null/undefined state gracefully', () => {
    migratePomodoro(null);
    migratePomodoro(undefined);
    migratePomodoro({});
    // no throw
  });
});
