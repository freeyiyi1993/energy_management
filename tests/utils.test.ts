import { describe, it, expect } from 'vitest';
import { parseTimeStr } from '../shared/utils/time';

describe('parseTimeStr', () => {
  it('should handle null correctly', () => {
    expect(parseTimeStr(null)).toBe(24);
  });

  it('should parse AM times correctly', () => {
    expect(parseTimeStr('8 AM')).toBe(8);
    expect(parseTimeStr('12 AM')).toBe(0);
    expect(parseTimeStr('11 AM')).toBe(11);
  });

  it('should parse PM times correctly', () => {
    expect(parseTimeStr('1 PM')).toBe(13);
    expect(parseTimeStr('12 PM')).toBe(12);
    expect(parseTimeStr('11 PM')).toBe(23);
  });
});