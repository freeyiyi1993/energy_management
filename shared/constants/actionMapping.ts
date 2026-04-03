/** 内置任务 ID -> actionId 映射 */
export const BUILTIN_ACTION_ID: Record<string, number> = {
  sleep: 0, exercise: 1, meals: 2, water: 3,
  stretch: 4, nap: 5, meditate: 6, poop: 7,
};

/** actionId -> 显示信息映射（用于日志展示） */
export const BUILTIN_ACTION_INFO: Record<number, { icon: string; name: string }> = {
  0: { icon: '💤', name: '睡眠' },
  1: { icon: '🏃', name: '运动' },
  2: { icon: '🍽️', name: '三餐' },
  3: { icon: '💧', name: '饮水' },
  4: { icon: '🧘', name: '拉伸' },
  5: { icon: '😴', name: '午睡' },
  6: { icon: '🧠', name: '冥想' },
  7: { icon: '💩', name: '肠道' },
  8: { icon: '🍅', name: '番茄' },
  9: { icon: '🏆', name: '完美一天' },
  10: { icon: '⚠️', name: '糟糕一天' },
};

/** 番茄钟特殊 actionId */
export const POMO_ACTION_ID = 8;
/** 日切结算 actionId */
export const PERFECT_DAY_ACTION_ID = 9;
export const BAD_DAY_ACTION_ID = 10;

/** 自定义任务 actionId 起始偏移 */
export const CUSTOM_ACTION_ID_OFFSET = 100;
