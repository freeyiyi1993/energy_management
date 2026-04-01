import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { type StorageData, DEFAULT_TASK_DEFS } from '../types';
import { getLogTimestamp } from '../storage';
import { BUILTIN_ACTION_ID, BUILTIN_ACTION_INFO, POMO_ACTION_ID, CUSTOM_ACTION_ID_OFFSET } from '../constants/actionMapping';

interface Props {
  data: StorageData;
  dataResetAt: number;
}

export default function LogBrowser({ data, dataResetAt }: Props) {
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});

  const toggleDate = (dateStr: string) => {
    setExpandedDates(prev => ({ ...prev, [dateStr]: !prev[dateStr] }));
  };

  const allLogs = (data.logs || []).filter(log => !dataResetAt || getLogTimestamp(log) >= dataResetAt);
  const showLogs = [...allLogs].sort((a, b) => {
    const tA = Array.isArray(a) ? a[0] : (a.t || (a.time ? new Date(a.time).getTime() : 0));
    const tB = Array.isArray(b) ? b[0] : (b.t || (b.time ? new Date(b.time).getTime() : 0));
    return tB - tA;
  }).slice(0, 100);

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

      let actionName: string;
      let taskDef = undefined;
      if (actionId >= CUSTOM_ACTION_ID_OFFSET) {
        const idx = actionId - CUSTOM_ACTION_ID_OFFSET;
        taskDef = taskDefs[idx];
        actionName = taskDef ? `${taskDef.icon} ${taskDef.name}` : `自定义任务#${idx}`;
      } else {
        actionName = BUILTIN_ACTION_INFO[actionId]?.name || `未知`;
        taskDef = taskDefs.find(d => BUILTIN_ACTION_ID[d.id] === actionId);
      }

      if (actionId === POMO_ACTION_ID) {
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

  useEffect(() => {
    const dates = Object.keys(groupedLogs).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    if (dates.length > 0 && Object.keys(expandedDates).length === 0) {
      setExpandedDates({ [dates[0]]: true });
    }
  }, [allLogs]);

  return (
    <div className="max-h-[50vh] overflow-y-auto border border-gray-200 rounded-md p-1.5 bg-white text-[11px]">
      {Object.keys(groupedLogs).length === 0 ? (
        <div className="text-center text-gray-400 py-5">暂无日志记录</div>
      ) : (
        Object.keys(groupedLogs).sort((a, b) => new Date(b).getTime() - new Date(a).getTime()).map((dateStr) => (
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
                {groupedLogs[dateStr].map((log, i) => {
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
  );
}
