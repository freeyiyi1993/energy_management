import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { type StorageData, type AppState, type PomodoroTimer, type Config, type Tasks, type CustomTaskDef, DEFAULT_TASK_DEFS, DEFAULT_CONFIG } from '../../shared/types';

// Mock firebase
vi.mock('../../shared/firebase', () => ({
  auth: {},
  googleProvider: {},
  db: {},
}));

import MainDashboard, { shownThisSession } from '../../shared/components/MainDashboard';
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
  beforeEach(() => {
    shownThisSession.clear();
  });

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

  it('shows perfect day log with maxEnergy transition', () => {
    const now = Date.now();
    const data = makeData({
      logs: [[now - 1000, 9, 66, 1] as any], // PERFECT_DAY_ACTION_ID, newMax=66, delta=+1
    });
    render(<MainDashboard data={data} storage={mockStorage(data)} onOpenMenu={noop} onDataChange={noop} />);
    expect(screen.getByText('完美一天')).toBeTruthy();
    expect(screen.getByText('上限 65→66')).toBeTruthy();
  });

  it('shows bad day log with maxEnergy transition', () => {
    const now = Date.now();
    const data = makeData({
      logs: [[now - 1000, 10, 64, -1] as any], // BAD_DAY_ACTION_ID, newMax=64, delta=-1
    });
    render(<MainDashboard data={data} storage={mockStorage(data)} onOpenMenu={noop} onDataChange={noop} />);
    expect(screen.getByText('糟糕一天')).toBeTruthy();
    expect(screen.getByText('上限 65→64')).toBeTruthy();
  });

  it('returns null when state is missing', () => {
    const data: StorageData = { config: DEFAULT_CONFIG, tasks: {}, taskDefs: DEFAULT_TASK_DEFS };
    const { container } = render(<MainDashboard data={data} storage={mockStorage(data)} onOpenMenu={noop} onDataChange={noop} />);
    expect(container.innerHTML).toBe('');
  });

  // --- 完美一天庆祝弹窗 (要求任务完成 + 4个完美番茄) ---

  const perfectState = makeState({ pomoPerfectCount: 4 });
  const perfectTasks: Tasks = { sleep: 8, exercise: 30, meals: 3, water: 5, stretch: null, nap: true, meditate: null, poop: true };
  const almostPerfectTasks: Tasks = { sleep: 8, exercise: 30, meals: 3, water: 4, stretch: null, nap: true, meditate: null, poop: true };

  it('shows celebration when last counter task completes all tasks (with enough pomodoros)', () => {
    const before = makeData({ tasks: almostPerfectTasks, state: perfectState });
    const after = makeData({ tasks: perfectTasks, state: perfectState });
    const storage = mockStorage(before);

    const { rerender } = render(<MainDashboard data={before} storage={storage} onOpenMenu={noop} onDataChange={noop} />);
    expect(screen.queryByText('完美一天!')).toBeNull();

    rerender(<MainDashboard data={after} storage={storage} onOpenMenu={noop} onDataChange={noop} />);
    expect(screen.getByText('完美一天!')).toBeTruthy();
  });

  it('shows celebration when exercise (number type) completes all tasks', () => {
    const noExercise = makeData({ tasks: { ...perfectTasks, exercise: null }, state: perfectState });
    const withExercise = makeData({ tasks: perfectTasks, state: perfectState });
    const storage = mockStorage(noExercise);

    const { rerender } = render(<MainDashboard data={noExercise} storage={storage} onOpenMenu={noop} onDataChange={noop} />);
    rerender(<MainDashboard data={withExercise} storage={storage} onOpenMenu={noop} onDataChange={noop} />);
    expect(screen.getByText('完美一天!')).toBeTruthy();
  });

  it('does NOT show celebration without enough perfect pomodoros', () => {
    const before = makeData({ tasks: almostPerfectTasks, state: makeState({ pomoPerfectCount: 0 }) });
    const after = makeData({ tasks: perfectTasks, state: makeState({ pomoPerfectCount: 0 }) });
    const storage = mockStorage(before);

    const { rerender } = render(<MainDashboard data={before} storage={storage} onOpenMenu={noop} onDataChange={noop} />);
    rerender(<MainDashboard data={after} storage={storage} onOpenMenu={noop} onDataChange={noop} />);
    expect(screen.queryByText('完美一天!')).toBeNull();
  });

  it('shows celebration when 4th perfect pomodoro completes (tasks already done)', () => {
    const before = makeData({ tasks: perfectTasks, state: makeState({ pomoPerfectCount: 3 }) });
    const after = makeData({ tasks: perfectTasks, state: makeState({ pomoPerfectCount: 4 }) });
    const storage = mockStorage(before);

    const { rerender } = render(<MainDashboard data={before} storage={storage} onOpenMenu={noop} onDataChange={noop} />);
    expect(screen.queryByText('完美一天!')).toBeNull();

    rerender(<MainDashboard data={after} storage={storage} onOpenMenu={noop} onDataChange={noop} />);
    expect(screen.getByText('完美一天!')).toBeTruthy();
  });

  it('shows celebration on first render if already perfect (e.g. page refresh)', () => {
    const data = makeData({ tasks: perfectTasks, state: perfectState });
    render(<MainDashboard data={data} storage={mockStorage(data)} onOpenMenu={noop} onDataChange={noop} />);
    expect(screen.getByText('完美一天!')).toBeTruthy();
  });

  it('does not re-show celebration after navigation (same session)', () => {
    const data = makeData({ tasks: perfectTasks, state: perfectState });
    const { unmount } = render(<MainDashboard data={data} storage={mockStorage(data)} onOpenMenu={noop} onDataChange={noop} />);
    expect(screen.getByText('完美一天!')).toBeTruthy();
    unmount();

    render(<MainDashboard data={data} storage={mockStorage(data)} onOpenMenu={noop} onDataChange={noop} />);
    expect(screen.queryByText('完美一天!')).toBeNull();
  });

  it('closes celebration on button click', () => {
    const before = makeData({ tasks: almostPerfectTasks, state: perfectState });
    const after = makeData({ tasks: perfectTasks, state: perfectState });
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
    // before: exercise=30 → not bad; after: exercise changed to 20 + sleep=5 → bad
    const before = makeData({ tasks: { sleep: null, exercise: 30, meals: null, water: null, stretch: null, nap: null, meditate: null, poop: null }, state: makeState({ pomoPerfectCount: 0 }) });
    const after = makeData({ tasks: { sleep: 5, exercise: 20, meals: null, water: null, stretch: null, nap: null, meditate: null, poop: null }, state: makeState({ pomoPerfectCount: 0 }) });
    const storage = mockStorage(before);

    const { rerender } = render(<MainDashboard data={before} storage={storage} onOpenMenu={noop} onDataChange={noop} />);
    rerender(<MainDashboard data={after} storage={storage} onOpenMenu={noop} onDataChange={noop} />);
    expect(screen.getByText('糟糕一天')).toBeTruthy();
  });

  it('does not show bad day on holiday (sleep+exercise both null)', () => {
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
