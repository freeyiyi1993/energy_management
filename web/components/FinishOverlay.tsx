import { useState } from 'react';
import { storage } from '../storage';
import { submitPomoScore } from '../../shared/utils/pomoSubmit';

interface Props {
  type: 'pomodoro' | 'energy';
  forcedBreak?: boolean;
  onClose: () => void;
}

export default function FinishOverlay({ type, forcedBreak = false, onClose }: Props) {
  const [score, setScore] = useState(100);

  const handleEnergyDismiss = async () => {
    const data = await storage.get(['state']);
    if (data.state) {
      data.state.lowEnergyReminded = true;
      await storage.set({ state: data.state });
    }
    onClose();
  };

  const handlePomoSubmit = async () => {
    await submitPomoScore(storage, score);
    onClose();
  };

  if (type === 'energy') {
    return (
      <div className="fixed inset-0 z-50 bg-red-50/95 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center border-t-4 border-red-500">
          <h2 className="text-2xl font-bold text-red-600 mb-4">⚠️ 精力严重不足！</h2>
          <p className="text-gray-600 mb-6 leading-relaxed">
            身体已经超负荷运转，请立即休息。去补充水分、吃点东西或者闭目养神。
          </p>
          <button
            className="bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-8 rounded-full transition-colors"
            onClick={handleEnergyDismiss}
          >
            关闭
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${forcedBreak ? 'bg-red-50/95' : 'bg-emerald-50/95'}`}>
      <div className={`bg-white p-8 rounded-2xl shadow-2xl max-w-lg w-full text-center border-t-8 ${forcedBreak ? 'border-red-500' : 'border-emerald-500'}`}>
        <h2 className={`text-2xl font-bold mb-2 ${forcedBreak ? 'text-red-600' : 'text-emerald-600'}`}>
          {forcedBreak ? '🧠 大脑需要充电！' : '🍅 番茄时间结束！'}
        </h2>
        <p className="text-gray-600 mb-6 text-sm leading-relaxed">
          {forcedBreak
            ? '你已经连续专注了 90-120 分钟，建议休息 15-30 分钟。'
            : '这次专注的质量如何？'}
        </p>

        <div className="mb-6 text-left">
          <label className="block text-gray-700 font-bold mb-2 text-sm">专注度自评: {score}%</label>
          <input
            type="range"
            min="0"
            max="100"
            step="10"
            value={score}
            onChange={(e) => setScore(parseInt(e.target.value))}
            className="w-full h-2 bg-emerald-200 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>完全摸鱼</span>
            <span>状态一般</span>
            <span>完美专注</span>
          </div>

          <div className={`mt-6 p-4 rounded-xl text-sm font-medium border flex items-center justify-center gap-2 ${forcedBreak ? 'bg-indigo-50 text-indigo-800 border-indigo-100' : 'bg-emerald-50 text-emerald-800 border-emerald-100'}`}>
            <span>💡</span>
            {forcedBreak ? '战略性恢复：离开座位活动 10 分钟' : '休息提示：请起立喝水/远眺'}
          </div>
        </div>

        <button
          className={`w-full text-white font-bold py-3 px-6 rounded-xl transition-colors ${forcedBreak ? 'bg-red-500 hover:bg-red-600' : 'bg-emerald-500 hover:bg-emerald-600'}`}
          onClick={handlePomoSubmit}
        >
          记录并继续
        </button>
      </div>
    </div>
  );
}
