import { useState, useEffect } from 'react';
import { type CustomTaskDef, type Tasks, type Config, DEFAULT_TASK_DEFS } from '../types';
import { type StorageInterface } from '../storage';
import { calculateRecovery } from '../logic';
import { BUILTIN_ACTION_ID, CUSTOM_ACTION_ID_OFFSET } from '../constants/actionMapping';

interface Props {
  tasks: Tasks;
  config: Config;
  taskDefs: CustomTaskDef[];
  storage: StorageInterface;
  onDataChange: () => void;
  className?: string;
}

export default function TaskGrid({ tasks, config, taskDefs, storage, onDataChange, className }: Props) {
  const [localInputs, setLocalInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    setLocalInputs(prev => {
      const next = { ...prev };
      taskDefs.forEach(def => {
        if (def.type === 'number' && tasks[def.id] !== null && tasks[def.id] !== undefined) {
          next[def.id] = String(tasks[def.id]);
        }
      });
      return next;
    });
  }, [tasks]);

  const handleTaskSave = async (def: CustomTaskDef, val: number | boolean) => {
    const isCounter = def.type === 'counter';
    const maxCount = def.maxCount || 3;

    if (!isCounter && tasks[def.id] !== null && tasks[def.id] !== false && tasks[def.id] !== undefined) return;
    if (isCounter && (tasks[def.id] as number || 0) >= maxCount) return;

    const d = await storage.get(['tasks', 'state', 'logs', 'config', 'taskDefs']);
    if (!d.tasks || !d.state) return;

    const storedVal = d.tasks[def.id];
    if (!isCounter && storedVal !== null && storedVal !== false && storedVal !== undefined) return;
    if (isCounter && (storedVal as number || 0) >= maxCount) return;

    const currentConfig = d.config || config;
    const oldEnergy = d.state.energy;

    if (isCounter) {
      d.tasks[def.id] = ((d.tasks[def.id] as number) || 0) + 1;
    } else {
      d.tasks[def.id] = val;
    }

    d.state.energy += calculateRecovery(def, val, currentConfig, d.state.maxEnergy);

    const energyDiff = d.state.energy - oldEnergy;
    if (energyDiff < 0) {
      d.state.energyConsumed = (d.state.energyConsumed || 0) + Math.abs(energyDiff);
    }

    const allDefs = d.taskDefs || DEFAULT_TASK_DEFS;
    const actionId = BUILTIN_ACTION_ID[def.id] ?? (CUSTOM_ACTION_ID_OFFSET + allDefs.findIndex(d2 => d2.id === def.id));

    let numericVal = 1;
    if (isCounter) numericVal = d.tasks[def.id] as number;
    else if (typeof val === 'boolean') numericVal = val ? 1 : 0;
    else numericVal = Number(val);

    const logs = d.logs || [];
    logs.unshift([Date.now(), actionId, numericVal, Number(energyDiff.toFixed(1))]);
    await storage.set({ tasks: d.tasks, state: d.state, logs });
    onDataChange();
  };

  const renderTask = (def: CustomTaskDef) => {
    if (def.type === 'counter') {
      const count = (tasks[def.id] as number) || 0;
      const maxCount = def.maxCount || 3;
      const isMax = count >= maxCount;
      return (
        <div key={def.id} className="flex flex-col h-full justify-end">
          <button
            className={`h-[26px] rounded flex items-center justify-center text-xs font-bold transition-colors ${isMax ? 'bg-emerald-500/20 text-emerald-700 cursor-not-allowed border border-emerald-200' : 'bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200'}`}
            disabled={isMax}
            onClick={() => handleTaskSave(def, true)}
          >
            {isMax ? `✅ 已满 (${maxCount}/${maxCount})` : <><span className="mr-1">{def.icon}</span> {def.name} ({count}/{maxCount})</>}
          </button>
        </div>
      );
    }

    if (def.type === 'boolean') {
      const isDone = !!tasks[def.id];
      return (
        <div key={def.id} className="flex flex-col h-full justify-end">
          <button
            className={`h-[26px] rounded flex items-center justify-center text-xs font-bold transition-colors ${isDone ? 'bg-emerald-500/20 text-emerald-700 cursor-not-allowed border border-emerald-200' : 'bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200'}`}
            disabled={isDone}
            onClick={() => handleTaskSave(def, true)}
          >
            {isDone ? '✅ 已完成' : <><span className="mr-1">{def.icon}</span> {def.name}</>}
          </button>
        </div>
      );
    }

    const isSubmitted = tasks[def.id] !== null && tasks[def.id] !== undefined;
    const localVal = localInputs[def.id] || '';
    return (
      <div key={def.id} className="flex flex-col text-xs">
        <label className="mb-1 text-gray-600">{def.icon} {def.name}{def.unit ? `(${def.unit})` : ''}</label>
        <input
          type="number"
          className="border border-gray-300 rounded p-1 text-xs outline-none focus:border-emerald-500 disabled:bg-gray-100 disabled:text-gray-500"
          placeholder={def.placeholder || ''}
          value={localVal}
          disabled={!!isSubmitted}
          onChange={(e) => setLocalInputs(prev => ({ ...prev, [def.id]: e.target.value }))}
          onBlur={(e) => {
            const v = parseFloat(e.target.value);
            if (!isNaN(v)) handleTaskSave(def, v);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.currentTarget.blur();
            }
          }}
        />
      </div>
    );
  };

  return (
    <div className={className}>
      <div className="grid grid-cols-2 gap-2">
        {taskDefs.map(def => renderTask(def))}
      </div>
    </div>
  );
}
