import { useEffect, useState } from 'react';

interface Props {
  onClose: () => void;
}

export default function BadDayWarning({ onClose }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
    >
      {/* Modal */}
      <div
        className="relative bg-white rounded-2xl shadow-2xl px-8 py-6 mx-4 text-center transition-all duration-300"
        style={{
          transform: visible ? 'scale(1)' : 'scale(0.8)',
          opacity: visible ? 1 : 0,
          maxWidth: 300,
        }}
      >
        <div className="text-5xl mb-3">⚠️</div>
        <h2 className="text-lg font-bold text-red-600 mb-1">糟糕一天</h2>
        <p className="text-sm text-gray-500 mb-4">睡眠不足、缺乏运动、没有完美番茄，明日精力上限将下降</p>
        <button
          onClick={onClose}
          className="px-6 py-2 rounded-full bg-gradient-to-r from-red-400 to-red-500 text-white font-semibold text-sm shadow hover:from-red-500 hover:to-red-600 transition-all active:scale-95"
        >
          知道了
        </button>
      </div>
    </div>
  );
}
