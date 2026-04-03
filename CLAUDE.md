# CLAUDE.md

## Project Overview

精力管理可视化 - Chrome 扩展 + Web 双端应用。基于 React + Vite + Tailwind CSS，通过游戏化方式追踪身体精力与思维精力。支持 Firebase 跨设备同步。

## Tech Stack

- **React 19** + **TypeScript** (strict mode)
- **Vite 8** with multi-entry Rollup config
- **Tailwind CSS 3** (utility-first, no CSS-in-JS)
- **Firebase** (Auth + Firestore) 用于跨设备同步
- **Chart.js** + react-chartjs-2 for stats visualization
- **Chrome Manifest v3** with Service Worker
- **Vitest** (unit tests) + **Puppeteer** (UI automation tests)

## Project Structure

```
extension/                     # Chrome 扩展端
├── vite.config.ts             #   扩展 Vite 构建配置
├── background/index.ts        #   Service Worker (衰减/番茄/日期翻转)
├── storage.ts                 #   chrome.storage.local 实现 + 云同步
├── pages/popup/               #   弹窗入口 (PopupApp.tsx)
├── pages/finish/              #   全屏提醒页 (FinishApp.tsx)
├── components/SyncPanel.tsx   #   同步面板 (thin wrapper → BaseAuthPanel)
└── public/manifest.json       #   Manifest V3

web/                           # Web 端
├── vite.config.ts             #   Web Vite 构建配置
├── WebApp.tsx                 #   Web 主组件 (含低精力覆盖层)
├── storage.ts                 #   localStorage 实现 + 云同步
├── web-ticker.ts              #   setInterval 替代 chrome.alarms (委托 shared/ticker)
└── components/AuthPanel.tsx   #   登录面板 (thin wrapper → BaseAuthPanel)

shared/                        # 双端共享
├── types/index.ts             #   TypeScript 类型定义 (PomodoroTimer, AppState 等)
├── firebase.ts                #   Firebase 初始化 (懒初始化)
├── cloudSync.ts               #   CloudSyncService 接口 + Firebase 实现 (动态 import)
├── storage.ts                 #   StorageInterface 抽象 + 双向同步 + 迁移
├── logic.ts                   #   核心纯函数 (衰减/恢复/番茄完成/完美一天/日切)
├── ticker.ts                  #   共享 init/日切/tick 逻辑 (平台无关)
├── constants/actionMapping.ts #   actionId 集中映射 (BUILTIN_ACTION_ID/INFO)
├── utils/time.ts              #   时间工具
├── utils/pomoSubmit.ts        #   番茄钟提交共享逻辑
├── utils/migration.ts         #   迁移/格式转换 (migratePomodoro/migrateTaskDefs/logsTo/FromFirestore)
├── components/                #   MainDashboard, EnergyBar, PomodoroRing, TaskGrid, ActivityLog,
│                              #   StatsPage (lazy), LogBrowser, SettingsPage, TaskEditModal,
│                              #   RulesPage, MenuPanel, BaseAuthPanel, ErrorBoundary,
│                              #   DayResultModal
└── public/                    #   共享静态资源

tests/                         # 测试 (165 case)
├── logic.test.ts              #   核心逻辑单测 (36 case)
├── ticker.test.ts             #   共享 ticker 单测 (20 case)
├── pomoSubmit.test.ts         #   番茄提交单测 (8 case)
├── storage.test.ts            #   同步合并/迁移/Firestore 转换 (16 case)
├── utils.test.ts              #   时间工具 (13 case)
├── types.test.ts              #   类型结构验证 (8 case)
├── web_ui.test.ts             #   Puppeteer UI 自动化 (6 case)
├── background.test.ts         #   background tick handler (8 case)
└── components/                #   UI 组件测试 (36 case)
    ├── MainDashboard.test.tsx  #     打卡流程+庆祝/警告弹窗 (22 case)
    ├── PomodoroRing.test.tsx   #     番茄钟状态机 (5 case)
    ├── SettingsPage.test.tsx   #     设置页增删任务 (5 case)
    └── BaseAuthPanel.test.tsx  #     登录态切换 (5 case)
docs/                          # 项目文档
dist/                          # Chrome 扩展构建产物
dist-web/                      # Web 版构建产物
```

## Common Commands

```bash
npm run build             # 构建 Chrome 扩展到 dist/
npm run build:web         # 构建 Web 版到 dist-web/
npm run dev:web           # Web 版开发服务器 (port 3000)
npm run test              # 单元测试 + Puppeteer UI 测试 (165 case)
npm run lint              # ESLint
```

## Git 规范
- 每完成一个独立功能点立即 commit，不需要问我
- type: feat / fix / refactor / chore / docs
- 每个 commit 只做一件事

## 重要约束
- Firebase 配置只放 .env，绝不提交到 git
- .env.example 是模板文件，可以提交

## 架构决策记录 (ADR)

### ADR-001: 存储抽象层
- **决策**: 创建 `storage.ts` 统一接口，Chrome 扩展用 `chrome.storage.local`，Web 用 `localStorage`
- **原因**: 复用所有业务组件，仅切换底层存储实现
- **状态**: 已实现

### ADR-002: 自定义打卡事项
- **决策**: 新增 `CustomTaskDef[]` 类型，`Tasks` 改为动态索引签名 `{[key: string]: number | boolean | null}`
- **原因**: 用户需要自由增删打卡项（如去掉三餐、加臀桥），并设置恢复等级
- **内置任务**: 8 个默认任务 (sleep/exercise/meals/water/stretch/nap/meditate/poop)，可禁用不可删除
- **日志兼容**: 内置任务 actionId 0-7 不变，自定义任务从 100+ 开始
- **状态**: 已实现

### ADR-003: Web 版架构
- **决策**: 单一代码库，通过 Vite 多配置构建。Web 版复用 popup 组件，用 setInterval 替代 chrome.alarms
- **原因**: 最小改动量，组件完全复用
- **状态**: 已实现

### ADR-004: 三目录重构 (extension/ + web/ + shared/)
- **决策**: 将代码从 `src/` 拆分为 `shared/`（共享类型、Firebase、UI 组件）、`extension/`（Chrome 扩展入口 + chrome.storage）、`web/`（Web 入口 + localStorage + ticker）
- **原因**: 职责分离，`StorageInterface` 依赖注入取代运行时环境检测，各端独立构建
- **关键设计**: `MainDashboard` 和 `SettingsPage` 通过 props 接收 `storage: StorageInterface`
- **状态**: 已完成

### ADR-005: 精力计算规则（无 clamp）
- **核心原则**: 所有精力变化忠实累加，不设上下限，填写顺序不影响最终结果
- **日切**: `energy = maxEnergy`（长期上限，受完美一天/糟糕一天影响）
- **睡眠**: `energy -= maxEnergy × (8 - min(sleepHours, 8)) / 8`，直接扣减无下限
- **恢复**: 主食 +midHeal/次，小恢复 +smallHeal/次，直接加无上限
- **衰减**: tick 每分钟扣减，无 minEnergy 保底
- **运动**: healLevel='mid'，恢复中等精力
- **原因**: clamp 导致填写顺序影响结果（如先填吃饭再填睡眠 vs 反过来），去掉 clamp 让每笔变化可追踪
- **状态**: 已实现

### ADR-006: 完美一天动态判断
- **决策**: CustomTaskDef 新增 `countsForPerfectDay` 字段，完美一天结算基于该字段动态判断
- **原因**: 用户需要控制哪些任务计入完美一天
- **默认计入**: sleep, exercise, meals, water, nap, poop
- **默认不计入**: stretch, meditate
- **状态**: 已实现

### ADR-007: 双向云同步
- **决策**: 单一 `sync` 操作替代拉取/强制拉取/推送三操作。登录后自动同步，每 60 秒自动同步，登出前推送
- **原因**: 三操作心智负担重，强制拉取可能覆盖新数据，ticker 污染 lastUpdateTime 导致拉取判断失效
- **同步策略**: 双向合并（日志去重、任务取完成方、state 各字段分别取保守值），合并结果同时写入本地和云端
- **状态**: 已实现

### ADR-008: Chrome 扩展登录方案
- **决策**: 使用 `chrome.identity.launchWebAuthFlow` 获取 OAuth token，再通过 `signInWithCredential` 登入 Firebase。OAuth 在 background service worker 中执行，避免 popup 关闭中断
- **原因**: `signInWithPopup` 会加载外部脚本 (`apis.google.com`)，被 MV3 CSP 拦截
- **配置**: 需要 `VITE_GOOGLE_CLIENT_ID`（Firebase Console → Authentication → Google → Web SDK configuration）
- **权限**: manifest 添加 `identity` permission
- **状态**: 已实现（独立登录页已删除，改为 SyncPanel 内联）

### ADR-009: Email/Password 登录
- **决策**: 双端均支持 Google + Email/Password 两种登录方式
- **原因**: Google OAuth 在扩展端配置复杂（redirect URI 随 extension ID 变化），Email/Password 作为可靠备选
- **实现**: Firebase `signInWithEmailAndPassword` / `createUserWithEmailAndPassword`，无需额外 provider
- **前提**: Firebase Console 需启用 Email/Password 认证方式
- **状态**: 已实现

### ADR-010: 日志合并策略
- **决策**: `pullAndMerge` 改为日志合并策略（`timestamp|action` 去重 + 排序），状态取更新的一方
- **原因**: 原 Last-Write-Wins 整体覆盖会丢失另一端的日志记录
- **已知限制**: 同一秒内同类操作若 value/energyDiff 不同，会丢一条（当前 1 分钟 tick 间隔下极不可能）
- **状态**: 已实现

### ADR-011: 删除所有数据（dataResetAt 软删除）
- **决策**: 同步栏新增"删除数据"按钮，写入 `dataResetAt` 时间戳到 `StorageData`，各端忽略该时间戳之前的日志和统计
- **原因**: 多端本地缓存 + 自动同步导致硬删除无法彻底清除数据，时间戳软删除可跨设备生效
- **同步策略**: `dataResetAt` 取两端最大值；若不一致，state/tasks 取重置方版本；日志和 stats 按时间戳过滤
- **状态**: 已实现

### ADR-012: 番茄钟原子实例同步
- **决策**: `PomodoroState` 散装字段改为 `PomodoroTimer` 原子实例。`running`/`timeLeft` → `status('ongoing'|'idle')`，`timeLeft` 从 `startedAt` 实时推算。新增 `updatedAt` 字段，合并时取 `updatedAt` 更大的一方整体覆盖。`count`/`perfectCount` 拆到 `AppState`（`pomoCount`/`pomoPerfectCount`），继续用 `Math.max` 合并
- **原因**: 旧逻辑 `running = lp.running || cp.running` 导致一端停止/重置番茄钟后另一端同步不生效；Firestore `merge:true` 不删除 `undefined` 字段导致残留 `startedAt` 污染合并
- **迁移**: 各端 init 和 `syncFromCloud` 自动检测旧格式并转换
- **状态**: 已实现

### ADR-013: CloudSyncService 接口解耦 Firebase
- **决策**: 提取 `CloudSyncService` 接口（upload/download），Firebase 实现移到 `shared/cloudSync.ts`。`sync()`/`resetAllData()` 签名从 `uid: string` 改为 `cloud: CloudSyncService`
- **原因**: `shared/storage.ts` 直接 import Firebase 破坏共享层平台无关性，阻碍未来换后端（如 Supabase）或移动端扩展
- **附带**: Firestore SDK 改为 dynamic `import()`，首屏不加载
- **状态**: 已实现

### ADR-014: 完美一天奖励即时生效
- **决策**: 完美一天 maxEnergy +bonus 在打卡达成时立即生效，不再等日切。日切仅处理糟糕一天惩罚
- **原因**: 原逻辑日切时统一结算，导致完美一天日志记录的是"预测值"，若设置页修改 maxEnergy 则不准。即时生效更简单直观
- **实现**: MainDashboard 检测到完美一天 → 立即更新 state.maxEnergy 和 config.maxEnergy → 写入日志 "上限 x→y"
- **状态**: 已实现

### ADR-015: 删除 minEnergy，新增 lowEnergyThreshold
- **决策**: 删除 Config.minEnergy（未使用的死代码），新增 Config.lowEnergyThreshold（默认 20 点）用于低精力提醒
- **原因**: ADR-005 已确定"无下限"，minEnergy 无实际用途。低精力阈值原为硬编码 20，改为可配置
- **影响**: 设置页新增"低精力提醒阈值"配置项，精力条颜色也基于此阈值变色
- **状态**: 已实现

### ADR-016: 迁移工具函数提取到 shared/utils/migration.ts
- **决策**: logsToFirestore/logsFromFirestore/migratePomodoro/migrateTaskDefs 提取到 `shared/utils/migration.ts`，storage.ts 和 cloudSync.ts 统一 import
- **原因**: 原先 storage.ts 和 cloudSync.ts 各自维护一份相同代码，产生不一致风险。提取到独立模块避免循环依赖
- **状态**: 已实现

## Current Status
- [x] 插件基础功能 (MVP)
- [x] 节假日模式 + 日志压缩优化
- [x] 自定义打卡事项 (CustomTaskDef, 设置页管理 UI, 动态渲染)
- [x] Firebase 配置 + 存储抽象层 (storage.ts)
- [x] 三目录重构 (shared/ + extension/ + web/) + Vite 双构建配置
- [x] 登录/同步 UI (Firebase Auth + Firestore)
- [x] 废弃 src/ 目录，全面切换到新结构
- [x] 睡眠恢复新规则 + 每日 100% 恢复
- [x] countsForPerfectDay 完美一天动态判断
- [x] Web 去卡片样式 + 自动云同步
- [x] Chrome 扩展登录 + 云同步 (OAuth 在 background SW 执行)
- [x] 消除 conf/ 目录，构建配置归各端 + 根目录
- [x] 餐食惩罚改为分时段 (10:00/14:00/19:00)
- [x] ~~Chrome 扩展独立登录页~~ → 已删除，改为 SyncPanel 内联登录
- [x] Web 端低精力提醒 (当前页全屏覆盖)
- [x] 项目文档体系 (docs/PRD + TECH_DESIGN + UED + AGENT_PLAN)
- [x] 更新 README
- [x] Email/Password 登录 (双端 Google + 邮箱两种方式)
- [x] 日志合并策略 (pullAndMerge 从整体覆盖改为 timestamp+action 去重合并)
- [x] 双向同步重写 (单一 sync 替代拉取/强制拉取/推送)
- [x] 睡眠恢复修正 (不足时压低精力，去掉只升不降的保底)
- [x] 主页今日日志流 (数据统计按钮下方显示当日操作记录)
- [x] 删除所有数据 (dataResetAt 时间戳软删除，跨设备生效)
- [x] 番茄钟原子实例同步 (PomodoroTimer + updatedAt 整体覆盖，count 拆到 AppState)
- [x] 番茄钟重置按钮移除 (点击即 toggle 开始/停止)
- [x] 核心逻辑提取 shared/logic.ts (5 个纯函数)
- [x] 测试覆盖 23→156 case (逻辑/同步/时间/类型/ticker/pomoSubmit/Puppeteer UI/组件)
- [x] 代码优化: 提取共享 ticker/actionMapping/pomoSubmit/BaseAuthPanel，消除重复代码 ~500 行
- [x] Firebase 解耦: CloudSyncService 接口 + Firestore 动态 import，shared 层不直接依赖 Firebase
- [x] 大组件拆分: MainDashboard→4 子组件, SettingsPage→TaskEditModal, StatsPage→LogBrowser
- [x] StatsPage + Chart.js 懒加载 (React.lazy, 独立 chunk ~170KB)
- [x] ErrorBoundary 组件 + fetchData 错误处理
- [x] StorageInterface 重载消除 15 处 as StorageData 强转
- [x] UI 组件测试 36 case (MainDashboard/PomodoroRing/SettingsPage/BaseAuthPanel)
- [x] 完美一天庆祝弹窗 (最后一项打卡触发，撒花动效+🏆，点击关闭)
- [x] 糟糕一天警告弹窗 (sleep < 6 + exercise < 30 + 无完美番茄时触发)
- [x] 日切精力上限变动写入日志流 (完美一天 🏆/糟糕一天 ⚠️，显示"上限 X→Y")
- [x] 完美一天奖励即时生效 (打卡达成时立即 maxEnergy+1，不等日切)
- [x] 删除 minEnergy + 新增 lowEnergyThreshold 可配置 (默认 20 点)
- [x] 迁移工具提取 shared/utils/migration.ts (消除 storage/cloudSync 重复代码)
- [x] 图标统一 (nap→😴, poop→💩，DEFAULT_TASK_DEFS 与 BUILTIN_ACTION_INFO 一致)
- [x] 设置页日志改为 CompactLog 格式 (消除旧格式 {time, text} 写入)
- [x] 精力条右下角显示衰减速度 (含餐食惩罚标识)
- [x] 统计页今日精力图: 低精力红色虚线水位线 + 饭点 10/14/19 竖线标记
- [x] 完美一天进度可视化: 任务★标记 + 番茄钟完美数/4 进度

## 交付质量规范

基于 git log 复盘（50 commits 中 fix 占 50%），总结以下规范以减少 bug 和返工。

### 规则 1: 平台 API / 第三方服务先 PoC 再编码
- 涉及浏览器扩展 API、OAuth、Service Worker、Firestore 等平台特有能力时，**先写最小 PoC 跑通，再写正式代码**
- PoC 验证点：API 是否可用、CSP 限制、数据格式兼容性、权限要求
- 历史教训：OAuth 方案经历 4 次推翻重来（signInWithPopup → 独立登录页 → launchWebAuthFlow → getAuthToken）

### 规则 2: feat 前先列验收用例
- 每个 feat 开始前，列出 3-5 个关键验收 case（输入 → 期望输出），重点覆盖：
  - 边界值（0、空、超上限）
  - 多端差异（扩展 popup vs Web）
  - 多账号 / 空数据场景
- 在 commit message 或 PR 描述中体现
- 历史教训：睡眠恢复规则连续 3 个 fix，都是边界条件没提前对齐

### 规则 3: 核心逻辑必须有单测
- 优先覆盖纯函数 / 核心计算逻辑：
  - 精力计算（睡眠恢复、衰减、任务恢复）
  - 数据合并（pullAndMerge 的各种场景）
  - 序列化 / 反序列化（Firestore 兼容性）
- 测试成本低，防回归收益高

### 规则 4: 双端 UI 提交前检查
- 涉及布局改动时，commit 前在两端各验证一次：
  - `[ ]` 扩展 popup 320×600 下无溢出
  - `[ ]` Web 端宽屏 / 窄屏正常
- 历史教训：popup 尺寸和同步栏位置产生了 7 个 fix

### 规则 5: 与外部服务交互要真实读写验证
- Firestore、Chrome Storage 等外部存储，写完后跑一次真实读写再提交
- 不要只依赖本地 mock 通过
- 历史教训：Firestore 不支持嵌套数组，上线后才发现

## 重启后的标准起手式
请读取 CLAUDE.md 和最近的 git log，告诉我项目当前状态，然后继续上次未完成的任务

## 自我更新规则
每当发生以下情况，立即更新 CLAUDE.md 对应部分，不需要问我：
- 做了架构或方案决策
- 完成了一个功能模块
- 发现了重要的技术约束
- 讨论出了待解决的问题

# 每次对话开头
当前任务：xxx
完成标准：xxx
期间不接受新任务，除非我说"停"