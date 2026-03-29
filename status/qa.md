# QA 完成报告

## 修改的文件
- `eslint.config.js`: 添加 `dist-web` 到 globalIgnores，防止 lint 扫描构建产物
- `tests/ui_test.js`: 修复 popup URL 路径 `src/pages/popup/` → `extension/pages/popup/`
- `tests/utils.test.ts`: 扩展 parseTimeStr 测试（3→7 case），覆盖空字符串、全部 24 小时

## 新增的文件
- `tests/types.test.ts`: DEFAULT_TASK_DEFS 结构验证测试（12 case），覆盖：
  - 任务数量、ID 顺序、唯一性
  - builtin/enabled 默认值
  - countsForPerfectDay 标记正确性
  - 各任务类型和恢复等级
  - counter 类型有 maxCount、number 类型有 unit/placeholder
  - 每个任务有非空 icon 和 name

## 依赖变更
- 是否修改了接口/类型: 否
- 影响范围: 无，纯测试和配置变更

## 测试状态
- 单元测试: 通过 (2 files, 19 tests, 0 failures)
- 构建: TypeScript 编译报错 2 个（均在 `web/WebApp.tsx`，由其他 Agent 的未提交改动引起，非 QA 变更导致）

## 发现的问题（需其他 Agent 修复）

### P1: TypeScript 编译错误（web-app Agent）
- `web/WebApp.tsx:19` - `showLowEnergyOverlay` declared but never read
- `web/WebApp.tsx:63` - `handleDismissLowEnergy` declared but never read
- **影响**: `npm run build` 和 `npm run build:web` 均失败

### P2: ESLint 错误 28 个（各 Agent）
- `@typescript-eslint/no-explicit-any`: 22 处（分布在 extension/storage.ts, web/storage.ts, shared/storage.ts, shared/types/index.ts, SyncPanel.tsx, AuthPanel.tsx, StatsPage.tsx, background/index.ts, web-ticker.ts）
- `prefer-const`: 1 处（extension/pages/finish/FinishApp.tsx:26）
- `react-hooks/exhaustive-deps`: 2 处 warning（MainDashboard.tsx, StatsPage.tsx）
- `react-refresh`: 1 处（MainDashboard.tsx impure function during render）
- `react-refresh`: 1 处（StatsPage.tsx cascading setState in effect）
- **建议**: 各 Agent 在自己的文件边界内修复

### P3: 构建产物体积警告
- `dist/assets/storage-*.js`: 530 KB（Firebase SDK 占大头）
- `dist-web/assets/web-*.js`: 734 KB
- **建议**: 后续考虑 dynamic import 拆分 Firebase

### P4: 核心业务逻辑无单测覆盖
- `buildEmptyTasks()`, `handleDayRollover()`, `getLogicalDate()` 等函数未导出，无法从外部测试
- `logsToFirestore()` / `logsFromFirestore()` 是 private 函数
- **建议**: backend Agent 将纯函数提取到 shared/utils/ 并导出，QA 再补充测试

## 遗留问题
- 核心业务逻辑（精力衰减、日期翻转、完美一天判定）因函数未导出，当前无法单测。需 backend Agent 配合重构后再补测试
- UI 自动化测试 (`test:ui`) 需要先构建成功才能运行，当前因 TS 编译错误被阻塞
