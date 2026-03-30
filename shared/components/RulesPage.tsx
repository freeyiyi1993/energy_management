import { ChevronLeft } from 'lucide-react';
import { type StorageData, type Config, DEFAULT_TASK_DEFS } from '../types';

const DEFAULT_CONFIG: Config = {
  maxEnergy: 65,
  minEnergy: 5,
  smallHeal: 2,
  midHeal: 5,
  bigHealRatio: 0.2,
  decayRate: 4,
  penaltyMultiplier: 1.5,
  perfectDayBonus: 1,
  badDayPenalty: 1
};

export default function RulesPage({ data, onBack }: { data: StorageData; onBack: () => void }) {
  const config = data.config || DEFAULT_CONFIG;
  const taskDefs = data.taskDefs || DEFAULT_TASK_DEFS;
  const perfectDayTasks = taskDefs.filter(d => d.enabled && d.countsForPerfectDay);

  return (
    <div className="animate-[fadeIn_0.2s_ease]">
      <div className="flex items-center mb-3 px-1">
        <div className="cursor-pointer text-gray-600 flex items-center gap-1 text-sm font-bold transition-colors hover:text-gray-900" onClick={onBack}>
          <ChevronLeft size={18} /> 返回
        </div>
        <div className="flex-1 text-center font-bold text-base text-gray-800 mr-10">系统规则说明</div>
      </div>

      <div className="text-[11px] text-gray-500 bg-amber-50 border border-amber-200 p-2 rounded-md mb-3">
        💡 提示：以下为系统的默认运作规则。您可以在「设置中心」调整数值。
      </div>

      <div className="flex flex-col gap-2">
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <div className="font-bold text-[13px] mb-2 flex items-center gap-1">🌱 日常恢复</div>
          <ul className="list-none p-0 m-0 text-xs">
            <li className="flex justify-between py-1 border-b border-dashed border-gray-200 last:border-0">
              <span>每日 8:00 基础恢复</span> <span className="text-emerald-500 font-bold">恢复到上限 100%</span>
            </li>
            <li className="flex justify-between py-1 border-b border-dashed border-gray-200 last:border-0">
              <span>睡眠 8h (标准)</span> <span className="text-emerald-500 font-bold">不扣精力</span>
            </li>
            <li className="flex justify-between py-1 border-b border-dashed border-gray-200 last:border-0">
              <span>睡眠不足 8h</span> <span className="text-red-500 font-bold">扣减上限 × (8-时数)/8 (如 6h → 扣 25%)</span>
            </li>
            <li className="flex justify-between py-1 border-b border-dashed border-gray-200 last:border-0">
              <span>睡眠超过 8h</span> <span className="text-gray-400">按 8h 计，不扣减</span>
            </li>
            <li className="py-1 border-b border-dashed border-gray-200 text-[10px] text-gray-400">
              公式：精力 -= 上限 × (8 - 睡眠时数) / 8
            </li>
            <li className="flex justify-between py-1 border-b border-dashed border-gray-200 last:border-0">
              <span>主食 (中恢复)</span> <span className="text-emerald-500 font-bold">+ {config.midHeal} 点/次</span>
            </li>
            <li className="flex justify-between py-1 border-b border-dashed border-gray-200 last:border-0">
              <span>喝水/拉伸/小憩/冥想/肠道 (小恢复)</span> <span className="text-emerald-500 font-bold">+ {config.smallHeal} 点/次</span>
            </li>
            <li className="flex justify-between py-1 border-b border-dashed border-gray-200 last:border-0">
              <span>运动</span> <span className="text-gray-400">不恢复精力（仅计入完美一天）</span>
            </li>
          </ul>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <div className="font-bold text-[13px] mb-2 flex items-center gap-1">🔥 日常消耗</div>
          <ul className="list-none p-0 m-0 text-xs">
            <li className="flex justify-between py-1 border-b border-dashed border-gray-200 last:border-0">
              <span>基础自然流失</span> <span className="text-red-500 font-bold">- {config.decayRate} 点/小时</span>
            </li>
            <li className="flex justify-between py-1 border-b border-dashed border-gray-200 last:border-0">
              <span>10:00 后未吃 1 餐</span> <span className="text-red-500 font-bold">流失率 x {config.penaltyMultiplier}</span>
            </li>
            <li className="flex justify-between py-1 border-b border-dashed border-gray-200 last:border-0">
              <span>14:00 后未吃 2 餐</span> <span className="text-red-500 font-bold">流失率 x {config.penaltyMultiplier}</span>
            </li>
            <li className="flex justify-between py-1 border-b border-dashed border-gray-200 last:border-0">
              <span>19:00 后未吃 3 餐</span> <span className="text-red-500 font-bold">流失率 x {config.penaltyMultiplier}</span>
            </li>
          </ul>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <div className="font-bold text-[13px] mb-2 flex items-center gap-1">📈 长期成长 (次日生效)</div>
          <ul className="list-none p-0 m-0 text-xs">
            <li className="flex justify-between py-1 border-b border-dashed border-gray-200 last:border-0">
              <span>完美一天</span> <span className="text-emerald-500 font-bold">精力上限 + {config.perfectDayBonus}</span>
            </li>
            <li className="py-1 border-b border-dashed border-gray-200 text-[10px] text-gray-400">
              条件：{perfectDayTasks.map(d => d.icon + d.name).join('、')} 全部完成 + 4 个完美番茄
            </li>
            <li className="flex justify-between py-1 border-b border-dashed border-gray-200 last:border-0">
              <span>糟糕一天</span> <span className="text-red-500 font-bold">精力上限 - {config.badDayPenalty}</span>
            </li>
            <li className="py-1 border-b border-dashed border-gray-200 text-[10px] text-gray-400">
              条件：0 个完美番茄 + 无运动(&lt;30m) + 少睡(&lt;6h)
            </li>
            <li className="flex justify-between py-1 border-b border-dashed border-gray-200 last:border-0">
              <span>节假日豁免</span> <span className="text-gray-400">不扣精力上限</span>
            </li>
            <li className="py-1 text-[10px] text-gray-400">
              当天无任何日志记录 → 默认节假日模式，次日不扣精力上限
            </li>
          </ul>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <div className="font-bold text-[13px] mb-2 flex items-center gap-1">☁️ 同步规则</div>
          <ul className="list-none p-0 m-0 text-xs">
            <li className="flex justify-between py-1 border-b border-dashed border-gray-200 last:border-0">
              <span>登录成功后</span> <span className="text-blue-500 font-bold">自动双向同步</span>
            </li>
            <li className="flex justify-between py-1 border-b border-dashed border-gray-200 last:border-0">
              <span>每 60 秒</span> <span className="text-blue-500 font-bold">自动双向同步</span>
            </li>
            <li className="flex justify-between py-1 border-b border-dashed border-gray-200 last:border-0">
              <span>登出前</span> <span className="text-blue-500 font-bold">自动保存到云端</span>
            </li>
            <li className="flex justify-between py-1 border-b border-dashed border-gray-200 last:border-0">
              <span>手动同步</span> <span className="text-gray-500">双向合并日志+任务+状态，结果写入双端</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
