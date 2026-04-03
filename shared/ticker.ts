import { type AppState, type Tasks, type StorageData, type CustomTaskDef, DEFAULT_TASK_DEFS, DEFAULT_CONFIG } from './types';
import { getLogicalDate, getLogical8AM, buildEmptyTasks } from './utils/time';
import { DEFAULT_POMODORO, migratePomodoro } from './storage';
import { calculateDecay, calculateMaxEnergyDelta, checkPomodoroExpired, isBadDay } from './logic';
import { BAD_DAY_ACTION_ID } from './constants/actionMapping';

/** 通用写入函数签名（由调用方注入，chrome.storage.local.set 或 localStorage wrapper） */
export type StorageSetFn = (data: Partial<StorageData>) => Promise<void>;

// --- initAppData ---

export interface InitAppDataResult {
  /** 是否创建了全新 state（首次安装） */
  created: boolean;
}

/**
 * 初始化应用数据：config/taskDefs 迁移、首次创建 state。
 * 平台无关，由调用方传入当前存储数据和写入函数。
 */
export async function initAppData(
  data: StorageData,
  storageSet: StorageSetFn,
): Promise<InitAppDataResult> {
  const todayStr = getLogicalDate();

  // --- config ---
  const config = data.config || DEFAULT_CONFIG;
  if (!data.config) {
    await storageSet({ config });
  }

  // --- taskDefs 内置任务属性迁移 ---
  let taskDefs = data.taskDefs || DEFAULT_TASK_DEFS;
  const builtinMap = new Map(DEFAULT_TASK_DEFS.filter(d => d.builtin).map(d => [d.id, d]));
  let taskDefsChanged = !data.taskDefs;
  taskDefs = taskDefs.map(def => {
    const builtin = builtinMap.get(def.id);
    if (!builtin) return def;
    if (def.healLevel !== builtin.healLevel || def.maxCount !== builtin.maxCount) {
      taskDefsChanged = true;
      return { ...def, healLevel: builtin.healLevel, maxCount: builtin.maxCount };
    }
    return def;
  });
  if (taskDefsChanged) {
    await storageSet({ taskDefs });
  }

  // --- state: 首次创建 or 旧格式迁移 ---
  if (!data.state) {
    const now = Date.now();
    const startOfToday = getLogical8AM();
    const minsPassedSince8AM = Math.max(0, (now - startOfToday) / 60000);

    let initialEnergy = config.maxEnergy;
    const decayRate = config.decayRate / 60;

    // 首次安装无 meals 数据，用基础衰减率（不加惩罚）
    initialEnergy -= decayRate * minsPassedSince8AM;

    await storageSet({
      state: {
        logicalDate: todayStr,
        maxEnergy: config.maxEnergy,
        energy: initialEnergy,
        lastUpdateTime: now,
        lowEnergyReminded: false,
        energyConsumed: 0,
        pomodoro: { ...DEFAULT_POMODORO, updatedAt: now },
        pomoCount: 0,
        pomoPerfectCount: 0,
      },
      tasks: buildEmptyTasks(taskDefs),
      stats: [],
      logs: [],
    });
    return { created: true };
  }

  // 旧格式迁移
  migratePomodoro(data.state);
  if (data.state.pomoCount === undefined) {
    await storageSet({ state: data.state });
  }
  return { created: false };
}

// --- handleDayRollover ---

export interface DayRolloverResult {
  /** 需要写入存储的数据 */
  toWrite: Partial<StorageData>;
}

/**
 * 日切逻辑：结算前一天、重置为新一天。
 * 返回需要写入存储的数据，由调用方执行写入。
 */
export function handleDayRollover(data: StorageData, todayStr: string): DayRolloverResult {
  const state = data.state as AppState;
  const tasks = data.tasks as Tasks;
  const stats = [...(data.stats || [])];
  const config = data.config || DEFAULT_CONFIG;
  const taskDefs = data.taskDefs || DEFAULT_TASK_DEFS;

  const pomoCount = state.pomoCount || 0;
  const perfectCount = state.pomoPerfectCount || 0;

  const enabledDefs = taskDefs.filter((d: CustomTaskDef) => d.enabled);
  const isNoInput = enabledDefs.every((def: CustomTaskDef) => {
    const v = tasks[def.id];
    if (def.type === 'counter') return (v as number || 0) === 0;
    if (def.type === 'boolean') return !v;
    return v === null || v === undefined;
  }) && pomoCount === 0;

  const logs = [...(data.logs || [])];

  if (!isNoInput) {
    const maxEnergyDelta = calculateMaxEnergyDelta(tasks, taskDefs, pomoCount, perfectCount, config);
    state.maxEnergy += maxEnergyDelta;

    // stats 记录 delta 后的 maxEnergy，让统计页体现完美/糟糕一天的效果
    stats.push({
      date: state.logicalDate,
      maxEnergy: state.maxEnergy,
      energyConsumed: state.energyConsumed || 0,
      pomoCount,
      perfectCount,
    });

    // 同步 config.maxEnergy，使设置页显示当前实际值
    if (maxEnergyDelta !== 0) {
      config.maxEnergy = state.maxEnergy;
    }

    // 日志记录精力上限变动（完美一天奖励已在打卡时即时生效，此处仅记录糟糕一天）
    const now = Date.now();
    if (isBadDay(tasks, perfectCount)) {
      logs.unshift([now, BAD_DAY_ACTION_ID, state.maxEnergy, maxEnergyDelta]);
    }
  }

  state.logicalDate = todayStr;
  state.energy = state.maxEnergy;
  state.energyConsumed = 0;
  state.lastUpdateTime = Date.now();
  state.lowEnergyReminded = false;
  state.pomoCount = 0;
  state.pomoPerfectCount = 0;
  state.pomodoro.consecutiveCount = 0;

  return {
    toWrite: { state, config, tasks: buildEmptyTasks(taskDefs), stats, logs },
  };
}

// --- processTick ---

export interface TickResult {
  /** 更新后的 state，需写入存储 */
  state: AppState;
  /** tick 产生的精力衰减量（用于 delta 合并，避免覆盖并发 UI 写入） */
  energyDrop: number;
  /** 是否触发低精力提醒 */
  lowEnergyTriggered: boolean;
  /** 番茄钟是否到期 */
  pomoExpired: boolean;
  /** 到期的番茄钟是否为强制休息 */
  isForcedBreak: boolean;
}

/**
 * 每分钟 tick：衰减 + 番茄钟过期检测。
 * 纯计算，返回结果由调用方决定写入和副作用。
 */
export function processTick(data: StorageData, now: number): TickResult {
  const state = data.state as AppState;
  const config = data.config || DEFAULT_CONFIG;
  const tasks = data.tasks || {};
  const minsPassed = (now - state.lastUpdateTime) / 60000;
  state.lastUpdateTime = now;

  const currentHour = new Date(now).getHours();
  const mealsCount = (tasks['meals'] as number) || 0;
  const drop = calculateDecay(config, mealsCount, currentHour, minsPassed);
  state.energyConsumed = (state.energyConsumed || 0) + drop;
  state.energy -= drop;

  // 低精力检测
  let lowEnergyTriggered = false;
  const threshold = config.lowEnergyThreshold ?? 20;
  if (state.energy < threshold && !state.lowEnergyReminded) {
    state.lowEnergyReminded = true;
    lowEnergyTriggered = true;
  }

  // 番茄钟过期检测
  let pomoExpired = false;
  let isForcedBreak = false;
  const pomoResult = checkPomodoroExpired(state.pomodoro, now);
  if (pomoResult.expired) {
    state.pomodoro.status = 'idle';
    state.pomodoro.startedAt = undefined;
    state.pomodoro.updatedAt = now;
    state.pomodoro.consecutiveCount = pomoResult.newConsecutiveCount;
    pomoExpired = true;
    isForcedBreak = pomoResult.isForcedBreak;
  }

  return { state, energyDrop: drop, lowEnergyTriggered, pomoExpired, isForcedBreak };
}
