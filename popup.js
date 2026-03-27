document.addEventListener('DOMContentLoaded', async () => {
  const data = await chrome.storage.local.get(null);
  render(data);

  setInterval(async () => {
    const freshData = await chrome.storage.local.get(null);
    render(freshData);
  }, 1000);

  // 番茄钟点击：播放/暂停切换
  document.getElementById('pomoBtn').addEventListener('click', async () => {
    const cur = await chrome.storage.local.get('state');
    cur.state.pomodoro.running = !cur.state.pomodoro.running;
    await chrome.storage.local.set({ state: cur.state });
    render(await chrome.storage.local.get(null));
  });

  // 刷新按钮：打断并重新开始
  document.getElementById('pomoRefresh').addEventListener('click', async (e) => {
    e.stopPropagation(); // 阻止冒泡触发父级的暂停/播放
    const d = await chrome.storage.local.get(['state', 'logs']);
    d.state.pomodoro.timeLeft = 25 * 60;
    d.state.pomodoro.running = true; // 直接重新开始
    d.logs.unshift({ time: new Date().toLocaleString(), text: `🔄 快速重置并重新开始了番茄钟` });
    await chrome.storage.local.set({ state: d.state, logs: d.logs });
    render(await chrome.storage.local.get(null));
  });

  // 打开统计页
  document.getElementById('btnStats').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("stats.html") });
  });

  const saveTask = async (key, val) => {
    const d = await chrome.storage.local.get(['tasks', 'state', 'logs']);
    if (d.tasks[key] !== null && d.tasks[key] !== false) return;

    d.tasks[key] = val;

    if (key === 'sleep' && val >= 8) {
      const bonusEnergy = d.state.maxEnergy * 0.2;
      d.state.energy = Math.min(d.state.maxEnergy, d.state.energy + bonusEnergy);
    } else if (key === 'breakfast' && val <= '08:00') {
      d.state.energy = Math.min(d.state.maxEnergy, d.state.energy + 5);
    } else if (key === 'lunch' && val <= '12:00') {
      d.state.energy = Math.min(d.state.maxEnergy, d.state.energy + 5);
    } else if (key === 'dinner' && val <= '18:00') {
      d.state.energy = Math.min(d.state.maxEnergy, d.state.energy + 5);
    }

    const taskNames = { sleep: '睡眠', exercise: '运动', breakfast: '早饭', lunch: '午饭', dinner: '晚饭', water1: '喝水1', water2: '喝水2', water3: '喝水3' };
    const logVal = (typeof val === 'boolean') ? '完成' : val;
    d.logs.unshift({ time: new Date().toLocaleString(), text: `✅ 打卡 [${taskNames[key]}] : ${logVal}` });

    await chrome.storage.local.set({ tasks: d.tasks, state: d.state, logs: d.logs });
    render(await chrome.storage.local.get(null));
  };

  // 绑定输入框
  document.getElementById('t-sleep').addEventListener('change', (e) => saveTask('sleep', parseFloat(e.target.value)));
  document.getElementById('t-exer').addEventListener('change', (e) => saveTask('exercise', parseFloat(e.target.value)));
  document.getElementById('t-bf').addEventListener('change', (e) => saveTask('breakfast', e.target.value));
  document.getElementById('t-lu').addEventListener('change', (e) => saveTask('lunch', e.target.value));
  document.getElementById('t-di').addEventListener('change', (e) => saveTask('dinner', e.target.value));

  // 绑定水滴按钮
  ['w1', 'w2', 'w3'].forEach(k => {
    document.getElementById('t-' + k).addEventListener('click', () => saveTask('water' + k.replace('w', ''), true));
  });
});

function render(data) {
  if(!data.state) return;
  const { state, tasks } = data;

  // 1. 精力条
  const energyPercent = Math.min(100, Math.max(0, (state.energy / state.maxEnergy) * 100));
  document.getElementById('energyFill').style.width = energyPercent + '%';
  document.getElementById('energyFill').style.background = state.energy < 20 ? '#ef4444' : '#3b82f6';
  // 文字显式拼接展示
  document.getElementById('energyText').innerText = `${state.energy.toFixed(1)} / ${state.maxEnergy}`;

  // 2. 番茄钟圆形进度、遮罩与时间
  const totalSeconds = 25 * 60;
  const currentSeconds = state.pomodoro.timeLeft;
  const pomoPercent = (currentSeconds / totalSeconds) * 100;
  const m = Math.floor(currentSeconds / 60).toString().padStart(2, '0');
  const s = Math.floor(currentSeconds % 60).toString().padStart(2, '0');

  const pomoBtn = document.getElementById('pomoBtn');
  document.getElementById('pomoTime').innerText = `${m}:${s}`;
  document.getElementById('pomoStats').innerText = `总: ${state.pomodoro.count} | 完美: ${state.pomodoro.perfectCount}`;

  // 注入进度百分比和颜色变量
  pomoBtn.style.setProperty('--p', `${pomoPercent}%`);
  pomoBtn.style.setProperty('--pomo-color', state.pomodoro.running ? '#10b981' : '#3b82f6');

  // 控制遮罩状态
  if (state.pomodoro.running) {
    pomoBtn.className = 'pomodoro-circle running';
    document.getElementById('pomoOverlay').innerText = '⏸'; // 运行时 hover 显示暂停
  } else {
    pomoBtn.className = 'pomodoro-circle paused';
    document.getElementById('pomoOverlay').innerText = '▶'; // 暂停时常驻显示播放
  }

  // 3. 任务数据回显及锁定
  const idMap = { sleep: 't-sleep', exercise: 't-exer', breakfast: 't-bf', lunch: 't-lu', dinner: 't-di' };
  for (const [k, v] of Object.entries(tasks)) {
    if (v !== null && v !== false) {
      if (idMap[k]) {
        document.getElementById(idMap[k]).value = v;
        document.getElementById(idMap[k]).disabled = true;
      } else if (k.startsWith('water')) {
        // 处理喝水按钮
        const wBtn = document.getElementById('t-w' + k.replace('water', ''));
        wBtn.classList.add('done');
        wBtn.innerText = '✅ 已完成';
      }
    }
  }
}