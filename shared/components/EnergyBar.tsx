import { type AppState, type Config, type Tasks } from '../types';

interface Props {
  state: AppState;
  config?: Config;
  tasks?: Tasks;
  className?: string;
}

export default function EnergyBar({ state, config, tasks, className }: Props) {
  const energyPercent = (state.energy / state.maxEnergy) * 100;
  const threshold = config?.lowEnergyThreshold ?? 20;
  let barColor = '#10b981';
  if (state.energy < threshold) barColor = '#ef4444';
  else if (state.energy < threshold * 2) barColor = '#f59e0b';

  // 计算当前衰减速率
  const decayRate = config?.decayRate ?? 4;
  const penaltyMultiplier = config?.penaltyMultiplier ?? 1.5;
  const mealsCount = (tasks?.meals as number) || 0;
  const currentHour = new Date().getHours();
  const missedMeals =
    (currentHour >= 10 && mealsCount < 1) ||
    (currentHour >= 14 && mealsCount < 2) ||
    (currentHour >= 19 && mealsCount < 3);
  const effectiveRate = missedMeals ? decayRate * penaltyMultiplier : decayRate;

  return (
    <div className={className}>
      <div className="w-full h-6 bg-gray-200 rounded-full overflow-hidden relative flex items-center justify-center">
        <div className="absolute left-0 top-0 h-full transition-all duration-300 z-0" style={{ width: `${energyPercent}%`, backgroundColor: barColor }} />
        <span className="relative z-10 text-xs font-bold text-white drop-shadow-md">
          精力值:{Math.floor(state.energy)} / {state.maxEnergy}
        </span>
      </div>
      <div className="flex justify-end mt-0.5">
        <span className={`text-[10px] ${missedMeals ? 'text-red-400' : 'text-gray-400'}`}>
          ▼ {effectiveRate.toFixed(1)}/h{missedMeals ? ' ⚠️惩罚中' : ''}
        </span>
      </div>
    </div>
  );
}
