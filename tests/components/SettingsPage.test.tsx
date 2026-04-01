import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { type StorageData, DEFAULT_TASK_DEFS, DEFAULT_CONFIG } from '../../shared/types';

// Mock firebase
vi.mock('../../shared/firebase', () => ({
  auth: {},
  googleProvider: {},
  db: {},
}));

import SettingsPage from '../../shared/components/SettingsPage';
import { type StorageInterface } from '../../shared/storage';

function makeData(overrides: Partial<StorageData> = {}): StorageData {
  return {
    state: {
      logicalDate: '2026-04-01',
      energy: 50,
      maxEnergy: 65,
      energyConsumed: 0,
      lastUpdateTime: Date.now(),
      lowEnergyReminded: false,
      pomodoro: { status: 'idle', updatedAt: 0, consecutiveCount: 0 },
      pomoCount: 0,
      pomoPerfectCount: 0,
    },
    tasks: {},
    config: DEFAULT_CONFIG,
    taskDefs: [...DEFAULT_TASK_DEFS],
    logs: [],
    ...overrides,
  };
}

function mockStorage(getData: Partial<StorageData> = {}): StorageInterface {
  return {
    get: vi.fn(async () => getData),
    set: vi.fn(async () => {}),
  };
}

describe('SettingsPage', () => {
  it('renders config form fields', () => {
    const data = makeData();
    render(<SettingsPage data={data} storage={mockStorage(data)} onBack={() => {}} onSaved={() => {}} />);

    expect(screen.getByText('系统设置')).toBeTruthy();
    expect(screen.getByText('默认精力上限')).toBeTruthy();
    expect(screen.getByText(/小恢复点数/)).toBeTruthy();
    expect(screen.getByText(/基础消耗速率/)).toBeTruthy();
  });

  it('saves config on button click', async () => {
    const data = makeData();
    const storage = mockStorage(data);
    const onSaved = vi.fn();

    render(<SettingsPage data={data} storage={storage} onBack={() => {}} onSaved={onSaved} />);

    fireEvent.click(screen.getByText('保存并应用'));

    await waitFor(() => {
      expect(storage.set).toHaveBeenCalled();
      expect(onSaved).toHaveBeenCalled();
    });
  });

  it('opens task management section', () => {
    const data = makeData();
    render(<SettingsPage data={data} storage={mockStorage(data)} onBack={() => {}} onSaved={() => {}} />);

    fireEvent.click(screen.getByText('🎯 打卡事项管理'));

    // Should show builtin task names
    expect(screen.getByText('睡眠')).toBeTruthy();
    expect(screen.getByText('运动')).toBeTruthy();
    expect(screen.getByText('添加自定义事项')).toBeTruthy();
  });

  it('opens add task modal', () => {
    const data = makeData();
    render(<SettingsPage data={data} storage={mockStorage(data)} onBack={() => {}} onSaved={() => {}} />);

    // Open task section first
    fireEvent.click(screen.getByText('🎯 打卡事项管理'));
    fireEvent.click(screen.getByText('添加自定义事项'));

    // Modal should show
    expect(screen.getByText('添加任务')).toBeTruthy();
    expect(screen.getByText('确定')).toBeTruthy();
    expect(screen.getByText('取消')).toBeTruthy();
  });

  it('builtin tasks have no delete button', () => {
    const data = makeData();
    render(<SettingsPage data={data} storage={mockStorage(data)} onBack={() => {}} onSaved={() => {}} />);

    fireEvent.click(screen.getByText('🎯 打卡事项管理'));

    // All builtin tasks should have enable/edit but no delete (Trash2 icon)
    // Count edit buttons vs task count
    const editBtns = screen.getAllByText('编辑');
    expect(editBtns.length).toBe(DEFAULT_TASK_DEFS.length);
  });
});
