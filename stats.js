document.addEventListener('DOMContentLoaded', async () => {
  // 把 state 也取出来
  const data = await chrome.storage.local.get(['stats', 'logs', 'state']);

  // 1. 渲染图表 (展示近 6 天历史 + 1 天实时)
  const recentStats = data.stats.slice(-6);

  // 强行追加今日的实时数据到图表末尾
  if (data.state) {
    recentStats.push({
      date: data.state.logicalDate + ' (今日)',
      maxEnergy: data.state.maxEnergy,
      perfectPomodoro: data.state.pomodoro.perfectCount,
      energyConsumed: data.state.energyConsumed || 0,
      pomodoroCount: data.state.pomodoro.count
    });
  }

  const labels = recentStats.map(s => s.date);
  const maxEnergyData = recentStats.map(s => s.maxEnergy);
  const perfectPomoData = recentStats.map(s => s.perfectPomodoro);
  const consumedData = recentStats.map(s => s.energyConsumed || 0);
  const totalPomoData = recentStats.map(s => s.pomodoroCount || 0);

  const ctx = document.getElementById('myChart').getContext('2d');
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        { label: '精力上限', data: maxEnergyData, borderColor: '#3b82f6', tension: 0.1 },
        { label: '完美番茄数', data: perfectPomoData, borderColor: '#10b981', tension: 0.1 },
        { label: '精力消耗值', data: consumedData, borderColor: '#f59e0b', tension: 0.1 },
        { label: '番茄总数', data: totalPomoData, borderColor: '#8b5cf6', tension: 0.1 }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'top', onClick: Chart.defaults.plugins.legend.onClick } // 支持点击图例切换
      }
    }
  });

  // 2. 渲染日志 (简易无限滚动逻辑)
  const logContainer = document.getElementById('logContainer');
  let currentLogIndex = 0;
  const logsPerPage = 20;

  function loadMoreLogs() {
    const end = Math.min(currentLogIndex + logsPerPage, data.logs.length);
    for (let i = currentLogIndex; i < end; i++) {
      const log = data.logs[i];
      const div = document.createElement('div');
      div.className = 'log-item';
      div.innerHTML = `<span>${log.text}</span><span class="log-time">${log.time}</span>`;
      logContainer.appendChild(div);
    }
    currentLogIndex = end;
  }

  loadMoreLogs(); // 初次加载

  logContainer.addEventListener('scroll', () => {
    // 滚动到底部触发加载
    if (logContainer.scrollTop + logContainer.clientHeight >= logContainer.scrollHeight - 10) {
      loadMoreLogs();
    }
  });
});