import { describe, it, expect, vi } from 'vitest';
import { type StorageData, type AppState, type PomodoroTimer, DEFAULT_CONFIG, DEFAULT_TASK_DEFS } from '../shared/types';
import { getLogicalDate } from '../shared/utils/time';

// Mock firebase
vi.mock('../shared/firebase', () => ({
  auth: {},
  googleProvider: {},
  db: {},
}));

import { handleTick } from '../extension/background/tickHandler';

const basePomo: PomodoroTimer = { status: 'idle', updatedAt: 0, consecutiveCount: 0 };
const FINISH_URL = 'chrome-extension://abc/finish.html';

function makeState(overrides: Partial<AppState> = {}): AppState {
  return {
    logicalDate: getLogicalDate(),
    energy: 50,
    maxEnergy: 65,
    energyConsumed: 0,
    lastUpdateTime: Date.now() - 60000,
    lowEnergyReminded: false,
    pomodoro: { ...basePomo },
    pomoCount: 0,
    pomoPerfectCount: 0,
    ...overrides,
  };
}

function makeData(overrides: Partial<StorageData> = {}): StorageData {
  return {
    state: makeState(),
    config: DEFAULT_CONFIG,
    taskDefs: DEFAULT_TASK_DEFS,
    tasks: {},
    logs: [],
    ...overrides,
  };
}

describe('handleTick', () => {
  it('returns empty action when no state', () => {
    const result = handleTick({} as StorageData, Date.now(), FINISH_URL);
    expect(result.openTabs).toEqual([]);
    expect(result.type).toBe('none');
  });

  it('opens pomodoro finish page when timer expired', () => {
    const now = Date.now();
    const data = makeData({
      state: makeState({
        pomodoro: { status: 'ongoing', startedAt: now - 26 * 60 * 1000, updatedAt: now - 26 * 60 * 1000, consecutiveCount: 0 },
      }),
    });

    const result = handleTick(data, now, FINISH_URL);

    expect(result.openTabs.length).toBe(1);
    expect(result.openTabs[0]).toContain('type=pomodoro');
    expect(result.openTabs[0]).toContain('forcedBreak=false');
    // state should mark pomodoro as idle
    expect(result.tickResult?.state.pomodoro.status).toBe('idle');
  });

  it('opens pomodoro finish page with forcedBreak when 3 consecutive', () => {
    const now = Date.now();
    const data = makeData({
      state: makeState({
        pomodoro: { status: 'ongoing', startedAt: now - 26 * 60 * 1000, updatedAt: now, consecutiveCount: 2 },
      }),
    });

    const result = handleTick(data, now, FINISH_URL);

    expect(result.openTabs.length).toBe(1);
    expect(result.openTabs[0]).toContain('forcedBreak=true');
    // consecutiveCount should reset to 0 after forced break
    expect(result.tickResult?.state.pomodoro.consecutiveCount).toBe(0);
  });

  it('normal tick returns tickResult with energyDrop for delta merge', () => {
    const now = Date.now();
    const data = makeData();
    const result = handleTick(data, now, FINISH_URL);

    expect(result.type).toBe('tick');
    expect(result.tickResult).toBeDefined();
    expect(result.tickResult!.energyDrop).toBeGreaterThan(0);
  });

  it('does NOT open finish page when timer still running', () => {
    const now = Date.now();
    const data = makeData({
      state: makeState({
        pomodoro: { status: 'ongoing', startedAt: now - 10 * 60 * 1000, updatedAt: now, consecutiveCount: 0 },
      }),
    });

    const result = handleTick(data, now, FINISH_URL);

    expect(result.openTabs).toEqual([]);
    expect(result.tickResult?.state.pomodoro.status).toBe('ongoing');
  });

  it('opens low energy page when energy drops below 20', () => {
    const now = Date.now();
    const data = makeData({
      state: makeState({
        energy: 15,
        lowEnergyReminded: false,
      }),
    });

    const result = handleTick(data, now, FINISH_URL);

    expect(result.openTabs.some(url => url.includes('type=energy'))).toBe(true);
    expect(result.tickResult?.state.lowEnergyReminded).toBe(true);
  });

  it('does NOT open low energy page if already reminded', () => {
    const now = Date.now();
    const data = makeData({
      state: makeState({
        energy: 15,
        lowEnergyReminded: true,
      }),
    });

    const result = handleTick(data, now, FINISH_URL);

    expect(result.openTabs.some(url => url.includes('type=energy'))).toBe(false);
  });

  it('can trigger both pomodoro and low energy simultaneously', () => {
    const now = Date.now();
    const data = makeData({
      state: makeState({
        energy: 10,
        lowEnergyReminded: false,
        pomodoro: { status: 'ongoing', startedAt: now - 26 * 60 * 1000, updatedAt: now, consecutiveCount: 0 },
      }),
    });

    const result = handleTick(data, now, FINISH_URL);

    expect(result.openTabs.length).toBe(2);
    expect(result.openTabs.some(url => url.includes('type=energy'))).toBe(true);
    expect(result.openTabs.some(url => url.includes('type=pomodoro'))).toBe(true);
  });

  it('handles day rollover', () => {
    const now = Date.now();
    const data = makeData({
      state: makeState({
        logicalDate: '2020-01-01', // old date to trigger rollover
      }),
    });

    const result = handleTick(data, now, FINISH_URL);

    expect(result.type).toBe('dayRollover');
    expect(result.openTabs).toEqual([]);
    expect(result.toWrite.state).toBeDefined();
  });
});
