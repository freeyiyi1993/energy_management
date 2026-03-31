import { type AppState, type Tasks, type StorageData, DEFAULT_TASK_DEFS, DEFAULT_CONFIG } from '../../shared/types';
import { getLogicalDate, getLogical8AM, buildEmptyTasks } from '../../shared/utils/time';
import { DEFAULT_POMODORO, migratePomodoro } from '../../shared/storage';
import { calculateDecay, calculateMaxEnergyDelta, checkPomodoroExpired } from '../../shared/logic';

async function initData() {
  const data = (await chrome.storage.local.get(null)) as StorageData;
  const todayStr = getLogicalDate();

  const config = data.config || DEFAULT_CONFIG;
  if (!data.config) {
    await chrome.storage.local.set({ config });
  }

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
  if (taskDefsChanged) {
    await chrome.storage.local.set({ taskDefs });
  }

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

    await chrome.storage.local.set({
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
    if (data.state.pomoCount === undefined) {
      await chrome.storage.local.set({ state: data.state });
    }
  }
  chrome.alarms.create("tick", { periodInMinutes: 1 });
}

async function handleDayRollover(data: StorageData, todayStr: string) {
  const { state, tasks, stats } = data as { state: AppState, tasks: Tasks, stats: any[] };
  const config = data.config || DEFAULT_CONFIG;
  const taskDefs = data.taskDefs || DEFAULT_TASK_DEFS;

  const pomoCount = state.pomoCount || 0;
  const perfectCount = state.pomoPerfectCount || 0;

  const enabledDefs = taskDefs.filter(d => d.enabled);
  const isNoInput = enabledDefs.every(def => {
    const v = tasks[def.id];
    if (def.type === 'counter') return (v as number || 0) === 0;
    if (def.type === 'boolean') return !v;
    return v === null || v === undefined;
  }) && pomoCount === 0;

  if (isNoInput) {
    state.logicalDate = todayStr;
    state.energy = state.maxEnergy;
    state.energyConsumed = 0;
    state.lastUpdateTime = Date.now();
    state.lowEnergyReminded = false;
    state.pomoCount = 0;
    state.pomoPerfectCount = 0;
    state.pomodoro.consecutiveCount = 0;

    await chrome.storage.local.set({ state, tasks: buildEmptyTasks(taskDefs) });
    return;
  }

  const maxEnergyDelta = calculateMaxEnergyDelta(tasks, taskDefs, pomoCount, perfectCount, config);

  const yesterdayDate = state.logicalDate;
  stats.push({
    date: yesterdayDate,
    maxEnergy: state.maxEnergy,
    energyConsumed: state.energyConsumed || 0,
    pomoCount,
    perfectCount
  });

  state.maxEnergy += maxEnergyDelta;

  state.logicalDate = todayStr;
  state.energy = state.maxEnergy;
  state.energyConsumed = 0;
  state.lastUpdateTime = Date.now();
  state.lowEnergyReminded = false;
  state.pomoCount = 0;
  state.pomoPerfectCount = 0;
  state.pomodoro.consecutiveCount = 0;

  await chrome.storage.local.set({ state, tasks: buildEmptyTasks(taskDefs), stats });
}

chrome.runtime.onInstalled.addListener(() => {
  initData();
});

// Google OAuth: 使用 chrome.identity.getAuthToken，
// Chrome 内部处理 OAuth 流程，无需 redirect URI
// 先清除缓存 token 再获取，避免拿到过期 token 导致需要点两次
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'GOOGLE_LOGIN') {
    // 先尝试获取（可能是缓存的），拿到后清除再重新获取一个新鲜 token
    chrome.identity.getAuthToken({ interactive: false })
      .then(result => {
        const cached = typeof result === 'string' ? result : result.token;
        if (cached) {
          return chrome.identity.removeCachedAuthToken({ token: cached });
        }
      })
      .catch(() => { /* 无缓存 token，忽略 */ })
      .then(() => chrome.identity.getAuthToken({ interactive: true }))
      .then(result => {
        const token = typeof result === 'string' ? result : result.token;
        if (!token) {
          sendResponse({ error: '未获取到 token' });
          return;
        }
        sendResponse({ accessToken: token });
      })
      .catch(err => {
        sendResponse({ error: err.message ?? String(err) });
      });
    return true;
  }
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "tick") {
    const data = (await chrome.storage.local.get(null)) as StorageData;
    if (!data.state) return;

    // 旧格式迁移
    migratePomodoro(data.state);

    const todayStr = getLogicalDate();
    if (data.state.logicalDate !== todayStr) {
      await handleDayRollover(data, todayStr);
      return;
    }

    const now = Date.now();
    const { state, tasks } = data as { state: AppState, tasks: Tasks };
    const config = data.config || DEFAULT_CONFIG;
    const minsPassed = (now - state.lastUpdateTime) / 60000;
    state.lastUpdateTime = now;

    const currentHour = new Date().getHours();
    const mealsCount = tasks['meals'] as number || 0;
    const drop = calculateDecay(config, mealsCount, currentHour, minsPassed);
    state.energyConsumed = (state.energyConsumed || 0) + drop;
    state.energy -= drop;

    if (state.energy < 20 && !state.lowEnergyReminded) {
      state.lowEnergyReminded = true;
      chrome.tabs.create({ url: chrome.runtime.getURL("extension/pages/finish/finish.html?type=energy") });
    }

    const pomoResult = checkPomodoroExpired(state.pomodoro, now);
    if (pomoResult.expired) {
      state.pomodoro.status = 'idle';
      state.pomodoro.startedAt = undefined;
      state.pomodoro.updatedAt = now;
      state.pomodoro.consecutiveCount = pomoResult.newConsecutiveCount;

      chrome.tabs.create({ url: chrome.runtime.getURL(`extension/pages/finish/finish.html?type=pomodoro&forcedBreak=${pomoResult.isForcedBreak}`) });
    }

    await chrome.storage.local.set({ state });
  }
});
