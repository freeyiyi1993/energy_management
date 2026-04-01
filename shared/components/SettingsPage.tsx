import { useState, useEffect } from 'react';
import { ChevronLeft, Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { type StorageData, type Config, type CustomTaskDef, type HealLevel, type TaskType, DEFAULT_TASK_DEFS, DEFAULT_CONFIG } from '../types';
import { type StorageInterface } from '../storage';

interface Props {
  data: StorageData;
  storage: StorageInterface;
  onBack: () => void;
  onSaved: () => void;
}

const HEAL_LABELS: Record<HealLevel, string> = {
  none: '不恢复',
  small: '小恢复',
  mid: '中恢复',
  big: '大恢复',
};

const TYPE_LABELS: Record<TaskType, string> = {
  counter: '计数器',
  boolean: '开关',
  number: '数值输入',
};

function InputRow({ label, field, min, max, step, config, onChange }: { label: string, field: keyof Config, min?: number, max?: number, step?: string, config: Config, onChange: (k: keyof Config, v: number) => void }) {
  return (
    <div className="flex justify-between items-center mb-2">
      <div className="text-xs text-gray-600 flex-1">{label}</div>
      <input
        type="number"
        className="w-16 p-1 border border-gray-300 rounded text-xs outline-none text-right focus:border-emerald-500"
        value={config[field]}
        min={min} max={max} step={step}
        onChange={(e) => onChange(field, parseFloat(e.target.value))}
      />
    </div>
  );
}

export default function SettingsPage({ data, storage, onBack, onSaved }: Props) {
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [taskDefs, setTaskDefs] = useState<CustomTaskDef[]>(DEFAULT_TASK_DEFS);
  const [showToast, setShowToast] = useState(false);
  const [taskSectionOpen, setTaskSectionOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<CustomTaskDef | null>(null);

  useEffect(() => {
    if (data.config) {
      setTimeout(() => setConfig(data.config!), 0);
    }
    if (data.taskDefs) {
      setTimeout(() => setTaskDefs(data.taskDefs!), 0);
    }
  }, [data]);

  const handleChange = (k: keyof Config, v: number) => {
    setConfig((prev: Config) => ({ ...prev, [k]: v }));
  };

  const handleSave = async () => {
    const oldConfig = data.config || DEFAULT_CONFIG;
    await storage.set({ config, taskDefs });

    const d = await storage.get(['logs', 'state']);
    if (d.state) {
      const diff = config.maxEnergy - oldConfig.maxEnergy;
      d.state.maxEnergy += diff;
      await storage.set({ state: d.state });
    }

    const logs = d.logs || [];
    logs.unshift({ time: new Date().toLocaleString(), text: `⚙️ 系统配置已更新` });
    await storage.set({ logs });

    setShowToast(true);
    setTimeout(() => setShowToast(false), 2000);
    onSaved();
  };

  const addCustomTask = () => {
    const id = `custom_${Date.now()}`;
    const newTask: CustomTaskDef = {
      id,
      name: '新任务',
      icon: '✨',
      type: 'boolean',
      healLevel: 'small',
      enabled: true,
    };
    setEditingTask(newTask);
  };

  const saveEditingTask = () => {
    if (!editingTask) return;
    setTaskDefs(prev => {
      const idx = prev.findIndex(d => d.id === editingTask.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = editingTask;
        return updated;
      }
      return [...prev, editingTask];
    });
    setEditingTask(null);
  };

  const deleteTask = (id: string) => {
    setTaskDefs(prev => prev.filter(d => d.id !== id));
  };

  const toggleTaskEnabled = (id: string) => {
    setTaskDefs(prev => prev.map(d => d.id === id ? { ...d, enabled: !d.enabled } : d));
  };

  return (
    <div className="animate-[fadeIn_0.2s_ease]">
      <div className="flex items-center mb-3 px-1">
        <div className="cursor-pointer text-gray-600 flex items-center gap-1 text-sm font-bold transition-colors hover:text-gray-900" onClick={onBack}>
          <ChevronLeft size={18} /> 返回
        </div>
        <div className="flex-1 text-center font-bold text-base text-gray-800 mr-10">系统设置</div>
      </div>

      {showToast && (
        <div className="bg-emerald-500 text-white text-center p-2 rounded-md mb-3 text-xs animate-[fadeIn_0.2s_ease]">
          ✅ 设置已保存！
        </div>
      )}

      <div className="bg-white rounded-lg p-3 shadow-sm">
        <div className="font-bold mb-3 text-[13px]">📊 基础配置</div>
        <InputRow config={config} onChange={handleChange} label="默认精力上限" field="maxEnergy" min={10} />

        <div className="font-bold my-3 text-[13px]">✨ 日常恢复</div>
        <InputRow config={config} onChange={handleChange} label="小恢复点数 (喝水/拉伸/小憩/冥想/肠道)" field="smallHeal" min={0} />
        <InputRow config={config} onChange={handleChange} label="中恢复点数 (主食/运动)" field="midHeal" min={0} />
        <InputRow config={config} onChange={handleChange} label="大恢复比例 (睡眠满8h)" field="bigHealRatio" min={0} max={1} step="0.1" />

        <div className="font-bold my-3 text-[13px]">🔥 日常消耗</div>
        <InputRow config={config} onChange={handleChange} label="基础消耗速率 (点/时)" field="decayRate" min={0} step="0.5" />
        <InputRow config={config} onChange={handleChange} label="错过饭点惩罚倍率" field="penaltyMultiplier" min={1} step="0.1" />

        <div className="font-bold my-3 text-[13px]">📈 长期成长 (上限升降)</div>
        <InputRow config={config} onChange={handleChange} label="完美一天上限提升" field="perfectDayBonus" min={0} />
        <InputRow config={config} onChange={handleChange} label="糟糕一天上限下降" field="badDayPenalty" min={0} />

        {/* 打卡事项管理 */}
        <div
          className="font-bold my-3 text-[13px] flex items-center gap-1 cursor-pointer hover:text-emerald-600 transition-colors"
          onClick={() => setTaskSectionOpen(!taskSectionOpen)}
        >
          {taskSectionOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          🎯 打卡事项管理
        </div>

        {taskSectionOpen && (
          <div className="border border-gray-200 rounded-md p-2 mb-2">
            {taskDefs.map(def => (
              <div key={def.id} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-sm">{def.icon}</span>
                  <span className="text-xs text-gray-700 truncate">{def.name}</span>
                  <span className="text-[10px] text-gray-400">{HEAL_LABELS[def.healLevel]}</span>
                  {def.countsForPerfectDay && <span className="text-[9px] text-amber-500">★</span>}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    className={`text-[10px] px-1.5 py-0.5 rounded ${def.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}
                    onClick={() => toggleTaskEnabled(def.id)}
                  >
                    {def.enabled ? '启用' : '禁用'}
                  </button>
                  <button
                    className="text-[10px] px-1 py-0.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-100"
                    onClick={() => setEditingTask({ ...def })}
                  >
                    编辑
                  </button>
                  {!def.builtin && (
                    <button
                      className="text-gray-400 hover:text-red-500 transition-colors"
                      onClick={() => deleteTask(def.id)}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
            ))}

            <button
              className="w-full mt-2 border border-dashed border-gray-300 rounded-md py-1.5 text-xs text-gray-500 hover:text-emerald-600 hover:border-emerald-400 transition-colors flex items-center justify-center gap-1"
              onClick={addCustomTask}
            >
              <Plus size={12} /> 添加自定义事项
            </button>
          </div>
        )}

        {/* 编辑任务弹窗 */}
        {editingTask && (
          <div className="fixed inset-0 bg-black/40 z-[200] flex items-center justify-center p-4">
            <div className="bg-white rounded-lg p-4 w-full max-w-[280px] shadow-xl">
              <div className="font-bold text-sm mb-3">{editingTask.builtin ? '编辑任务' : (taskDefs.find(d => d.id === editingTask.id) ? '编辑任务' : '添加任务')}</div>

              <div className="space-y-2">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] text-gray-500 block mb-0.5">图标</label>
                    <input
                      className="w-full border border-gray-300 rounded p-1 text-xs outline-none focus:border-emerald-500"
                      value={editingTask.icon}
                      onChange={e => setEditingTask({ ...editingTask, icon: e.target.value })}
                    />
                  </div>
                  <div className="flex-[2]">
                    <label className="text-[10px] text-gray-500 block mb-0.5">名称</label>
                    <input
                      className="w-full border border-gray-300 rounded p-1 text-xs outline-none focus:border-emerald-500"
                      value={editingTask.name}
                      onChange={e => setEditingTask({ ...editingTask, name: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-gray-500 block mb-0.5">类型</label>
                  <select
                    className="w-full border border-gray-300 rounded p-1 text-xs outline-none focus:border-emerald-500"
                    value={editingTask.type}
                    onChange={e => setEditingTask({ ...editingTask, type: e.target.value as TaskType })}
                    disabled={!!editingTask.builtin}
                  >
                    {Object.entries(TYPE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-gray-500 block mb-0.5">精力恢复等级</label>
                  <select
                    className="w-full border border-gray-300 rounded p-1 text-xs outline-none focus:border-emerald-500"
                    value={editingTask.healLevel}
                    onChange={e => setEditingTask({ ...editingTask, healLevel: e.target.value as HealLevel })}
                  >
                    {Object.entries(HEAL_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>

                {editingTask.type === 'counter' && (
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-0.5">每日上限次数</label>
                    <input
                      type="number"
                      className="w-full border border-gray-300 rounded p-1 text-xs outline-none focus:border-emerald-500"
                      value={editingTask.maxCount || 3}
                      min={1}
                      onChange={e => setEditingTask({ ...editingTask, maxCount: parseInt(e.target.value) || 3 })}
                    />
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <label className="text-[10px] text-gray-500">计入完美一天</label>
                  <button
                    className={`text-[10px] px-2 py-0.5 rounded transition-colors ${editingTask.countsForPerfectDay ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}
                    onClick={() => setEditingTask({ ...editingTask, countsForPerfectDay: !editingTask.countsForPerfectDay })}
                  >
                    {editingTask.countsForPerfectDay ? '是' : '否'}
                  </button>
                </div>

                {editingTask.type === 'number' && (
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-[10px] text-gray-500 block mb-0.5">单位</label>
                      <input
                        className="w-full border border-gray-300 rounded p-1 text-xs outline-none focus:border-emerald-500"
                        value={editingTask.unit || ''}
                        onChange={e => setEditingTask({ ...editingTask, unit: e.target.value })}
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] text-gray-500 block mb-0.5">占位提示</label>
                      <input
                        className="w-full border border-gray-300 rounded p-1 text-xs outline-none focus:border-emerald-500"
                        value={editingTask.placeholder || ''}
                        onChange={e => setEditingTask({ ...editingTask, placeholder: e.target.value })}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2 mt-3">
                <button
                  className="flex-1 bg-gray-100 text-gray-600 py-1.5 rounded text-xs font-bold hover:bg-gray-200 transition-colors"
                  onClick={() => setEditingTask(null)}
                >
                  取消
                </button>
                <button
                  className="flex-1 bg-emerald-500 text-white py-1.5 rounded text-xs font-bold hover:bg-emerald-600 transition-colors"
                  onClick={saveEditingTask}
                >
                  确定
                </button>
              </div>
            </div>
          </div>
        )}

        <button
          className="w-full bg-emerald-500 text-white border-none p-2 rounded-md text-[13px] font-bold cursor-pointer mt-2 hover:bg-emerald-600 transition-colors"
          onClick={handleSave}
        >
          保存并应用
        </button>
      </div>
    </div>
  );
}
