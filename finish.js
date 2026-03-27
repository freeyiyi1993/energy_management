const params = new URLSearchParams(window.location.search);
const type = params.get('type');
const content = document.getElementById('content');

if (type === 'energy') {
  content.innerHTML = `
    <h1 style="color:#ef4444">⚠️ 警告：精力告急！</h1>
    <p>当前精力值已低于 20，请立即停止工作，休息或补充能量！</p>
    <button id="closeBtn">我已知道，去休息</button>
  `;
  document.getElementById('closeBtn').addEventListener('click', () => window.close());
} else if (type === 'pomodoro') {
  content.innerHTML = `
    <h2>🍅 番茄钟完成！</h2>
    <p>请给刚刚的时段打个专注分 (0-100)：</p>
    <input type="number" id="score" min="0" max="100" value="100"><br>
    <button id="submitBtn">提交</button>
  `;
  document.getElementById('submitBtn').addEventListener('click', async () => {
    const score = parseInt(document.getElementById('score').value);
    const data = await chrome.storage.local.get(['state', 'logs']);

    data.state.pomodoro.count++;
    let logMsg = `完成番茄钟，专注度 ${score}%`;

    if (score === 100) {
      data.state.pomodoro.perfectCount++;
      data.state.energy = Math.min(data.state.maxEnergy, data.state.energy + 1);
      logMsg += ` (精力 +1)`;
    }

    // 写入日志
    data.logs.unshift({ time: new Date().toLocaleString(), text: logMsg });
    await chrome.storage.local.set({ state: data.state, logs: data.logs });
    window.close();
  });
}