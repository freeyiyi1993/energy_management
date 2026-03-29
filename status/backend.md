# Backend Agent 完成报告

## 本次任务：修改睡眠恢复逻辑

### 问题
输入睡眠时长后，精力直接恢复到接近 100%，无视了一整天的精力消耗。

### 修改的文件

#### `shared/components/MainDashboard.tsx`
- 修改 `handleTaskSave` 中 sleep 任务的恢复公式
- 旧逻辑：`d.state.energy = d.state.maxEnergy`（直接恢复到上限）
- 新逻辑：`d.state.energy = Math.max(d.state.energy, sleepRecovery - consumed)`
  - `sleepRecovery` = maxEnergy（已根据睡眠时长调整）
  - `consumed` = `d.state.energyConsumed`（今日已消耗精力）
  - 取 max 确保不会因打卡反而降低精力

#### 未修改的文件（已检查）
- `extension/background/index.ts` — 日期翻转逻辑设置 `energy = maxEnergy` 并重置 `energyConsumed = 0`，这是新一天的初始化，不涉及睡眠打卡，无需修改
- `web/web-ticker.ts` — 同上

### 公式验证（maxEnergy=100）
- 8AM 打卡 8h 睡眠，已消耗 0 → max(100, 100-0) = 100 ✓
- 凌晨 3AM 打卡 8h 睡眠，已消耗 70 → max(30, 100-70) = 30 ✓
- 8AM 打卡 6h 睡眠，已消耗 0 → max(75, 75-0) = 75 ✓

### 构建状态
- Chrome 扩展构建: 通过
- Web 版构建: 通过
