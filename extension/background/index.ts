import { type StorageData, type AppState } from '../../shared/types';
import { initAppData } from '../../shared/ticker';
import { handleTick } from './tickHandler';

const storageSet = (data: Partial<StorageData>) =>
  chrome.storage.local.set(data);

/** 更新浏览器 badge：番茄进行中显示倒计时，否则显示精力值 */
function updateBadge(state: AppState | undefined) {
  if (!state) return;
  const pomo = state.pomodoro;
  if (pomo.status === 'ongoing' && pomo.startedAt) {
    const secsLeft = Math.max(0, 25 * 60 - (Date.now() - pomo.startedAt) / 1000);
    const minsLeft = Math.ceil(secsLeft / 60);
    chrome.action.setBadgeText({ text: `${minsLeft}m` });
    chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
  } else {
    chrome.action.setBadgeText({ text: `${Math.floor(state.energy)}` });
    const threshold = 20; // 简化：badge 用固定阈值
    chrome.action.setBadgeBackgroundColor({ color: state.energy < threshold ? '#ef4444' : '#6b7280' });
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  const data = (await chrome.storage.local.get(null)) as StorageData;
  await initAppData(data, storageSet);
  chrome.alarms.create("tick", { periodInMinutes: 1 });
  // 初始化 badge
  const fresh = (await chrome.storage.local.get('state')) as { state?: AppState };
  updateBadge(fresh.state);
});

// Google OAuth: 使用 chrome.identity.getAuthToken，
// Chrome 内部处理 OAuth 流程，无需 redirect URI
// 不预清理缓存：若 popup 因授权窗口失焦而关闭，缓存 token 可在第二次点击时直接复用
// 过期 token 由 SyncPanel 的 signInWithCredential 重试逻辑处理
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'GOOGLE_LOGIN') {
    chrome.identity.getAuthToken({ interactive: true })
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

// storage 变化时更新 badge（打卡/番茄切换等 UI 操作）
chrome.storage.local.onChanged.addListener((changes) => {
  if (changes.state?.newValue) {
    updateBadge(changes.state.newValue as AppState);
  }
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "tick") {
    const data = (await chrome.storage.local.get(null)) as StorageData;
    const finishUrl = chrome.runtime.getURL("extension/pages/finish/finish.html");
    const now = Date.now();
    const action = handleTick(data, now, finishUrl);

    if (action.type === 'tick' && action.tickResult) {
      // delta 合并：重新读取最新 state，仅应用 tick 拥有的字段，避免覆盖并发 UI 写入
      const fresh = (await chrome.storage.local.get('state')) as { state?: typeof data.state };
      if (fresh.state) {
        const r = action.tickResult;
        fresh.state.energy -= r.energyDrop;
        fresh.state.energyConsumed = (fresh.state.energyConsumed || 0) + r.energyDrop;
        fresh.state.lastUpdateTime = now;
        if (r.lowEnergyTriggered) fresh.state.lowEnergyReminded = true;
        if (r.pomoExpired) fresh.state.pomodoro = r.state.pomodoro;
        await storageSet({ state: fresh.state });
      }
    } else if (Object.keys(action.toWrite).length > 0) {
      // 日切等整体写入
      await storageSet(action.toWrite);
    }

    // 必须 await tabs.create，否则 MV3 Service Worker 可能在 tab 创建前终止
    for (const url of action.openTabs) {
      await chrome.tabs.create({ url });
    }

    // 更新 badge
    const latest = (await chrome.storage.local.get('state')) as { state?: AppState };
    updateBadge(latest.state);
  }
});
