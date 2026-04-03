import { describe, it, expect } from 'vitest';
import { calculateDecay, calculateRecovery, checkPomodoroExpired, isPerfectDay, isBadDay, calculateMaxEnergyDelta } from '../shared/logic';
import { type Config, type CustomTaskDef, type PomodoroTimer, type Tasks, DEFAULT_CONFIG, DEFAULT_TASK_DEFS } from '../shared/types';

const config: Config = { ...DEFAULT_CONFIG };

// --- calculateDecay ---

describe('calculateDecay', () => {
  it('should decay at base rate when no meals missed', () => {
    const drop = calculateDecay(config, 3, 20, 10); // 3 meals, 8PM, 10 min
    expect(drop).toBeCloseTo((config.decayRate / 60) * 10);
  });

  it('should apply penalty when meals missed at 10:00', () => {
    const drop = calculateDecay(config, 0, 10, 10);
    expect(drop).toBeCloseTo((config.decayRate / 60) * config.penaltyMultiplier * 10);
  });

  it('should apply penalty when only 1 meal at 14:00', () => {
    const drop = calculateDecay(config, 1, 14, 10);
    expect(drop).toBeCloseTo((config.decayRate / 60) * config.penaltyMultiplier * 10);
  });

  it('should apply penalty when only 2 meals at 19:00', () => {
    const drop = calculateDecay(config, 2, 19, 10);
    expect(drop).toBeCloseTo((config.decayRate / 60) * config.penaltyMultiplier * 10);
  });

  it('should not penalize before 10:00', () => {
    const drop = calculateDecay(config, 0, 9, 10);
    expect(drop).toBeCloseTo((config.decayRate / 60) * 10);
  });

  it('should return 0 decay for 0 minutes', () => {
    expect(calculateDecay(config, 0, 12, 0)).toBe(0);
  });
});

// --- calculateRecovery ---

describe('calculateRecovery', () => {
  const sleepDef = DEFAULT_TASK_DEFS.find(d => d.id === 'sleep')!;
  const mealsDef = DEFAULT_TASK_DEFS.find(d => d.id === 'meals')!;
  const waterDef = DEFAULT_TASK_DEFS.find(d => d.id === 'water')!;
  const exerciseDef = DEFAULT_TASK_DEFS.find(d => d.id === 'exercise')!;
  const maxEnergy = 65;

  it('sleep 8h: no penalty (full recovery)', () => {
    expect(calculateRecovery(sleepDef, 8, config, maxEnergy)).toBeCloseTo(0);
  });

  it('sleep 6h: penalty proportional to deficit', () => {
    const result = calculateRecovery(sleepDef, 6, config, maxEnergy);
    expect(result).toBeCloseTo(-(maxEnergy * 2 / 8));
  });

  it('sleep 0h: maximum penalty', () => {
    const result = calculateRecovery(sleepDef, 0, config, maxEnergy);
    expect(result).toBeCloseTo(-maxEnergy);
  });

  it('sleep 10h: capped at 8h (no bonus)', () => {
    expect(calculateRecovery(sleepDef, 10, config, maxEnergy)).toBeCloseTo(0);
  });

  it('meals (mid heal): returns midHeal', () => {
    expect(calculateRecovery(mealsDef, true, config, maxEnergy)).toBe(config.midHeal);
  });

  it('water (small heal): returns smallHeal', () => {
    expect(calculateRecovery(waterDef, true, config, maxEnergy)).toBe(config.smallHeal);
  });

  it('exercise (mid heal): returns midHeal', () => {
    expect(calculateRecovery(exerciseDef, 30, config, maxEnergy)).toBe(config.midHeal);
  });

  it('none healLevel: returns 0', () => {
    const noneDef: CustomTaskDef = { ...mealsDef, id: 'custom', healLevel: 'none' };
    expect(calculateRecovery(noneDef, true, config, maxEnergy)).toBe(0);
  });
});

// --- checkPomodoroExpired ---

describe('checkPomodoroExpired', () => {
  it('idle pomodoro: not expired', () => {
    const pomo: PomodoroTimer = { status: 'idle', updatedAt: 0, consecutiveCount: 0 };
    const result = checkPomodoroExpired(pomo, Date.now());
    expect(result.expired).toBe(false);
  });

  it('ongoing with time remaining: not expired', () => {
    const now = Date.now();
    const pomo: PomodoroTimer = { status: 'ongoing', startedAt: now - 10 * 60 * 1000, updatedAt: now, consecutiveCount: 0 };
    expect(checkPomodoroExpired(pomo, now).expired).toBe(false);
  });

  it('ongoing past 25 min: expired', () => {
    const now = Date.now();
    const pomo: PomodoroTimer = { status: 'ongoing', startedAt: now - 26 * 60 * 1000, updatedAt: now, consecutiveCount: 0 };
    const result = checkPomodoroExpired(pomo, now);
    expect(result.expired).toBe(true);
    expect(result.newConsecutiveCount).toBe(1);
    expect(result.isForcedBreak).toBe(false);
  });

  it('ongoing exactly 25 min: expired', () => {
    const now = Date.now();
    const pomo: PomodoroTimer = { status: 'ongoing', startedAt: now - 25 * 60 * 1000, updatedAt: now, consecutiveCount: 0 };
    expect(checkPomodoroExpired(pomo, now).expired).toBe(true);
  });

  it('forced break at 3 consecutive', () => {
    const now = Date.now();
    const pomo: PomodoroTimer = { status: 'ongoing', startedAt: now - 30 * 60 * 1000, updatedAt: now, consecutiveCount: 2 };
    const result = checkPomodoroExpired(pomo, now);
    expect(result.expired).toBe(true);
    expect(result.isForcedBreak).toBe(true);
    expect(result.newConsecutiveCount).toBe(0); // reset after forced break
  });

  it('no startedAt: not expired', () => {
    const pomo: PomodoroTimer = { status: 'ongoing', updatedAt: Date.now(), consecutiveCount: 0 };
    expect(checkPomodoroExpired(pomo, Date.now()).expired).toBe(false);
  });
});

// --- isPerfectDay ---

describe('isPerfectDay', () => {
  const defs = DEFAULT_TASK_DEFS;

  it('all perfect day tasks completed: true', () => {
    const tasks: Tasks = { sleep: 8, exercise: 30, meals: 3, water: 5 };
    expect(isPerfectDay(tasks, defs)).toBe(true);
  });

  it('one task missing: false', () => {
    const tasks: Tasks = { sleep: 8, exercise: 30, meals: 2, water: 5 };
    expect(isPerfectDay(tasks, defs)).toBe(false);
  });

  it('non-countsForPerfectDay tasks ignored', () => {
    // stretch/nap/meditate/poop have countsForPerfectDay: false
    const tasks: Tasks = { sleep: 8, exercise: 30, meals: 3, water: 5, stretch: 0, nap: false };
    expect(isPerfectDay(tasks, defs)).toBe(true);
  });

  it('disabled tasks ignored', () => {
    const customDefs = defs.map(d => d.id === 'water' ? { ...d, enabled: false } : d);
    const tasks: Tasks = { sleep: 8, exercise: 30, meals: 3 }; // no water needed
    expect(isPerfectDay(tasks, customDefs)).toBe(true);
  });

  it('empty tasks: false', () => {
    expect(isPerfectDay({}, defs)).toBe(false);
  });
});

// --- isBadDay ---

describe('isBadDay', () => {
  it('sleep < 6, no exercise, no perfect pomos: bad day', () => {
    expect(isBadDay({ sleep: 4 }, 0)).toBe(true);
  });

  it('sleep < 6, exercise < 30, no perfect pomos: bad day', () => {
    expect(isBadDay({ sleep: 5, exercise: 20 }, 0)).toBe(true);
  });

  it('sleep not entered: still bad day (null = insufficient)', () => {
    expect(isBadDay({ sleep: null }, 0)).toBe(true);
    expect(isBadDay({}, 0)).toBe(true);
  });

  it('sleep >= 6: not bad day', () => {
    expect(isBadDay({ sleep: 6 }, 0)).toBe(false);
  });

  it('exercise >= 30: not bad day', () => {
    expect(isBadDay({ sleep: 4, exercise: 30 }, 0)).toBe(false);
  });

  it('pomoPerfectCount > 0: not bad day', () => {
    expect(isBadDay({ sleep: 4 }, 1)).toBe(false);
  });
});

// --- isBadDay ↔ calculateMaxEnergyDelta consistency ---

describe('isBadDay and calculateMaxEnergyDelta consistency', () => {
  const defs = DEFAULT_TASK_DEFS;

  it('penalty applied when isBadDay is true', () => {
    const tasks: Tasks = { sleep: 4, exercise: 0 };
    expect(isBadDay(tasks, 0)).toBe(true);
    expect(calculateMaxEnergyDelta(tasks, defs, 0, 0, config)).toBe(-config.badDayPenalty);
  });

  it('no penalty when isBadDay is false (exercise >= 30)', () => {
    const tasks: Tasks = { sleep: 4, exercise: 30 };
    expect(isBadDay(tasks, 0)).toBe(false);
    expect(calculateMaxEnergyDelta(tasks, defs, 0, 0, config)).toBe(0);
  });
});

// --- calculateMaxEnergyDelta ---

describe('calculateMaxEnergyDelta', () => {
  const defs = DEFAULT_TASK_DEFS;

  it('perfect day with 4+ perfect pomos: +bonus', () => {
    const tasks: Tasks = { sleep: 8, exercise: 30, meals: 3, water: 5 };
    const delta = calculateMaxEnergyDelta(tasks, defs, 5, 4, config);
    expect(delta).toBe(config.perfectDayBonus);
  });

  it('perfect day but only 3 perfect pomos: no bonus', () => {
    const tasks: Tasks = { sleep: 8, exercise: 30, meals: 3, water: 5 };
    const delta = calculateMaxEnergyDelta(tasks, defs, 5, 3, config);
    expect(delta).toBe(0);
  });

  it('bad day: no perfect pomos + no exercise + bad sleep: -penalty', () => {
    const tasks: Tasks = { sleep: 4, exercise: 0, meals: 1, water: 1 };
    const delta = calculateMaxEnergyDelta(tasks, defs, 0, 0, config);
    expect(delta).toBe(-config.badDayPenalty);
  });

  it('normal day: no bonus no penalty', () => {
    const tasks: Tasks = { sleep: 7, exercise: 30, meals: 2, water: 3 };
    const delta = calculateMaxEnergyDelta(tasks, defs, 2, 1, config);
    expect(delta).toBe(0);
  });
});
