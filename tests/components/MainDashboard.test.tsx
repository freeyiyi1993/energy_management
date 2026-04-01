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
});
