import { storage } from './storage';
import { type StorageData } from '../shared/types';
import { getLogicalDate } from '../shared/utils/time';
import { migratePomodoro } from '../shared/storage';
import { initAppData, handleDayRollover, processTick } from '../shared/ticker';

const storageSet = (data: Partial<StorageData>) => storage.set(data);

export async function initWebData() {
  const data = await storage.get(null);
  await initAppData(data, storageSet);
}

async function tick() {
  const data = await storage.get(null);
  if (!data.state) return;

  // 旧格式迁移
  migratePomodoro(data.state);

  const todayStr = getLogicalDate();

  // Day rollover
  if (data.state.logicalDate !== todayStr) {
    const { toWrite } = handleDayRollover(data, todayStr);
    await storageSet(toWrite);
    return;
  }

  // Normal tick
  const now = Date.now();
  const result = processTick(data, now);

  if (result.pomoExpired && pomodoroCompleteCallback) {
    pomodoroCompleteCallback(result.isForcedBreak);
  }

  if (result.lowEnergyTriggered && lowEnergyCallback) {
    lowEnergyCallback();
  }

  await storageSet({ state: result.state });
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
