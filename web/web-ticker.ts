import { storage } from './storage';
import { type AppState, type Tasks, type StorageData, DEFAULT_TASK_DEFS, DEFAULT_CONFIG } from '../shared/types';
import { getLogicalDate, getLogical8AM, buildEmptyTasks } from '../shared/utils/time';
import { DEFAULT_POMODORO, migratePomodoro } from '../shared/storage';
import { calculateDecay, calculateMaxEnergyDelta, checkPomodoroExpired } from '../shared/logic';

export async function initWebData() {
  const data = await storage.get(null) as StorageData;
  const todayStr = getLogicalDate();

  const config = data.config || DEFAULT_CONFIG;
  if (!data.config) await storage.set({ config });

  let taskDefs = data.taskDefs || DEFAULT_TASK_DEFS;
  // 内置任务属性迁移：healLevel/maxCount 等跟随 DEFAULT_TASK_DEFS 更新
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
  if (taskDefsChanged) await storage.set({ taskDefs });

  if (!data.state) {
    const now = Date.now();
    const startOfToday = getLogical8AM();
    const minsPassedSince8AM = Math.max(0, (now - startOfToday) / 60000);

    let initialEnergy = config.maxEnergy;
    let decayRate = config.decayRate / 60;
    const currentHour = new Date().getHours();

    if (currentHour >= 9 || currentHour >= 13 || currentHour >= 19) {
      decayRate *= config.penaltyMultiplier;
    }

    initialEnergy -= decayRate * minsPassedSince8AM;

    await storage.set({
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
      logs: []
    });
  } else {
    // 旧格式迁移
    migratePomodoro(data.state);
    if (!('status' in data.state.pomodoro)) {
      // migratePomodoro 已修改 data.state，写回
    }
    if (data.state.pomoCount === undefined) {
      await storage.set({ state: data.state });
    }
  }
}

async function tick() {
  const data = await storage.get(null) as StorageData;
  if (!data.state) return;

  // 旧格式迁移
  migratePomodoro(data.state);

  const todayStr = getLogicalDate();
  const taskDefs = data.taskDefs || DEFAULT_TASK_DEFS;

  // Day rollover
  if (data.state.logicalDate !== todayStr) {
    const { state, tasks, stats } = data as { state: AppState, tasks: Tasks, stats: any[] };
    const config = data.config || DEFAULT_CONFIG;

    const enabledDefs = taskDefs.filter(d => d.enabled);
    const isNoInput = enabledDefs.every(def => {
      const v = tasks[def.id];
      if (def.type === 'counter') return (v as number || 0) === 0;
      if (def.type === 'boolean') return !v;
      return v === null || v === undefined;
    }) && (state.pomoCount || 0) === 0;

    if (!isNoInput) {
      const maxEnergyDelta = calculateMaxEnergyDelta(tasks, taskDefs, state.pomoCount || 0, state.pomoPerfectCount || 0, config);

      (stats || []).push({
        date: state.logicalDate,
        maxEnergy: state.maxEnergy,
        energyConsumed: state.energyConsumed || 0,
        pomoCount: state.pomoCount || 0,
        perfectCount: state.pomoPerfectCount || 0
      });

      state.maxEnergy += maxEnergyDelta;
    }

    data.state.logicalDate = todayStr;
    data.state.energy = data.state.maxEnergy;
    data.state.energyConsumed = 0;
    data.state.lastUpdateTime = Date.now();
    data.state.lowEnergyReminded = false;
    data.state.pomoCount = 0;
    data.state.pomoPerfectCount = 0;
    data.state.pomodoro.consecutiveCount = 0;

    await storage.set({ state: data.state, tasks: buildEmptyTasks(taskDefs), stats: data.stats });
    return;
  }

  // Normal tick: decay + pomodoro
  const now = Date.now();
  const state = data.state;
  const config = data.config || DEFAULT_CONFIG;
  const tasks = data.tasks || {};
  const minsPassed = (now - state.lastUpdateTime) / 60000;
  state.lastUpdateTime = now;

  const currentHour = new Date().getHours();
  const mealsCount = tasks['meals'] as number || 0;
  const drop = calculateDecay(config, mealsCount, currentHour, minsPassed);
  state.energyConsumed = (state.energyConsumed || 0) + drop;
  state.energy -= drop;

  const pomoResult = checkPomodoroExpired(state.pomodoro, now);
  if (pomoResult.expired) {
    state.pomodoro.status = 'idle';
    state.pomodoro.startedAt = undefined;
    state.pomodoro.updatedAt = now;
    state.pomodoro.consecutiveCount = pomoResult.newConsecutiveCount;
    if (pomodoroCompleteCallback) pomodoroCompleteCallback(pomoResult.isForcedBreak);
  }

  // 低精力提醒检测
  if (state.energy < 20 && !state.lowEnergyReminded) {
    state.lowEnergyReminded = true;
    if (lowEnergyCallback) lowEnergyCallback();
  }

  await storage.set({ state });
}

let tickInterval: ReturnType<typeof setInterval> | null = null;
let lowEnergyCallback: (() => void) | null = null;
let pomodoroCompleteCallback: ((forcedBreak: boolean) => void) | null = null;

export function setLowEnergyCallback(cb: (() => void) | null) {
  lowEnergyCallback = cb;
}

export function setPomodoroCompleteCallback(cb: ((forcedBreak: boolean) => void) | null) {
  pomodoroCompleteCallback = cb;
}

export function startWebTicker() {
  if (tickInterval) return;
  tick(); // 立即执行一次，确保日切等逻辑不延迟
  tickInterval = setInterval(tick, 60_000); // 每分钟
}

export function stopWebTicker() {
  if (tickInterval) {
    clearInterval(tickInterval);
    tickInterval = null;
  }
}
