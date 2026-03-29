import { storage } from './storage';
import { type Config, type AppState, type Tasks, type StorageData, type CustomTaskDef, DEFAULT_TASK_DEFS } from '../shared/types';

const DEFAULT_CONFIG: Config = {
  maxEnergy: 65,
  minEnergy: 5,
  smallHeal: 2,
  midHeal: 5,
  bigHealRatio: 0.2,
  decayRate: 4,
  penaltyMultiplier: 1.5,
  perfectDayBonus: 1,
  badDayPenalty: 1
};

function getLogicalDate() {
  const now = new Date();
  if (now.getHours() < 8) now.setDate(now.getDate() - 1);
  return now.toLocaleDateString('en-CA', { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
}

function getLogical8AM() {
  const now = new Date();
  if (now.getHours() < 8) now.setDate(now.getDate() - 1);
  now.setHours(8, 0, 0, 0);
  return now.getTime();
}

function buildEmptyTasks(taskDefs: CustomTaskDef[]): Tasks {
  const tasks: Tasks = {};
  for (const def of taskDefs) {
    if (!def.enabled) continue;
    if (def.type === 'counter') tasks[def.id] = 0;
    else if (def.type === 'boolean') tasks[def.id] = false;
    else tasks[def.id] = null;
  }
  return tasks;
}

export async function initWebData() {
  const data = await storage.get(null) as StorageData;
  const todayStr = getLogicalDate();

  const config = data.config || DEFAULT_CONFIG;
  if (!data.config) await storage.set({ config });

  const taskDefs = data.taskDefs || DEFAULT_TASK_DEFS;
  if (!data.taskDefs) await storage.set({ taskDefs });

  if (!data.state) {
    const now = Date.now();
    const startOfToday = getLogical8AM();
    const minsPassedSince8AM = Math.max(0, (now - startOfToday) / 60000);

    let initialEnergy = config.maxEnergy * 0.8;
    let decayRate = config.decayRate / 60;
    const currentHour = new Date().getHours();

    if (currentHour >= 9 || currentHour >= 13 || currentHour >= 19) {
      decayRate *= config.penaltyMultiplier;
    }

    initialEnergy -= decayRate * minsPassedSince8AM;
    if (initialEnergy < config.minEnergy) initialEnergy = config.minEnergy;

    await storage.set({
      state: {
        logicalDate: todayStr,
        maxEnergy: config.maxEnergy,
        energy: initialEnergy,
        lastUpdateTime: now,
        lowEnergyReminded: false,
        energyConsumed: 0,
        pomodoro: { running: false, timeLeft: 25 * 60, count: 0, perfectCount: 0, consecutiveCount: 0 }
      },
      tasks: buildEmptyTasks(taskDefs),
      stats: [],
      logs: []
    });
  }
}

async function tick() {
  const data = await storage.get(null) as StorageData;
  if (!data.state) return;

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
    }) && state.pomodoro.count === 0;

    if (!isNoInput) {
      const sleepVal = tasks['sleep'] as number | null;
      const exerciseVal = tasks['exercise'] as number | null;
      const perfectCount = state.pomodoro.perfectCount;
      let maxEnergyDelta = 0;

      const mealsVal = tasks['meals'] as number || 0;
      const waterVal = tasks['water'] as number || 0;
      const stretchVal = tasks['stretch'] as number || 0;
      const poopVal = tasks['poop'] as boolean || false;
      const isHealthy = sleepVal && sleepVal >= 8 && mealsVal >= 3 && exerciseVal && exerciseVal >= 30 && waterVal >= 3 && stretchVal >= 3 && poopVal;

      if (isHealthy && perfectCount >= 4) maxEnergyDelta += config.perfectDayBonus;
      if (perfectCount === 0 && (!exerciseVal || exerciseVal < 30) && (!sleepVal || sleepVal < 6)) maxEnergyDelta -= config.badDayPenalty;

      (stats || []).push({
        date: state.logicalDate,
        maxEnergy: state.maxEnergy,
        energyConsumed: state.energyConsumed || 0,
        pomoCount: state.pomodoro.count,
        perfectCount
      });

      state.maxEnergy += maxEnergyDelta;
      if (state.maxEnergy < config.minEnergy) state.maxEnergy = config.minEnergy;
    }

    data.state.logicalDate = todayStr;
    data.state.energy = data.state.maxEnergy * 0.8;
    data.state.energyConsumed = 0;
    data.state.lastUpdateTime = Date.now();
    data.state.lowEnergyReminded = false;
    data.state.pomodoro.count = 0;
    data.state.pomodoro.perfectCount = 0;
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

  let decayRate = config.decayRate / 60;
  const currentHour = new Date().getHours();
  const mealsCount = tasks['meals'] as number || 0;
  if (currentHour >= 19 && mealsCount < 2) decayRate *= config.penaltyMultiplier;

  const drop = decayRate * minsPassed;
  state.energyConsumed = (state.energyConsumed || 0) + drop;
  state.energy -= drop;
  if (state.energy < config.minEnergy) state.energy = config.minEnergy;

  if (state.pomodoro.running) {
    state.pomodoro.timeLeft -= 60 * minsPassed;
    if (state.pomodoro.timeLeft <= 0) {
      state.pomodoro.running = false;
      state.pomodoro.timeLeft = 25 * 60;
      state.pomodoro.consecutiveCount = (state.pomodoro.consecutiveCount || 0) + 1;
      if (state.pomodoro.consecutiveCount >= 3) {
        state.pomodoro.consecutiveCount = 0;
      }
      // Web 版不弹新标签，由 UI 层处理通知
    }
  }

  await storage.set({ state });
}

let tickInterval: ReturnType<typeof setInterval> | null = null;

export function startWebTicker() {
  if (tickInterval) return;
  tickInterval = setInterval(tick, 60_000); // 每分钟
}

export function stopWebTicker() {
  if (tickInterval) {
    clearInterval(tickInterval);
    tickInterval = null;
  }
}
