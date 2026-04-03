import { Play } from 'lucide-react';
import { type AppState } from '../types';
import { type StorageInterface } from '../storage';
import { PERFECT_POMODOROS_REQUIRED } from '../logic';

interface Props {
  state: AppState;
  storage: StorageInterface;
  onDataChange: () => void;
  compact?: boolean;
  className?: string;
}

export default function PomodoroRing({ state, storage, onDataChange, compact, className }: Props) {
  const isOngoing = state.pomodoro.status === 'ongoing';
  const elapsedSec = isOngoing && state.pomodoro.startedAt
    ? (Date.now() - state.pomodoro.startedAt) / 1000
    : isOngoing ? (Date.now() - state.lastUpdateTime) / 1000 : 0;
  const realTimeLeft = Math.max(0, 25 * 60 - elapsedSec);
  const pomoPercent = 100 - (realTimeLeft / (25 * 60)) * 100;
  const m = Math.floor(realTimeLeft / 60).toString().padStart(2, '0');
  const s = (Math.floor(realTimeLeft) % 60).toString().padStart(2, '0');

  const togglePomo = async () => {
    const nowTs = Date.now();
    const starting = !isOngoing;
    const newState = {
      ...state,
      pomodoro: { ...state.pomodoro, status: starting ? 'ongoing' as const : 'idle' as const, startedAt: starting ? nowTs : undefined, updatedAt: nowTs },
      lastUpdateTime: nowTs,
    };
    await storage.set({ state: newState });
    onDataChange();
  };

  return (
    <div className={className}>
      <div className={`${compact ? 'w-[110px]' : 'w-[140px]'} mx-auto`}>
        <div
          className={`${compact ? 'w-[110px] h-[110px]' : 'w-[140px] h-[140px]'} rounded-full relative flex items-center justify-center cursor-pointer transition-transform hover:scale-105`}
          style={{
            background: `conic-gradient(#10b981 ${pomoPercent}%, #e5e7eb ${pomoPercent}%)`
          }}
          onClick={togglePomo}
        >
          <div className={`${compact ? 'w-[96px] h-[96px]' : 'w-[124px] h-[124px]'} bg-white rounded-full flex flex-col items-center justify-center relative`}>
            <div className={`${compact ? 'text-2xl' : 'text-4xl'} font-bold transition-colors ${isOngoing ? 'text-emerald-500' : 'text-gray-300'}`}>
              {m}:{s}
            </div>
            <div className="text-[10px] text-gray-400 mt-1">
              总: {state.pomoCount || 0} | 完美: {state.pomoPerfectCount || 0}/{PERFECT_POMODOROS_REQUIRED}
              {(state.pomoPerfectCount || 0) >= PERFECT_POMODOROS_REQUIRED ? ' ✅' : ''}
            </div>

            {!isOngoing && (
              <div className="absolute inset-0 bg-white/85 rounded-full flex items-center justify-center text-emerald-500">
                <Play size={compact ? 28 : 36} fill="currentColor" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
