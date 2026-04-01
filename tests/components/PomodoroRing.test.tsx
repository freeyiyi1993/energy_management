import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { type AppState, type PomodoroTimer } from '../../shared/types';

// Mock firebase
vi.mock('../../shared/firebase', () => ({
  auth: {},
  googleProvider: {},
  db: {},
}));

import PomodoroRing from '../../shared/components/PomodoroRing';
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
    pomoCount: 5,
    pomoPerfectCount: 2,
    ...overrides,
  };
}

function mockStorage(): StorageInterface {
  return {
    get: vi.fn(async () => ({})),
    set: vi.fn(async () => {}),
  };
}

describe('PomodoroRing', () => {
  it('shows 25:00 when idle', () => {
    const state = makeState();
    render(<PomodoroRing state={state} storage={mockStorage()} onDataChange={() => {}} />);
    expect(screen.getByText('25:00')).toBeTruthy();
  });

  it('shows countdown when ongoing', () => {
    const now = 1700000000000; // fixed timestamp
    vi.useFakeTimers({ now });
    const state = makeState({
      pomodoro: { status: 'ongoing', startedAt: now - 5 * 60 * 1000, updatedAt: now, consecutiveCount: 0 },
    });
    render(<PomodoroRing state={state} storage={mockStorage()} onDataChange={() => {}} />);
    // Should show 20:00 (25 - 5 minutes elapsed)
    expect(screen.getByText('20:00')).toBeTruthy();
    vi.useRealTimers();
  });

  it('toggles to ongoing on click', async () => {
    const state = makeState();
    const storage = mockStorage();
    const onDataChange = vi.fn();

    render(<PomodoroRing state={state} storage={storage} onDataChange={onDataChange} />);

    // Click the ring to start
    const ring = screen.getByText('25:00').closest('[style]');
    if (ring) fireEvent.click(ring);

    await waitFor(() => {
      expect(storage.set).toHaveBeenCalled();
      const setCall = (storage.set as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(setCall.state.pomodoro.status).toBe('ongoing');
      expect(setCall.state.pomodoro.startedAt).toBeDefined();
      expect(onDataChange).toHaveBeenCalled();
    });
  });

  it('shows pomoCount and pomoPerfectCount', () => {
    const state = makeState({ pomoCount: 5, pomoPerfectCount: 2 });
    render(<PomodoroRing state={state} storage={mockStorage()} onDataChange={() => {}} />);
    expect(screen.getByText(/总: 5/)).toBeTruthy();
    expect(screen.getByText(/完美: 2/)).toBeTruthy();
  });

  it('applies compact styling', () => {
    const state = makeState();
    const { container } = render(<PomodoroRing state={state} storage={mockStorage()} onDataChange={() => {}} compact />);
    expect(container.querySelector('.w-\\[110px\\]')).toBeTruthy();
  });
});
