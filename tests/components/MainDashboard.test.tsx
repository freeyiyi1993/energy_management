import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { type StorageData, type AppState, type PomodoroTimer, type Config, type Tasks, type CustomTaskDef, DEFAULT_TASK_DEFS, DEFAULT_CONFIG } from '../../shared/types';

// Mock firebase
vi.mock('../../shared/firebase', () => ({
  auth: {},
  googleProvider: {},
  db: {},
}));

import MainDashboard from '../../shared/components/MainDashboard';
import { type StorageInterface } from '../../shared/storage';

const basePomo: PomodoroTimer = { status: 'idle', updatedAt: 0, consecutiveCount: 0 };

function makeState(overrides: Partial<AppState> = {}): AppState {
  return {
    logicalDate: '2026-04-01',
    energy: 50,
    maxEnergy: 65,
    energyConsumed: 0,
    lastUpdateTime: Date.now(),
    lowEnergyReminded: false,
    pomodoro: { ...basePomo },
    pomoCount: 3,
    pomoPerfectCount: 1,
    ...overrides,
  };
}

function makeData(overrides: Partial<StorageData> = {}): StorageData {
  const tasks: Tasks = {};
  DEFAULT_TASK_DEFS.forEach(d => { tasks[d.id] = null; });
  return {
    state: makeState(),
    tasks,
    config: DEFAULT_CONFIG,
    taskDefs: DEFAULT_TASK_DEFS,
    logs: [],
    ...overrides,
  };
}

function mockStorage(getData: Partial<StorageData>): StorageInterface {
  return {
    get: vi.fn(async () => getData),
    set: vi.fn(async () => {}),
  };
}

const noop = () => {};

describe('MainDashboard', () => {
  it('renders energy bar with current values', () => {
    const data = makeData();
    render(<MainDashboard data={data} storage={mockStorage(data)} onOpenMenu={noop} onDataChange={noop} />);
    expect(screen.getByText(/精力值:50 \/ 65/)).toBeTruthy();
  });

  it('renders all enabled tasks', () => {
    const data = makeData();
    render(<MainDashboard data={data} storage={mockStorage(data)} onOpenMenu={noop} onDataChange={noop} />);
    // Default enabled tasks: sleep, exercise, meals, water, stretch, nap, meditate, poop
    const enabledDefs = DEFAULT_TASK_DEFS.filter(d => d.enabled);
    enabledDefs.forEach(def => {
      if (def.type !== 'number') {
        expect(screen.getByText(new RegExp(def.name))).toBeTruthy();
      }
    });
  });

  it('counter task shows count and increments on click', async () => {
    const data = makeData({ tasks: { meals: 1, sleep: null, exercise: null, water: null, stretch: null, nap: null, meditate: null, poop: null } });
    const storageData = { ...data, tasks: { ...data.tasks } };
    const storage = mockStorage(storageData);
    const onDataChange = vi.fn();

    render(<MainDashboard data={data} storage={storage} onOpenMenu={noop} onDataChange={onDataChange} />);

    // meals is counter type with max 3, currently at 1
    // Text is split across elements, use a function matcher
    const mealsBtn = screen.getByRole('button', { name: /主食.*1\/3/ });
    expect(mealsBtn).toBeTruthy();

    fireEvent.click(mealsBtn);
    await waitFor(() => {
      expect(storage.set).toHaveBeenCalled();
      expect(onDataChange).toHaveBeenCalled();
    });
  });

  it('counter task disabled when maxed', () => {
    const data = makeData({ tasks: { meals: 3, sleep: null, exercise: null, water: null, stretch: null, nap: null, meditate: null, poop: null } });
    render(<MainDashboard data={data} storage={mockStorage(data)} onOpenMenu={noop} onDataChange={noop} />);

    const maxedBtn = screen.getByText(/已满 \(3\/3\)/);
    expect(maxedBtn).toBeTruthy();
    expect(maxedBtn.closest('button')?.disabled).toBe(true);
  });

  it('boolean task shows completed state', () => {
    const data = makeData({ tasks: { nap: true, sleep: null, exercise: null, meals: null, water: null, stretch: null, meditate: null, poop: null } });
    render(<MainDashboard data={data} storage={mockStorage(data)} onOpenMenu={noop} onDataChange={noop} />);

    // nap is boolean type, should show completed
    const completedBtns = screen.getAllByText('✅ 已完成');
    expect(completedBtns.length).toBeGreaterThan(0);
  });

  it('shows pomodoro count in ring', () => {
    const data = makeData();
    render(<MainDashboard data={data} storage={mockStorage(data)} onOpenMenu={noop} onDataChange={noop} />);
    expect(screen.getByText(/总: 3/)).toBeTruthy();
    expect(screen.getByText(/完美: 1/)).toBeTruthy();
  });

  it('shows stats button when onNavigate provided', () => {
    const data = makeData();
    const onNavigate = vi.fn();
    render(<MainDashboard data={data} storage={mockStorage(data)} onOpenMenu={noop} onDataChange={noop} onNavigate={onNavigate} />);
    const statsBtn = screen.getByText('数据统计');
    fireEvent.click(statsBtn);
    expect(onNavigate).toHaveBeenCalledWith('stats');
  });

  it('shows today log entries', () => {
    const now = Date.now();
    const data = makeData({
      logs: [[now - 60000, 0, 8, 13] as any], // sleep log
    });
    render(<MainDashboard data={data} storage={mockStorage(data)} onOpenMenu={noop} onDataChange={noop} />);
    expect(screen.getByText('今日记录')).toBeTruthy();
    expect(screen.getByText('8h')).toBeTruthy();
  });

  it('returns null when state is missing', () => {
    const data: StorageData = { config: DEFAULT_CONFIG, tasks: {}, taskDefs: DEFAULT_TASK_DEFS };
    const { container } = render(<MainDashboard data={data} storage={mockStorage(data)} onOpenMenu={noop} onDataChange={noop} />);
    expect(container.innerHTML).toBe('');
  });

  // --- 完美一天庆祝弹窗 (完美一天 = 所有 perfectDay 任务完成 + 4 个完美番茄) ---

  const perfectTasks: Tasks = { sleep: 8, exercise: 30, meals: 3, water: 5, stretch: null, nap: null, meditate: null, poop: null };
  const almostPerfectTasks: Tasks = { sleep: 8, exercise: 30, meals: 3, water: 4, stretch: null, nap: null, meditate: null, poop: null };

  it('shows celebration when last counter task completes perfect day', () => {
    const before = makeData({ tasks: almostPerfectTasks, state: makeState({ pomoPerfectCount: 4 }) });
    const after = makeData({ tasks: perfectTasks, state: makeState({ pomoPerfectCount: 4 }) });
    const storage = mockStorage(before);

    const { rerender } = render(<MainDashboard data={before} storage={storage} onOpenMenu={noop} onDataChange={noop} />);
    expect(screen.queryByText('完美一天!')).toBeNull();

    rerender(<MainDashboard data={after} storage={storage} onOpenMenu={noop} onDataChange={noop} />);
    expect(screen.getByText('完美一天!')).toBeTruthy();
  });

  it('shows celebration when exercise (number type) completes perfect day', () => {
    const noExercise = makeData({
      tasks: { ...perfectTasks, exercise: null },
      state: makeState({ pomoPerfectCount: 4 }),
    });
    const withExercise = makeData({
      tasks: { ...perfectTasks, exercise: 30 },
      state: makeState({ pomoPerfectCount: 4 }),
    });
    const storage = mockStorage(noExercise);

    const { rerender } = render(<MainDashboard data={noExercise} storage={storage} onOpenMenu={noop} onDataChange={noop} />);
    expect(screen.queryByText('完美一天!')).toBeNull();

    rerender(<MainDashboard data={withExercise} storage={storage} onOpenMenu={noop} onDataChange={noop} />);
    expect(screen.getByText('完美一天!')).toBeTruthy();
  });

  it('shows celebration when 4th perfect pomodoro completes perfect day', () => {
    const before = makeData({ tasks: perfectTasks, state: makeState({ pomoPerfectCount: 3 }) });
    const after = makeData({ tasks: perfectTasks, state: makeState({ pomoPerfectCount: 4 }) });
    const storage = mockStorage(before);

    const { rerender } = render(<MainDashboard data={before} storage={storage} onOpenMenu={noop} onDataChange={noop} />);
    expect(screen.queryByText('完美一天!')).toBeNull();

    rerender(<MainDashboard data={after} storage={storage} onOpenMenu={noop} onDataChange={noop} />);
    expect(screen.getByText('完美一天!')).toBeTruthy();
  });

  it('shows celebration when boolean task completes perfect day', () => {
    const simpleDefs: CustomTaskDef[] = [
      { id: 'water', name: '喝水打卡', icon: '💧', type: 'counter', healLevel: 'small', maxCount: 2, builtin: true, enabled: true, countsForPerfectDay: true },
      { id: 'nap',   name: '午间小憩', icon: '🌙', type: 'boolean', healLevel: 'small', builtin: true, enabled: true, countsForPerfectDay: true },
    ];
    const before = makeData({ tasks: { water: 2, nap: null }, taskDefs: simpleDefs, state: makeState({ pomoPerfectCount: 4 }) });
    const after = makeData({ tasks: { water: 2, nap: true }, taskDefs: simpleDefs, state: makeState({ pomoPerfectCount: 4 }) });
    const storage = mockStorage(before);

    const { rerender } = render(<MainDashboard data={before} storage={storage} onOpenMenu={noop} onDataChange={noop} />);
    expect(screen.queryByText('完美一天!')).toBeNull();

    rerender(<MainDashboard data={after} storage={storage} onOpenMenu={noop} onDataChange={noop} />);
    expect(screen.getByText('完美一天!')).toBeTruthy();
  });

  it('does not show celebration when tasks done but pomoPerfectCount < 4', () => {
    const before = makeData({ tasks: almostPerfectTasks, state: makeState({ pomoPerfectCount: 2 }) });
    const after = makeData({ tasks: perfectTasks, state: makeState({ pomoPerfectCount: 2 }) });
    const storage = mockStorage(before);

    const { rerender } = render(<MainDashboard data={before} storage={storage} onOpenMenu={noop} onDataChange={noop} />);
    rerender(<MainDashboard data={after} storage={storage} onOpenMenu={noop} onDataChange={noop} />);
    expect(screen.queryByText('完美一天!')).toBeNull();
  });

  it('does not show celebration on first render even if already perfect', () => {
    const data = makeData({ tasks: perfectTasks, state: makeState({ pomoPerfectCount: 4 }) });
    render(<MainDashboard data={data} storage={mockStorage(data)} onOpenMenu={noop} onDataChange={noop} />);
    expect(screen.queryByText('完美一天!')).toBeNull();
  });

  it('closes celebration on button click', () => {
    const before = makeData({ tasks: almostPerfectTasks, state: makeState({ pomoPerfectCount: 4 }) });
    const after = makeData({ tasks: perfectTasks, state: makeState({ pomoPerfectCount: 4 }) });
    const storage = mockStorage(before);

    const { rerender } = render(<MainDashboard data={before} storage={storage} onOpenMenu={noop} onDataChange={noop} />);
    rerender(<MainDashboard data={after} storage={storage} onOpenMenu={noop} onDataChange={noop} />);
    expect(screen.getByText('完美一天!')).toBeTruthy();

    fireEvent.click(screen.getByText('太棒了'));
    expect(screen.queryByText('完美一天!')).toBeNull();
  });

  // --- 糟糕一天弹窗 (sleep < 6 已录入 + exercise < 30 或未录入 + 完美番茄 = 0) ---

  it('shows bad day warning when sleep < 6 is entered with no exercise or pomodoros', () => {
    const before = makeData({ tasks: { sleep: null, exercise: null, meals: null, water: null, stretch: null, nap: null, meditate: null, poop: null } });
    const after = makeData({ tasks: { sleep: 4, exercise: null, meals: null, water: null, stretch: null, nap: null, meditate: null, poop: null }, state: makeState({ pomoPerfectCount: 0 }) });
    const storage = mockStorage(before);

    const { rerender } = render(<MainDashboard data={before} storage={storage} onOpenMenu={noop} onDataChange={noop} />);
    expect(screen.queryByText('糟糕一天')).toBeNull();

    rerender(<MainDashboard data={after} storage={storage} onOpenMenu={noop} onDataChange={noop} />);
    expect(screen.getByText('糟糕一天')).toBeTruthy();
  });

  it('shows bad day warning when sleep < 6 and exercise < 30', () => {
    const before = makeData({ tasks: { sleep: null, exercise: 20, meals: null, water: null, stretch: null, nap: null, meditate: null, poop: null }, state: makeState({ pomoPerfectCount: 0 }) });
    const after = makeData({ tasks: { sleep: 5, exercise: 20, meals: null, water: null, stretch: null, nap: null, meditate: null, poop: null }, state: makeState({ pomoPerfectCount: 0 }) });
    const storage = mockStorage(before);

    const { rerender } = render(<MainDashboard data={before} storage={storage} onOpenMenu={noop} onDataChange={noop} />);
    rerender(<MainDashboard data={after} storage={storage} onOpenMenu={noop} onDataChange={noop} />);
    expect(screen.getByText('糟糕一天')).toBeTruthy();
  });

  it('does not show bad day if sleep not entered yet', () => {
    const before = makeData({ tasks: { sleep: null, exercise: null, meals: null, water: null, stretch: null, nap: null, meditate: null, poop: null }, state: makeState({ pomoPerfectCount: 0 }) });
    const after = makeData({ tasks: { sleep: null, exercise: null, meals: 1, water: null, stretch: null, nap: null, meditate: null, poop: null }, state: makeState({ pomoPerfectCount: 0 }) });
    const storage = mockStorage(before);

    const { rerender } = render(<MainDashboard data={before} storage={storage} onOpenMenu={noop} onDataChange={noop} />);
    rerender(<MainDashboard data={after} storage={storage} onOpenMenu={noop} onDataChange={noop} />);
    expect(screen.queryByText('糟糕一天')).toBeNull();
  });

  it('does not show bad day if exercise >= 30', () => {
    const before = makeData({ tasks: { sleep: null, exercise: 30, meals: null, water: null, stretch: null, nap: null, meditate: null, poop: null }, state: makeState({ pomoPerfectCount: 0 }) });
    const after = makeData({ tasks: { sleep: 4, exercise: 30, meals: null, water: null, stretch: null, nap: null, meditate: null, poop: null }, state: makeState({ pomoPerfectCount: 0 }) });
    const storage = mockStorage(before);

    const { rerender } = render(<MainDashboard data={before} storage={storage} onOpenMenu={noop} onDataChange={noop} />);
    rerender(<MainDashboard data={after} storage={storage} onOpenMenu={noop} onDataChange={noop} />);
    expect(screen.queryByText('糟糕一天')).toBeNull();
  });

  it('does not show bad day if pomoPerfectCount > 0', () => {
    const before = makeData({ tasks: { sleep: null, exercise: null, meals: null, water: null, stretch: null, nap: null, meditate: null, poop: null }, state: makeState({ pomoPerfectCount: 1 }) });
    const after = makeData({ tasks: { sleep: 4, exercise: null, meals: null, water: null, stretch: null, nap: null, meditate: null, poop: null }, state: makeState({ pomoPerfectCount: 1 }) });
    const storage = mockStorage(before);

    const { rerender } = render(<MainDashboard data={before} storage={storage} onOpenMenu={noop} onDataChange={noop} />);
    rerender(<MainDashboard data={after} storage={storage} onOpenMenu={noop} onDataChange={noop} />);
    expect(screen.queryByText('糟糕一天')).toBeNull();
  });

  it('closes bad day warning on button click', () => {
    const before = makeData({ tasks: { sleep: null, exercise: null, meals: null, water: null, stretch: null, nap: null, meditate: null, poop: null } });
    const after = makeData({ tasks: { sleep: 3, exercise: null, meals: null, water: null, stretch: null, nap: null, meditate: null, poop: null }, state: makeState({ pomoPerfectCount: 0 }) });
    const storage = mockStorage(before);

    const { rerender } = render(<MainDashboard data={before} storage={storage} onOpenMenu={noop} onDataChange={noop} />);
    rerender(<MainDashboard data={after} storage={storage} onOpenMenu={noop} onDataChange={noop} />);
    expect(screen.getByText('糟糕一天')).toBeTruthy();

    fireEvent.click(screen.getByText('知道了'));
    expect(screen.queryByText('糟糕一天')).toBeNull();
  });
});
