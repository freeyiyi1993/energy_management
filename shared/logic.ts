import { type Config, type CustomTaskDef, type Tasks, type PomodoroTimer } from './types';

/** 完美一天所需完美番茄数 */
export const PERFECT_POMODOROS_REQUIRED = 4;

/** 计算精力衰减量 */
export function calculateDecay(config: Config, mealsCount: number, currentHour: number, minsPassed: number): number {
  let decayRate = config.decayRate / 60;
  const missedMeals =
    (currentHour >= 10 && mealsCount < 1) ||
    (currentHour >= 14 && mealsCount < 2) ||
    (currentHour >= 19 && mealsCount < 3);
  if (missedMeals) decayRate *= config.penaltyMultiplier;
  return decayRate * minsPassed;
}

/** 计算打卡恢复精力量（返回正值为恢复，负值为扣减） */
export function calculateRecovery(def: CustomTaskDef, val: number | boolean, config: Config, maxEnergy: number): number {
  if (def.id === 'sleep' && typeof val === 'number') {
    return -(maxEnergy * (8 - Math.min(val, 8)) / 8);
  }
  if (def.healLevel === 'big') return maxEnergy * config.bigHealRatio;
  if (def.healLevel === 'mid') return config.midHeal;
  if (def.healLevel === 'small') return config.smallHeal;
  return 0; // none
}

/** 检测番茄钟是否到期 */
export function checkPomodoroExpired(pomodoro: PomodoroTimer, now: number): { expired: boolean; isForcedBreak: boolean; newConsecutiveCount: number } {
  if (pomodoro.status !== 'ongoing') return { expired: false, isForcedBreak: false, newConsecutiveCount: pomodoro.consecutiveCount };
  if (!pomodoro.startedAt) return { expired: false, isForcedBreak: false, newConsecutiveCount: pomodoro.consecutiveCount };

  const timeLeft = 25 * 60 - (now - pomodoro.startedAt) / 1000;
  if (timeLeft > 0) return { expired: false, isForcedBreak: false, newConsecutiveCount: pomodoro.consecutiveCount };

  const newConsec = (pomodoro.consecutiveCount || 0) + 1;
  return { expired: true, isForcedBreak: newConsec >= 3, newConsecutiveCount: newConsec >= 3 ? 0 : newConsec };
}

/** 判断是否完美一天 */
export function isPerfectDay(tasks: Tasks, taskDefs: CustomTaskDef[]): boolean {
  const perfectDayDefs = taskDefs.filter(d => d.enabled && d.countsForPerfectDay);
  if (perfectDayDefs.length === 0) return false; // 无计入任务时不算完美
  return perfectDayDefs.every(def => {
    const v = tasks[def.id];
    if (def.type === 'counter') return (v as number || 0) >= (def.maxCount || 3);
    if (def.type === 'boolean') return !!v;
    return v !== null && v !== undefined;
  });
}

/** 完美一天完整条件：所有 perfectDay 任务完成 + N 个完美番茄 */
export function isFullPerfectDay(tasks: Tasks, taskDefs: CustomTaskDef[], pomoPerfectCount: number): boolean {
  return isPerfectDay(tasks, taskDefs) && pomoPerfectCount >= PERFECT_POMODOROS_REQUIRED;
}

/** 糟糕一天判定：至少录入了 sleep 或 exercise + 无完美番茄 + 运动未达标 + 睡眠不足 */
export function isBadDay(tasks: Tasks, pomoPerfectCount: number): boolean {
  const sleepVal = tasks['sleep'] as number | null;
  const exerciseVal = tasks['exercise'] as number | null;
  // sleep/exercise 都未录入视为假期，不扣罚
  if ((sleepVal == null) && (exerciseVal == null)) return false;
  return pomoPerfectCount === 0 && (!exerciseVal || exerciseVal < 30) && (!sleepVal || sleepVal < 6);
}

/** 日切时计算 maxEnergy 变化（仅糟糕一天惩罚，完美一天奖励在打卡时即时生效） */
export function calculateMaxEnergyDelta(
  tasks: Tasks, _taskDefs: CustomTaskDef[],
  _pomoCount: number, pomoPerfectCount: number, config: Config
): number {
  let delta = 0;
  if (isBadDay(tasks, pomoPerfectCount)) {
    delta -= config.badDayPenalty;
  }
  return delta;
}
