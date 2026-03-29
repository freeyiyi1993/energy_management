import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronDown, ChevronRight } from 'lucide-react';
import { type StorageData, DEFAULT_TASK_DEFS } from '../types';
import { Chart, LineController, LineElement, PointElement, LinearScale, Title, CategoryScale, Tooltip, Legend } from 'chart.js';

Chart.register(LineController, LineElement, PointElement, LinearScale, Title, CategoryScale, Tooltip, Legend);

interface Props {
  data: StorageData;
  onBack: () => void;
}

export default function StatsPage({ data, onBack }: Props) {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});

  const toggleDate = (dateStr: string) => {
    setExpandedDates(prev => ({ ...prev, [dateStr]: !prev[dateStr] }));
  };

  useEffect(() => {
    if (!chartRef.current) return;

    const stats = data.stats || [];
    const recentStats = stats.slice(-6);
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });

    const todayPomoCount = data.state ? data.state.pomodoro.count : 0;
    const todayPerfectCount = data.state ? data.state.pomodoro.perfectCount : 0;
    const todayEnergyConsumed = data.state ? (data.state.energyConsumed || 0) : 0;
    const todayMaxEnergy = data.state ? data.state.maxEnergy : 0;

    const chartData = [...recentStats, {
      date: `${todayStr} (今日)`,
      maxEnergy: todayMaxEnergy,
      energyConsumed: todayEnergyConsumed,
      pomoCount: todayPomoCount,
      perfectCount: todayPerfectCount
    }];

    const labels = chartData.map(s => s.date.substring(5));
    const maxEnergyData = chartData.map(s => s.maxEnergy);
    const consumedData = chartData.map(s => s.energyConsumed.toFixed(1));
    const pomoData = chartData.map(s => s.pomoCount);
    const perfectData = chartData.map(s => s.perfectCount);

    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    chartInstance.current = new Chart(chartRef.current, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: '精力上限', data: maxEnergyData, borderColor: '#10b981', tension: 0.3, yAxisID: 'y' },
          { label: '消耗总值', data: consumedData, borderColor: '#ef4444', tension: 0.3, yAxisID: 'y' },
          { label: '番茄数', data: pomoData, borderColor: '#34d399', borderDash: [5, 5], tension: 0.3, yAxisID: 'y1' },
          { label: '完美番茄数', data: perfectData, borderColor: '#f59e0b', borderDash: [5, 5], tension: 0.3, yAxisID: 'y1' }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'top', labels: { boxWidth: 12, font: { size: 10 } } } },
        scales: {
          y: { type: 'linear', display: true, position: 'left', title: { display: true, text: '精力值', font: { size: 10 } } },
          y1: { type: 'linear', display: true, position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: '番茄数', font: { size: 10 } } },
          x: { ticks: { font: { size: 10 } } }
        }
      }
    });

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [data]);

  const logs = data.logs || [];
  const showLogs = logs.slice(0, 100);

  // 按日期分组日志
  const groupedLogs: Record<string, {text: string, time: string}[]> = {};
  showLogs.forEach(log => {
    let dateStr = '';
    let timeStr = '';
    let textStr = '';

    if (Array.isArray(log)) {
      const [t, actionId, val, eDiff] = log;
      const d = new Date(t);
      dateStr = d.toLocaleDateString();
      timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      const taskDefs = data.taskDefs || DEFAULT_TASK_DEFS;

      // 内置 actionId 映射
      const builtinActions: Record<number, string> = {
        0: '睡眠', 1: '运动', 2: '主食', 3: '喝水', 4: '拉伸',
        5: '小憩', 6: '冥想', 7: '肠道管理', 8: '番茄钟'
      };

      let actionName: string;
      let taskDef = undefined;
      if (actionId >= 100) {
        const idx = actionId - 100;
        taskDef = taskDefs[idx];
        actionName = taskDef ? `${taskDef.icon} ${taskDef.name}` : `自定义任务#${idx}`;
      } else {
        actionName = builtinActions[actionId] || `未知`;
        taskDef = taskDefs.find(d => {
          const bMap: Record<string, number> = { sleep: 0, exercise: 1, meals: 2, water: 3, stretch: 4, nap: 5, meditate: 6, poop: 7 };
          return bMap[d.id] === actionId;
        });
      }

      if (actionId === 8) {
        if (val === 100) textStr = `🍅 完成完美番茄钟 (专注度: 100%)`;
        else textStr = `🍅 完成番茄钟 (专注度: ${val}%)`;
      } else {
        let valStr = '';
        if (taskDef?.type === 'number') valStr = `${val}${taskDef.unit || ''}`;
        else if (taskDef?.type === 'counter') valStr = `第 ${val} 次`;
        else valStr = '完成';
        textStr = `✅ 打卡 [${actionName}] : ${valStr}`;
      }
      if (eDiff > 0) textStr += ` (+${(eDiff % 1 === 0 ? eDiff : eDiff.toFixed(1))}精力)`;
      else if (eDiff < 0) textStr += ` (${(eDiff % 1 === 0 ? eDiff : eDiff.toFixed(1))}精力)`;

    } else {
      if (log.t) {
        const d = new Date(log.t);
        dateStr = d.toLocaleDateString();
        timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else if (log.time) {
        dateStr = log.time.split(/[\s,]+/)[0];
        timeStr = log.time.replace(dateStr, '').trim() || log.time.split(' ')[1];
      }
      textStr = log.txt || log.text || '';
    }

    if (!groupedLogs[dateStr]) {
      groupedLogs[dateStr] = [];
    }
    groupedLogs[dateStr].push({ text: textStr, time: timeStr });
  });

  // 默认展开第一天
  useEffect(() => {
    const dates = Object.keys(groupedLogs);
    if (dates.length > 0 && Object.keys(expandedDates).length === 0) {
      setExpandedDates({ [dates[0]]: true });
    }
  }, [logs]);

  return (
    <div className="animate-[fadeIn_0.2s_ease]">
      <div className="flex items-center mb-3 px-1">
        <div className="cursor-pointer text-gray-600 flex items-center gap-1 text-sm font-bold transition-colors hover:text-gray-900" onClick={onBack}>
          <ChevronLeft size={18} /> 返回
        </div>
        <div className="flex-1 text-center font-bold text-base text-gray-800 mr-10">数据统计</div>
      </div>

      <div className="bg-white rounded-lg p-2.5 shadow-sm">
        <div className="w-full h-[160px] mb-3">
          <canvas ref={chartRef}></canvas>
        </div>


        <div className="max-h-[50vh] overflow-y-auto border border-gray-200 rounded-md p-1.5 bg-white text-[11px]">
          {Object.keys(groupedLogs).length === 0 ? (
            <div className="text-center text-gray-400 py-5">暂无日志记录</div>
          ) : (
            Object.keys(groupedLogs).map((dateStr) => (
              <div key={dateStr} className="mb-2 last:mb-0">
                <div
                  className="flex items-center justify-between bg-gray-50 p-1.5 rounded cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => toggleDate(dateStr)}
                >
                  <span className="font-bold text-gray-700">{dateStr}</span>
                  <span className="text-gray-400">
                    {expandedDates[dateStr] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </span>
                </div>

                {expandedDates[dateStr] && (
                  <div className="pl-2 pr-1 mt-1 border-l-2 border-emerald-100 ml-1">
                    {groupedLogs[dateStr].map((log: any, i: number) => {
                      return (
                        <div key={i} className="py-1.5 border-b border-gray-50 last:border-0 flex justify-between items-start">
                          <span className="text-gray-600">{log.text}</span>
                          <span className="text-gray-400 text-[9px] whitespace-nowrap ml-1.5">{log.time}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
