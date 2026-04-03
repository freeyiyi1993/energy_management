import { useEffect, useState } from 'react';

export type DayResultType = 'perfect' | 'bad';

interface Props {
  type: DayResultType;
  onClose: () => void;
}

interface Particle {
  id: number;
  left: number;
  delay: number;
  duration: number;
  color: string;
  size: number;
  rotation: number;
}

const CONFETTI_COLORS = ['#f59e0b', '#ef4444', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4'];

function generateParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.8,
    duration: 1.5 + Math.random() * 1.5,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    size: 6 + Math.random() * 6,
    rotation: Math.random() * 360,
  }));
}

const CONTENT = {
  perfect: {
    icon: '🏆',
    title: '完美一天!',
    message: '所有打卡任务已完成，继续保持!',
    button: '太棒了',
    buttonClass: 'from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600',
  },
  bad: {
    icon: '⚠️',
    title: '糟糕一天',
    titleClass: 'text-red-600',
    message: '睡眠不足、缺乏运动、没有完美番茄，明日精力上限将下降',
    button: '知道了',
    buttonClass: 'from-red-400 to-red-500 hover:from-red-500 hover:to-red-600',
  },
} as const;

export default function DayResultModal({ type, onClose }: Props) {
  const [particles] = useState(() => type === 'perfect' ? generateParticles(40) : []);
  const [visible, setVisible] = useState(false);
  const c = CONTENT[type];

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
    >
      {/* Confetti particles (perfect day only) */}
      {particles.length > 0 && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {particles.map(p => (
            <div
              key={p.id}
              className="absolute"
              style={{
                left: `${p.left}%`,
                top: '-5%',
                width: p.size,
                height: p.size * 0.6,
                backgroundColor: p.color,
                borderRadius: '2px',
                transform: `rotate(${p.rotation}deg)`,
                animation: `confetti-fall ${p.duration}s ease-in ${p.delay}s forwards`,
                opacity: 0,
              }}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      <div
        className="relative bg-white rounded-2xl shadow-2xl px-8 py-6 mx-4 text-center transition-all duration-300"
        style={{
          transform: visible ? 'scale(1)' : 'scale(0.6)',
          opacity: visible ? 1 : 0,
          maxWidth: 300,
        }}
      >
        <div className={`text-5xl mb-3 ${type === 'perfect' ? 'animate-bounce' : ''}`}>{c.icon}</div>
        <h2 className={`text-lg font-bold mb-1 ${'titleClass' in c ? c.titleClass : 'text-gray-800'}`}>{c.title}</h2>
        <p className="text-sm text-gray-500 mb-4">{c.message}</p>
        <button
          onClick={onClose}
          className={`px-6 py-2 rounded-full bg-gradient-to-r ${c.buttonClass} text-white font-semibold text-sm shadow transition-all active:scale-95`}
        >
          {c.button}
        </button>
      </div>

      {type === 'perfect' && (
        <style>{`
          @keyframes confetti-fall {
            0% { opacity: 1; transform: translateY(0) rotate(0deg); }
            100% { opacity: 0; transform: translateY(100vh) rotate(720deg); }
          }
        `}</style>
      )}
    </div>
  );
}
