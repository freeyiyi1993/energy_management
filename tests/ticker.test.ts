import { describe, it, expect, vi, beforeEach } from 'vitest';
import { type StorageData, type AppState, type PomodoroTimer, DEFAULT_CONFIG, DEFAULT_TASK_DEFS } from '../shared/types';
import { buildEmptyTasks } from '../shared/utils/time';

// Mock firebase (imported transitively by shared/storage)
vi.mock('../shared/firebase', () => ({
  auth: {},
  googleProvider: {},
  db: {},
}));

import { initAppData, handleDayRollover, processTick } from '../shared/ticker';

const basePomo: PomodoroTimer = { status: 'idle', updatedAt: 0, consecutiveCount: 0 };

const baseState = (overrides: Partial<AppState> = {}): AppState => ({
  logicalDate: '2026-03-31',
  energy: 65,
  maxEnergy: 65,
  energyConsumed: 0,
  lastUpdateTime: Date.now(),
  lowEnergyReminded: false,
  pomodoro: { ...basePomo },
  pomoCount: 0,
  pomoPerfectCount: 0,
  ...overrides,
});

// --- initAppData ---

describe('initAppData', () => {
  let written: Partial<StorageData>[];
  let storageSet: (data: Partial<StorageData>) => Promise<void>;

  beforeEach(() => {
    written = [];
    storageSet = async (data) => { written.push(data); };
  });

  it('creates new state when data is empty', async () => {
    const result = await initAppData({}, storageSet);
    expect(result.created).toBe(true);
    // Should have written config, taskDefs, and full state
    const stateWrite = written.find(w => w.state);
    expect(stateWrite).toBeDefined();
    expect(stateWrite!.state!.maxEnergy).toBe(DEFAULT_CONFIG.maxEnergy);
    expect(stateWrite!.state!.pomoCount).toBe(0);
    expect(stateWrite!.tasks).toBeDefined();
    expect(stateWrite!.logs).toEqual([]);
  });

  it('does not create state when it already exists', async () => {
    const data: StorageData = {
      config: DEFAULT_CONFIG,
      taskDefs: DEFAULT_TASK_DEFS,
      state: baseState(),
      tasks: buildEmptyTasks(DEFAULT_TASK_DEFS),
    };
    const result = await initAppData(data, storageSet);
    expect(result.created).toBe(false);
  });

  it('writes config when missing', async () => {
    const data: StorageData = { state: baseState(), taskDefs: DEFAULT_TASK_DEFS, tasks: {} };
    await initAppData(data, storageSet);
    const configWrite = written.find(w => w.config);
    expect(configWrite).toBeDefined();
    expect(configWrite!.config).toEqual(DEFAULT_CONFIG);
  });

  it('migrates builtin taskDefs healLevel/maxCount', async () => {
    const outdatedDefs = DEFAULT_TASK_DEFS.map(d =>
      d.id === 'water' ? { ...d, maxCount: 99 } : d
    );
    const data: StorageData = { config: DEFAULT_CONFIG, taskDefs: outdatedDefs, state: baseState(), tasks: {} };
    await initAppData(data, storageSet);
    const defWrite = written.find(w => w.taskDefs);
    expect(defWrite).toBeDefined();
    const waterDef = defWrite!.taskDefs!.find(d => d.id === 'water');
    expect(waterDef!.maxCount).toBe(DEFAULT_TASK_DEFS.find(d => d.id === 'water')!.maxCount);
  });

  it('does not write taskDefs when already up to date', async () => {
    const data: StorageData = { config: DEFAULT_CONFIG, taskDefs: DEFAULT_TASK_DEFS, state: baseState(), tasks: {} };
    await initAppData(data, storageSet);
    const defWrite = written.find(w => w.taskDefs);
    expect(defWrite).toBeUndefined();
  });
});

// --- handleDayRollover ---

describe('handleDayRollover', () => {
  it('holiday mode: no input → no stats, reset state', () => {
    const data: StorageData = {
      config: DEFAULT_CONFIG,
      taskDefs: DEFAULT_TASK_DEFS,
      state: baseState({ logicalDate: '2026-03-30', maxEnergy: 70 }),
      tasks: buildEmptyTasks(DEFAULT_TASK_DEFS),
      stats: [],
    };
    const { toWrite } = handleDayRollover(data, '2026-03-31');
    expect(toWrite.state!.logicalDate).toBe('2026-03-31');
    expect(toWrite.state!.energy).toBe(70); // maxEnergy unchanged
    expect(toWrite.stats!.length).toBe(0); // no stats pushed
  });

  it('normal day: pushes stats, resets tasks', () => {
    const data: StorageData = {
      config: DEFAULT_CONFIG,
      taskDefs: DEFAULT_TASK_DEFS,
      state: baseState({ logicalDate: '2026-03-30', maxEnergy: 65, energyConsumed: 20, pomoCount: 3, pomoPerfectCount: 1 }),
      tasks: { sleep: 7, exercise: 30, meals: 2, water: 3, stretch: 0, nap: false, meditate: 0, poop: false },
      stats: [],
    };
    const { toWrite } = handleDayRollover(data, '2026-03-31');
    expect(toWrite.state!.logicalDate).toBe('2026-03-31');
    expect(toWrite.stats!.length).toBe(1);
    expect(toWrite.stats![0].date).toBe('2026-03-30');
    expect(toWrite.stats![0].pomoCount).toBe(3);
    // tasks should be reset
    expect(toWrite.tasks!['sleep']).toBeNull();
  });

  it('perfect day: no bonus at day rollover (applied immediately on check-in)', () => {
    const data: StorageData = {
      config: { ...DEFAULT_CONFIG },
      taskDefs: DEFAULT_TASK_DEFS,
      state: baseState({ logicalDate: '2026-03-30', maxEnergy: 65, pomoCount: 5, pomoPerfectCount: 4 }),
      tasks: { sleep: 8, exercise: 30, meals: 3, water: 5, stretch: 3, nap: true, meditate: 3, poop: true },
      stats: [],
    };
    const { toWrite } = handleDayRollover(data, '2026-03-31');
    expect(toWrite.state!.maxEnergy).toBe(65); // unchanged at rollover
    expect(toWrite.stats![0].maxEnergy).toBe(65);
  });

  it('bad day: maxEnergy decreases + stats records new value + config synced', () => {
    const data: StorageData = {
      config: { ...DEFAULT_CONFIG },
      taskDefs: DEFAULT_TASK_DEFS,
      state: baseState({ logicalDate: '2026-03-30', maxEnergy: 65, pomoCount: 0, pomoPerfectCount: 0 }),
      tasks: { sleep: 4, exercise: 0, meals: 1, water: 1, stretch: 0, nap: false, meditate: 0, poop: false },
      stats: [],
    };
    const { toWrite } = handleDayRollover(data, '2026-03-31');
    expect(toWrite.state!.maxEnergy).toBe(64);
    expect(toWrite.stats![0].maxEnergy).toBe(64);
    expect(toWrite.config!.maxEnergy).toBe(64);
  });

  it('holiday (only water): no penalty, no stats', () => {
    const data: StorageData = {
      config: { ...DEFAULT_CONFIG },
      taskDefs: DEFAULT_TASK_DEFS,
      state: baseState({ logicalDate: '2026-03-30', maxEnergy: 65, pomoCount: 0, pomoPerfectCount: 0 }),
      tasks: { sleep: null, exercise: null, meals: 0, water: 3, stretch: 0, nap: false, meditate: 0, poop: false },
      stats: [],
    };
    const { toWrite } = handleDayRollover(data, '2026-03-31');
    expect(toWrite.state!.maxEnergy).toBe(65);
    // water > 0 so isNoInput=false, but isBadDay=false (holiday protection)
    expect(toWrite.stats![0].maxEnergy).toBe(65);
  });

  it('perfect day: no log entry at day rollover (logged at check-in time)', () => {
    const data: StorageData = {
      config: DEFAULT_CONFIG,
      taskDefs: DEFAULT_TASK_DEFS,
      state: baseState({ logicalDate: '2026-03-30', maxEnergy: 65, pomoCount: 5, pomoPerfectCount: 4 }),
      tasks: { sleep: 8, exercise: 30, meals: 3, water: 5, stretch: 3, nap: true, meditate: 3, poop: true },
      stats: [],
      logs: [],
    };
    const { toWrite } = handleDayRollover(data, '2026-03-31');
    const perfectLog = toWrite.logs!.find((l: any) => l[1] === 9); // PERFECT_DAY_ACTION_ID
    expect(perfectLog).toBeUndefined(); // no perfect day log at rollover
  });

  it('bad day: writes log entry with maxEnergy change', () => {
    const data: StorageData = {
      config: DEFAULT_CONFIG,
      taskDefs: DEFAULT_TASK_DEFS,
      state: baseState({ logicalDate: '2026-03-30', maxEnergy: 65, pomoCount: 0, pomoPerfectCount: 0 }),
      tasks: { sleep: 4, exercise: 0, meals: 1, water: 1, stretch: 0, nap: false, meditate: 0, poop: false },
      stats: [],
      logs: [],
    };
    const { toWrite } = handleDayRollover(data, '2026-03-31');
    const badLog = toWrite.logs!.find((l: any) => l[1] === 10); // BAD_DAY_ACTION_ID
    expect(badLog).toBeTruthy();
    expect(badLog![2]).toBe(64); // new maxEnergy
    expect(badLog![3]).toBe(-DEFAULT_CONFIG.badDayPenalty);
  });

  it('normal day: no perfect/bad day log entries', () => {
    const data: StorageData = {
      config: DEFAULT_CONFIG,
      taskDefs: DEFAULT_TASK_DEFS,
      state: baseState({ logicalDate: '2026-03-30', maxEnergy: 65, energyConsumed: 20, pomoCount: 3, pomoPerfectCount: 1 }),
      tasks: { sleep: 7, exercise: 30, meals: 2, water: 3, stretch: 0, nap: false, meditate: 0, poop: false },
      stats: [],
      logs: [],
    };
    const { toWrite } = handleDayRollover(data, '2026-03-31');
    const settlementLogs = (toWrite.logs || []).filter((l: any) => l[1] === 9 || l[1] === 10);
    expect(settlementLogs.length).toBe(0);
  });

  it('resets pomodoro consecutiveCount', () => {
    const data: StorageData = {
      config: DEFAULT_CONFIG,
      taskDefs: DEFAULT_TASK_DEFS,
      state: baseState({ logicalDate: '2026-03-30', pomodoro: { status: 'idle', updatedAt: 0, consecutiveCount: 2 } }),
      tasks: buildEmptyTasks(DEFAULT_TASK_DEFS),
      stats: [],
    };
    const { toWrite } = handleDayRollover(data, '2026-03-31');
    expect(toWrite.state!.pomodoro.consecutiveCount).toBe(0);
  });
});

// --- processTick ---

describe('processTick', () => {
  it('applies decay based on time passed', () => {
    const now = Date.now();
    const data: StorageData = {
      config: DEFAULT_CONFIG,
      state: baseState({ energy: 65, lastUpdateTime: now - 60000 }), // 1 minute ago
      tasks: { meals: 3 },
    };
    const result = processTick(data, now);
    const expectedDrop = DEFAULT_CONFIG.decayRate / 60; // 1 minute of decay
    expect(result.state.energy).toBeCloseTo(65 - expectedDrop);
    expect(result.state.energyConsumed).toBeCloseTo(expectedDrop);
    expect(result.energyDrop).toBeCloseTo(expectedDrop);
    expect(result.lowEnergyTriggered).toBe(false);
    expect(result.pomoExpired).toBe(false);
  });

  it('triggers low energy when energy < 20', () => {
    const now = Date.now();
    const data: StorageData = {
      config: DEFAULT_CONFIG,
      state: baseState({ energy: 19.5, lastUpdateTime: now - 60000, lowEnergyReminded: false }),
      tasks: { meals: 3 },
    };
    const result = processTick(data, now);
    expect(result.lowEnergyTriggered).toBe(true);
    expect(result.state.lowEnergyReminded).toBe(true);
  });

  it('does not re-trigger low energy if already reminded', () => {
    const now = Date.now();
    const data: StorageData = {
      config: DEFAULT_CONFIG,
      state: baseState({ energy: 10, lastUpdateTime: now - 60000, lowEnergyReminded: true }),
      tasks: { meals: 3 },
    };
    const result = processTick(data, now);
    expect(result.lowEnergyTriggered).toBe(false);
  });

  it('detects expired pomodoro', () => {
    const now = Date.now();
    const data: StorageData = {
      config: DEFAULT_CONFIG,
      state: baseState({
        energy: 50,
        lastUpdateTime: now - 60000,
        pomodoro: { status: 'ongoing', startedAt: now - 26 * 60000, updatedAt: now - 26 * 60000, consecutiveCount: 0 },
      }),
      tasks: { meals: 3 },
    };
    const result = processTick(data, now);
    expect(result.pomoExpired).toBe(true);
    expect(result.isForcedBreak).toBe(false);
    expect(result.state.pomodoro.status).toBe('idle');
    expect(result.state.pomodoro.consecutiveCount).toBe(1);
  });

  it('detects forced break at 3 consecutive', () => {
    const now = Date.now();
    const data: StorageData = {
      config: DEFAULT_CONFIG,
      state: baseState({
        energy: 50,
        lastUpdateTime: now - 60000,
        pomodoro: { status: 'ongoing', startedAt: now - 30 * 60000, updatedAt: now - 30 * 60000, consecutiveCount: 2 },
      }),
      tasks: { meals: 3 },
    };
    const result = processTick(data, now);
    expect(result.pomoExpired).toBe(true);
    expect(result.isForcedBreak).toBe(true);
    expect(result.state.pomodoro.consecutiveCount).toBe(0);
  });

  it('idle pomodoro: not expired', () => {
    const now = Date.now();
    const data: StorageData = {
      config: DEFAULT_CONFIG,
      state: baseState({ energy: 50, lastUpdateTime: now - 60000 }),
      tasks: { meals: 3 },
    };
    const result = processTick(data, now);
    expect(result.pomoExpired).toBe(false);
  });

  it('applies meal penalty when meals missed', () => {
    const now = Date.now();
    // Force hour to be after 10:00 for penalty
    vi.spyOn(Date.prototype, 'getHours').mockReturnValue(12);
    const data: StorageData = {
      config: DEFAULT_CONFIG,
      state: baseState({ energy: 65, lastUpdateTime: now - 60000 }),
      tasks: { meals: 0 }, // no meals
    };
    const result = processTick(data, now);
    const expectedDrop = (DEFAULT_CONFIG.decayRate / 60) * DEFAULT_CONFIG.penaltyMultiplier;
    expect(result.state.energy).toBeCloseTo(65 - expectedDrop);
    vi.restoreAllMocks();
  });
});
