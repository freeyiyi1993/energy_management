export interface Config {
  maxEnergy: number;
  minEnergy: number;
  smallHeal: number;
  midHeal: number;
  bigHealRatio: number;
  decayRate: number;
  penaltyMultiplier: number;
  perfectDayBonus: number;
  badDayPenalty: number;
}

export interface PomodoroTimer {
  status: 'ongoing' | 'idle';
  startedAt?: number;        // ongoing 时有值，用于跨设备同步
  updatedAt: number;         // 每次状态变更（开始/停止/重置/完成）更新，合并时取大
  consecutiveCount: number;  // 强制休息计数，跟随 timer 原子同步
}

export interface AppState {
  logicalDate: string;
  maxEnergy: number;
  energy: number;
  lastUpdateTime: number;
  lowEnergyReminded: boolean;
  energyConsumed?: number;
  pomodoro: PomodoroTimer;
  pomoCount: number;
  pomoPerfectCount: number;
}

// Tasks 使用动态 key 以支持自定义打卡事项
export interface Tasks {
  [key: string]: number | boolean | null;
}

export interface LogEntry {
  time: string;
  text: string;
}

export type CompactLog = [
  number, // 0: timestamp
  number, // 1: action type (0=sleep,1=exercise,2=meals,3=water,4=stretch,5=nap,6=meditate,7=poop,8=pomo)
  number, // 2: value (e.g. 8 for sleep, 1 for 1st meal, 100 for pomo score, 1 for boolean true)
  number  // 3: energy diff
];

export type AppLogEntry = {
  time?: string; // 兼容旧版本数据
  text?: string; // 兼容旧版本数据
  t?: number;    // 兼容中间版本数据
  txt?: string;  // 兼容中间版本数据
} | CompactLog;

// 自定义打卡事项定义
export type TaskType = 'counter' | 'boolean' | 'number';
export type HealLevel = 'none' | 'small' | 'mid' | 'big';

export interface CustomTaskDef {
  id: string;           // 唯一标识，如 'sleep', 'exercise', 'custom_1'
  name: string;         // 显示名称，如 '睡眠', '臀桥'
  icon: string;         // emoji 图标，如 '💤', '🏋️'
  type: TaskType;       // counter: 可累加(如主食0→3), boolean: 开关, number: 数值输入
  healLevel: HealLevel; // none: 不恢复, small/mid/big 对应 config 中的恢复量
  maxCount?: number;    // counter 类型的上限，默认 3
  unit?: string;        // number 类型的单位，如 'h', 'min'
  placeholder?: string; // number 类型的输入提示
  builtin?: boolean;    // 是否为内置任务（内置任务不可删除，只能禁用）
  enabled: boolean;     // 是否启用
  countsForPerfectDay?: boolean; // 是否计入完美一天结算
}

// 内置默认任务列表
export const DEFAULT_TASK_DEFS: CustomTaskDef[] = [
  { id: 'sleep',    name: '睡眠',     icon: '💤', type: 'number',  healLevel: 'big',   unit: 'h',   placeholder: '8',     builtin: true, enabled: true, countsForPerfectDay: true },
  { id: 'exercise', name: '运动',     icon: '🏃', type: 'number',  healLevel: 'mid',   unit: 'min', placeholder: '目标:30', builtin: true, enabled: true, countsForPerfectDay: true },
  { id: 'meals',    name: '主食打卡', icon: '🍚', type: 'counter', healLevel: 'mid',   maxCount: 3, builtin: true, enabled: true, countsForPerfectDay: true },
  { id: 'water',    name: '喝水打卡', icon: '💧', type: 'counter', healLevel: 'small', maxCount: 5, builtin: true, enabled: true, countsForPerfectDay: true },
  { id: 'stretch',  name: '拉伸放松', icon: '🧘', type: 'counter', healLevel: 'small', maxCount: 3, builtin: true, enabled: true, countsForPerfectDay: false },
  { id: 'nap',      name: '午间小憩', icon: '🌙', type: 'boolean', healLevel: 'small', builtin: true, enabled: true, countsForPerfectDay: false },
  { id: 'meditate', name: '正念冥想', icon: '🧠', type: 'counter', healLevel: 'small', maxCount: 3, builtin: true, enabled: true, countsForPerfectDay: false },
  { id: 'poop',     name: '肠道管理', icon: '💨', type: 'boolean', healLevel: 'small', builtin: true, enabled: true, countsForPerfectDay: false },
];

export const DEFAULT_CONFIG: Config = {
  maxEnergy: 65,
  minEnergy: 5,
  smallHeal: 2,
  midHeal: 5,
  bigHealRatio: 0.2,
  decayRate: 4,
  penaltyMultiplier: 1.5,
  perfectDayBonus: 1,
  badDayPenalty: 1,
};

export interface StatEntry {
  date: string;
  maxEnergy: number;
  energyConsumed: number;
  pomoCount: number;
  perfectCount: number;
}

export interface StorageData {
  config?: Config;
  state?: AppState;
  tasks?: Tasks;
  taskDefs?: CustomTaskDef[];
  stats?: StatEntry[];
  logs?: AppLogEntry[];
  dataResetAt?: number;
}

// 页面类型定义（供 MenuPanel 等组件使用）
export type PageType = 'main' | 'rules' | 'stats' | 'settings';
