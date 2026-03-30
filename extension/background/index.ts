import { type AppState, type Tasks, type StorageData, DEFAULT_TASK_DEFS, DEFAULT_CONFIG } from '../../shared/types';
import { getLogicalDate, getLogical8AM, buildEmptyTasks } from '../../shared/utils/time';

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
        pomodoro: { running: false, timeLeft: 25 * 60, count: 0, perfectCount: 0, consecutiveCount: 0 }
      },
      tasks: buildEmptyTasks(taskDefs),
      stats: [],
      logs: []
    });
  }
  chrome.alarms.create("tick", { periodInMinutes: 1 });
}

async function handleDayRollover(data: StorageData, todayStr: string) {
  const { state, tasks, stats } = data as { state: AppState, tasks: Tasks, stats: any[] };
  const config = data.config || DEFAULT_CONFIG;
  const taskDefs = data.taskDefs || DEFAULT_TASK_DEFS;
  let maxEnergyDelta = 0;

  const sleepVal = tasks['sleep'] as number | null;
  const exerciseVal = tasks['exercise'] as number | null;

  // 动态判断完美一天：基于 countsForPerfectDay 字段
  const perfectDayDefs = taskDefs.filter(d => d.enabled && d.countsForPerfectDay);
  const isHealthyTasksDone = perfectDayDefs.every(def => {
    const v = tasks[def.id];
    if (def.type === 'counter') return (v as number || 0) >= (def.maxCount || 3);
    if (def.type === 'boolean') return !!v;
    return v !== null && v !== undefined;
  });

  const pomoCount = state.pomodoro.count;
  const perfectCount = state.pomodoro.perfectCount;

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
    state.pomodoro.count = 0;
    state.pomodoro.perfectCount = 0;
    state.pomodoro.consecutiveCount = 0;

    await chrome.storage.local.set({ state, tasks: buildEmptyTasks(taskDefs) });
    return;
  }

  if (isHealthyTasksDone && perfectCount >= 4) {
    maxEnergyDelta += config.perfectDayBonus;
  }

  if (perfectCount === 0 && (!exerciseVal || exerciseVal < 30) && (!sleepVal || sleepVal < 6)) {
    maxEnergyDelta -= config.badDayPenalty;
  }

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
  state.pomodoro.count = 0;
  state.pomodoro.perfectCount = 0;
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

    let decayRate = config.decayRate / 60;
    const currentHour = new Date().getHours();

    const mealsCount = tasks['meals'] as number || 0;
    const missedMeals =
      (currentHour >= 10 && mealsCount < 1) ||
      (currentHour >= 14 && mealsCount < 2) ||
      (currentHour >= 19 && mealsCount < 3);

    if (missedMeals) {
      decayRate *= config.penaltyMultiplier;
    }

    const drop = decayRate * minsPassed;
    state.energyConsumed = (state.energyConsumed || 0) + drop;
    state.energy -= drop;

    if (state.energy < 20 && !state.lowEnergyReminded) {
      state.lowEnergyReminded = true;
      chrome.tabs.create({ url: chrome.runtime.getURL("extension/pages/finish/finish.html?type=energy") });
    }

    if (state.pomodoro.running) {
      const elapsed = state.pomodoro.startedAt
        ? (now - state.pomodoro.startedAt) / 1000
        : 60 * minsPassed;
      state.pomodoro.timeLeft = Math.max(0, state.pomodoro.startedAt
        ? 25 * 60 - elapsed
        : state.pomodoro.timeLeft - 60 * minsPassed);

      if (state.pomodoro.timeLeft <= 0) {
        state.pomodoro.running = false;
        state.pomodoro.timeLeft = 25 * 60;
        state.pomodoro.startedAt = undefined;

        state.pomodoro.consecutiveCount = (state.pomodoro.consecutiveCount || 0) + 1;
        const isForcedBreak = state.pomodoro.consecutiveCount >= 3;

        chrome.tabs.create({ url: chrome.runtime.getURL(`extension/pages/finish/finish.html?type=pomodoro&forcedBreak=${isForcedBreak}`) });

        if (isForcedBreak) {
          state.pomodoro.consecutiveCount = 0;
        }
      }
    }

    await chrome.storage.local.set({ state });
  }
});
