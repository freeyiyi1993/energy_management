import { useState, useEffect } from 'react';
import { storage } from '../../storage';
import { submitPomoScore } from '../../../shared/utils/pomoSubmit';

export default function FinishApp() {
  const [type, setType] = useState<string | null>(null);
  const [forcedBreak, setForcedBreak] = useState<boolean>(false);
  const [score, setScore] = useState(100);

  useEffect(() => {
    setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      setType(params.get('type'));
      setForcedBreak(params.get('forcedBreak') === 'true');
    }, 0);
  }, []);

  const handleRest = () => {
    window.close();
  };

  const handlePomoSubmit = async () => {
    await submitPomoScore(storage, score);
    window.close();
  };

  if (type === 'energy') {
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center font-sans">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center border-t-4 border-red-500">
          <h2 className="text-2xl font-bold text-red-600 mb-4">⚠️ 能量枯竭警告</h2>
          <p className="text-gray-600 mb-6 leading-relaxed">你的身体精力已经严重透支，这会极大地降低你的工作效率并损害健康。请立即停止工作，去补充水分、吃点东西或者闭目养神。</p>
          <button
            className="bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-8 rounded-full transition-colors"
            onClick={handleRest}
          >
            我已休息完毕，关闭页面
          </button>
        </div>
      </div>
    );
  }

  if (type === 'pomodoro') {
    return (
      <div className={`min-h-screen flex items-center justify-center font-sans ${forcedBreak ? 'bg-red-50' : 'bg-emerald-50'}`}>
        <div className={`bg-white p-12 rounded-2xl shadow-2xl max-w-2xl w-[90%] text-center border-t-8 ${forcedBreak ? 'border-red-500' : 'border-emerald-500'}`}>
          <h2 className={`text-2xl font-bold mb-2 ${forcedBreak ? 'text-red-600' : 'text-emerald-600'}`}>
            {forcedBreak ? '☕️ 大脑需要充电了' : '🍅 专注时段完成！'}
          </h2>
          <p className="text-gray-600 mb-8 text-base leading-relaxed">
            {forcedBreak
              ? '《精力管理》指出：每高强度专注 90-120 分钟，大脑的化学物质就会耗尽。一小时精神涣散的加班，产出远远比不上 20 分钟心流状态的极速冲刺。请立刻离开屏幕，进行 10-15 分钟的彻底放松吧！'
              : '太棒了！你刚刚完成了一段专注时光。给自己打个分吧。'}
          </p>

          <div className="mb-8 text-left">
            <label className="block text-gray-700 font-bold mb-3">专注度自评: {score}%</label>
            <input
              type="range"
              min="0"
              max="100"
              step="10"
              value={score}
              onChange={(e) => setScore(parseInt(e.target.value))}
              className="w-full h-2 bg-emerald-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-2">
              <span>完全摸鱼</span>
              <span>状态一般</span>
              <span>100% 完美专注</span>
            </div>

            <div className={`mt-8 p-6 rounded-xl text-base font-medium border flex items-center justify-center gap-3 ${forcedBreak ? 'bg-indigo-50 text-indigo-800 border-indigo-100' : 'bg-emerald-50 text-emerald-800 border-emerald-100'}`}>
              <span>💡</span>
              {forcedBreak ? '战略性恢复：离开座位活动 10 分钟' : '休息提示：请起立喝水/远眺'}
            </div>
          </div>

          <button
            className={`w-full text-white font-bold py-4 px-6 rounded-xl transition-colors text-lg ${forcedBreak ? 'bg-red-500 hover:bg-red-600' : 'bg-emerald-500 hover:bg-emerald-600'}`}
            onClick={handlePomoSubmit}
          >
            记录并继续
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center font-sans">
      <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center">
        <h2 className="text-xl font-bold text-gray-800 mb-4">ℹ️ 提示</h2>
        <p className="text-gray-600 mb-6">该页面需要特定的参数才能正常显示，请通过插件内部的逻辑打开此页面。</p>
        <button
          className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-6 rounded transition-colors"
          onClick={() => window.close()}
        >
          关闭页面
        </button>
      </div>
    </div>
  );
}
