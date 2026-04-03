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

  // Normal tick — 用 delta 合并避免覆盖并发 UI 写入
  const now = Date.now();
  const result = processTick(data, now);

  if (result.pomoExpired && pomodoroCompleteCallback) {
    pomodoroCompleteCallback(result.isForcedBreak);
  }

  if (result.lowEnergyTriggered && lowEnergyCallback) {
    lowEnergyCallback();
  }

  // 重新读取最新 state，仅合并 tick 拥有的字段
  const fresh = await storage.get(['state']);
  if (!fresh.state) return;
  fresh.state.energy -= result.energyDrop;
  fresh.state.energyConsumed = (fresh.state.energyConsumed || 0) + result.energyDrop;
  fresh.state.lastUpdateTime = now;
  if (result.lowEnergyTriggered) fresh.state.lowEnergyReminded = true;
  if (result.pomoExpired) fresh.state.pomodoro = result.state.pomodoro;

  await storageSet({ state: fresh.state });
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
