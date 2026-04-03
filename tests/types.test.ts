import { describe, it, expect } from 'vitest';
import { DEFAULT_TASK_DEFS, type CustomTaskDef } from '../shared/types';

describe('DEFAULT_TASK_DEFS', () => {
  it('should have exactly 8 built-in tasks', () => {
    expect(DEFAULT_TASK_DEFS).toHaveLength(8);
  });

  it('should have correct task IDs in order', () => {
    const ids = DEFAULT_TASK_DEFS.map(d => d.id);
    expect(ids).toEqual([
      'sleep', 'exercise', 'meals', 'water',
      'stretch', 'nap', 'meditate', 'poop'
    ]);
  });

  it('should all be marked as builtin', () => {
    for (const def of DEFAULT_TASK_DEFS) {
      expect(def.builtin).toBe(true);
    }
  });

  it('should all be enabled by default', () => {
    for (const def of DEFAULT_TASK_DEFS) {
      expect(def.enabled).toBe(true);
    }
  });

  it('should have correct countsForPerfectDay flags', () => {
    const perfectDayTasks = DEFAULT_TASK_DEFS.filter(d => d.countsForPerfectDay);
    const nonPerfectDayTasks = DEFAULT_TASK_DEFS.filter(d => !d.countsForPerfectDay);

    expect(perfectDayTasks.map(d => d.id)).toEqual(['sleep', 'exercise', 'meals', 'water', 'nap', 'poop']);
    expect(nonPerfectDayTasks.map(d => d.id)).toEqual(['stretch', 'meditate']);
  });

  it('should have correct task types', () => {
    const typeMap: Record<string, CustomTaskDef['type']> = {
      sleep: 'number',
      exercise: 'number',
      meals: 'counter',
      water: 'counter',
      stretch: 'counter',
      nap: 'boolean',
      meditate: 'counter',
      poop: 'boolean',
    };

    for (const def of DEFAULT_TASK_DEFS) {
      expect(def.type).toBe(typeMap[def.id]);
    }
  });

  it('should have correct heal levels', () => {
    const healMap: Record<string, CustomTaskDef['healLevel']> = {
      sleep: 'big',
      exercise: 'mid',
      meals: 'mid',
      water: 'small',
      stretch: 'small',
      nap: 'small',
      meditate: 'small',
      poop: 'small',
    };

    for (const def of DEFAULT_TASK_DEFS) {
      expect(def.healLevel).toBe(healMap[def.id]);
    }
  });

  it('counter tasks should have maxCount defined', () => {
    const counterTasks = DEFAULT_TASK_DEFS.filter(d => d.type === 'counter');
    for (const def of counterTasks) {
      expect(def.maxCount).toBeDefined();
      expect(def.maxCount).toBeGreaterThan(0);
    }
  });

  it('number tasks should have unit and placeholder defined', () => {
    const numberTasks = DEFAULT_TASK_DEFS.filter(d => d.type === 'number');
    for (const def of numberTasks) {
      expect(def.unit).toBeDefined();
      expect(def.placeholder).toBeDefined();
    }
  });

  it('each task should have a non-empty icon', () => {
    for (const def of DEFAULT_TASK_DEFS) {
      expect(def.icon.length).toBeGreaterThan(0);
    }
  });

  it('each task should have a non-empty name', () => {
    for (const def of DEFAULT_TASK_DEFS) {
      expect(def.name.length).toBeGreaterThan(0);
    }
  });

  it('task IDs should be unique', () => {
    const ids = DEFAULT_TASK_DEFS.map(d => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
