import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { parseTimeStr, getLogicalDate, getLogical8AM, buildEmptyTasks } from '../shared/utils/time';
import { DEFAULT_TASK_DEFS } from '../shared/types';

describe('parseTimeStr', () => {
  it('should handle null correctly', () => {
    expect(parseTimeStr(null)).toBe(24);
  });

  it('should handle empty string', () => {
    expect(parseTimeStr('')).toBe(24);
  });

  it('should parse AM times correctly', () => {
    expect(parseTimeStr('8 AM')).toBe(8);
    expect(parseTimeStr('11 AM')).toBe(11);
    expect(parseTimeStr('1 AM')).toBe(1);
  });

  it('should parse PM times correctly', () => {
    expect(parseTimeStr('1 PM')).toBe(13);
    expect(parseTimeStr('11 PM')).toBe(23);
    expect(parseTimeStr('5 PM')).toBe(17);
  });

  it('should handle 12 AM as midnight (0)', () => {
    expect(parseTimeStr('12 AM')).toBe(0);
  });

  it('should handle 12 PM as noon (12)', () => {
    expect(parseTimeStr('12 PM')).toBe(12);
  });

  it('should cover all hours', () => {
    // AM: 12=0, 1=1, 2=2, ..., 11=11
    expect(parseTimeStr('12 AM')).toBe(0);
    for (let i = 1; i <= 11; i++) {
      expect(parseTimeStr(`${i} AM`)).toBe(i);
    }
    // PM: 12=12, 1=13, 2=14, ..., 11=23
    expect(parseTimeStr('12 PM')).toBe(12);
    for (let i = 1; i <= 11; i++) {
      expect(parseTimeStr(`${i} PM`)).toBe(i + 12);
    }
  });
});

describe('getLogicalDate', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('after 8AM: returns today', () => {
    vi.setSystemTime(new Date('2026-03-31T12:00:00'));
    expect(getLogicalDate()).toBe('2026-03-31');
  });

  it('before 8AM: returns yesterday', () => {
    vi.setSystemTime(new Date('2026-03-31T07:59:00'));
    expect(getLogicalDate()).toBe('2026-03-30');
  });

  it('exactly 8AM: returns today', () => {
    vi.setSystemTime(new Date('2026-03-31T08:00:00'));
    expect(getLogicalDate()).toBe('2026-03-31');
  });
});

describe('getLogical8AM', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('after 8AM: returns today 8AM', () => {
    vi.setSystemTime(new Date('2026-03-31T12:00:00'));
    const expected = new Date('2026-03-31T08:00:00').getTime();
    expect(getLogical8AM()).toBe(expected);
  });

  it('before 8AM: returns yesterday 8AM', () => {
    vi.setSystemTime(new Date('2026-03-31T05:00:00'));
    const expected = new Date('2026-03-30T08:00:00').getTime();
    expect(getLogical8AM()).toBe(expected);
  });
});

describe('buildEmptyTasks', () => {
  it('creates correct default values per type', () => {
    const tasks = buildEmptyTasks(DEFAULT_TASK_DEFS);
    expect(tasks['sleep']).toBeNull();        // number type
    expect(tasks['meals']).toBe(0);           // counter type
    expect(tasks['nap']).toBe(false);         // boolean type
  });

  it('skips disabled tasks', () => {
    const defs = DEFAULT_TASK_DEFS.map(d => d.id === 'poop' ? { ...d, enabled: false } : d);
    const tasks = buildEmptyTasks(defs);
    expect('poop' in tasks).toBe(false);
  });
});
