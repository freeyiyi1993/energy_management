const DEFAULT_MAX_ENERGY = 63;

// 获取逻辑日期（早上 8 点前算作昨天），完全跟随本地系统时区
function getLogicalDate() {
  const now = new Date(); // 默认就是本地时间

  if (now.getHours() < 8) {
    now.setDate(now.getDate() - 1);
  }

  // 使用本地时间的 get 方法手动拼接，避开 toISOString 的 0 时区坑
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

// 获取今天（或逻辑上属于今天）早上 8 点的时间戳
function getLogical8AM() {
  const now = new Date();
  const d = new Date(now);
  if (now.getHours() < 8) {
    d.setDate(d.getDate() - 1);
  }
  d.setHours(8, 0, 0, 0);
  return d.getTime();
}

// 初始化或升级数据
async function initData() {
  const data = await chrome.storage.local.get(null);
  const todayStr = getLogicalDate();

  if (!data.state) {
    const now = Date.now();
    const startOfToday = getLogical8AM();
    // 计算今天早上 8 点到现在过去了多少分钟
    const minsPassedSince8AM = Math.max(0, (now - startOfToday) / 60000);

    // 初始设定 80%
    let initialEnergy = DEFAULT_MAX_ENERGY * 0.8;

    // 追溯扣除今天已经流失的精力 (基础 4点/小时)
    let decayRate = 4 / 60;
    const currentHour = new Date().getHours();

    // 追溯惩罚：如果当前已经过了饭点且没打卡，应用 1.5 倍惩罚
    if (currentHour >= 9 || currentHour >= 13 || currentHour >= 19) {
      decayRate *= 1.5;
    }

    initialEnergy -= decayRate * minsPassedSince8AM;
    if (initialEnergy < 5) initialEnergy = 5; // 最低跌至 5

    // 首次安装初始化
    await chrome.storage.local.set({
      state: {
        logicalDate: todayStr,
        maxEnergy: DEFAULT_MAX_ENERGY,
        energy: initialEnergy,
        lastUpdateTime: now, // 从现在开始正常按分钟 tick
        lowEnergyReminded: false,
        pomodoro: { running: false, timeLeft: 25 * 60, count: 0, perfectCount: 0 }
      },
      tasks: { sleep: null, breakfast: null, lunch: null, dinner: null, exercise: null, water1: false, water2: false, water3: false },
      stats: [],
      logs: []
    });
  }
  // 启动一分钟一次的心跳
  chrome.alarms.create("tick", { periodInMinutes: 1 });
}

// 跨天结算逻辑
async function handleDayRollover(data, todayStr) {
  let { state, tasks, stats } = data;
  let maxEnergyDelta = 0;

  // 1. 判断昨日每日任务是否全完成
  const tasksCompleted = tasks.sleep >= 8 && tasks.breakfast <= '08:00' && tasks.lunch <= '12:00' && tasks.dinner <= '18:00' && tasks.exercise >= 30 && tasks.water1 && tasks.water2 && tasks.water3;
  maxEnergyDelta += tasksCompleted ? 1 : -1;

  // 2. 判断昨日番茄钟
  maxEnergyDelta += state.pomodoro.perfectCount >= 4 ? Math.floor(state.pomodoro.perfectCount / 4) : -1;

  // 3. 记录昨日统计
  stats.push({
    date: state.logicalDate,
    maxEnergy: state.maxEnergy,
    pomodoroCount: state.pomodoro.count,
    perfectPomodoro: state.pomodoro.perfectCount,
    energyConsumed: state.energyConsumed || 0
  });

  // 4. 重置今日数据
  state.energyConsumed = 0;
  state.maxEnergy = Math.max(10, state.maxEnergy + maxEnergyDelta); // 设定个底线
  state.energy = state.maxEnergy * 0.8; // 默认 80%，等录入睡眠后更新
  state.logicalDate = todayStr;
  state.lowEnergyReminded = false;
  state.pomodoro.count = 0;
  state.pomodoro.perfectCount = 0;

  tasks = { sleep: null, breakfast: null, lunch: null, dinner: null, exercise: null, water1: false, water2: false, water3: false };

  await chrome.storage.local.set({ state, tasks, stats });
}

// 核心 Tick 逻辑
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== "tick") return;

  const data = await chrome.storage.local.get(null);
  if (!data.state) return;

  const now = Date.now();
  const currentLogicalDate = getLogicalDate();

  // 处理 8 点跨天
  if (data.state.logicalDate !== currentLogicalDate) {
    await handleDayRollover(data, currentLogicalDate);
    return;
  }

  let { state, tasks } = data;
  const minsPassed = (now - state.lastUpdateTime) / 60000;
  state.lastUpdateTime = now;

  // 1. 计算精力扣减 (基础 4点/小时 -> 4/60 点/分钟)
  let decayRate = 4 / 60;
  const currentHour = new Date().getHours();

  // 惩罚逻辑：只要有任何一顿饭过了点还没吃，速率就变成 1.5 倍
  const missedBreakfast = currentHour >= 9 && !tasks.breakfast;
  const missedLunch = currentHour >= 13 && !tasks.lunch;
  const missedDinner = currentHour >= 19 && !tasks.dinner;

  if (missedBreakfast || missedLunch || missedDinner) {
    decayRate *= 1.5;
  }

  // 核心修改：记录当天消耗的总精力（兼容之前没有这个字段的老数据）
  const drop = decayRate * minsPassed;
  state.energyConsumed = (state.energyConsumed || 0) + drop;

  state.energy -= decayRate * minsPassed;
  if (state.energy < 5) state.energy = 5; // 边缘处理：最低为 5

  // 2. 精力过低提醒
  if (state.energy < 20 && !state.lowEnergyReminded) {
    state.lowEnergyReminded = true;
    chrome.tabs.create({ url: chrome.runtime.getURL("finish.html?type=energy") });
  }

  // 3. 番茄钟处理
  if (state.pomodoro.running) {
    state.pomodoro.timeLeft -= 60 * minsPassed;
    if (state.pomodoro.timeLeft <= 0) {
      state.pomodoro.running = false;
      state.pomodoro.timeLeft = 25 * 60;
      chrome.tabs.create({ url: chrome.runtime.getURL("finish.html?type=pomodoro") });
    }
  }

  await chrome.storage.local.set({ state });
});

// 监听安装
chrome.runtime.onInstalled.addListener(initData);
// 启动时由于 Service Worker 会休眠，确保唤醒时数据一致
initData();