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
├── components/SyncPanel.tsx   #   同步面板
└── public/manifest.json       #   Manifest V3

web/                           # Web 端
├── vite.config.ts             #   Web Vite 构建配置
├── WebApp.tsx                 #   Web 主组件 (含低精力覆盖层)
├── storage.ts                 #   localStorage 实现 + 云同步
├── web-ticker.ts              #   setInterval 替代 chrome.alarms
└── components/AuthPanel.tsx   #   登录面板

shared/                        # 双端共享
├── types/index.ts             #   TypeScript 类型定义
├── firebase.ts                #   Firebase 初始化
├── storage.ts                 #   StorageInterface 抽象
├── utils/time.ts              #   时间工具
├── components/                #   MainDashboard, StatsPage, RulesPage, SettingsPage, MenuPanel
└── public/                    #   共享静态资源

tests/                         # 测试
docs/                          # 项目文档
dist/                          # Chrome 扩展构建产物
dist-web/                      # Web 版构建产物
```

## Common Commands

```bash
npm run build             # 构建 Chrome 扩展到 dist/
npm run build:web         # 构建 Web 版到 dist-web/
npm run dev:web           # Web 版开发服务器 (port 3000)
npm run test              # 单元测试 (Vitest)
npm run test:ui           # UI 测试 (Puppeteer, 需先 build)
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

### ADR-005: 睡眠恢复规则
- **决策**: 睡眠设定当天精力起点，扣除已消耗部分。公式: `max(当前精力, maxEnergy × min(sleepHours/8, 1) - energyConsumed)`
- **原因**: 睡眠影响当日精力起点，但不能无视已消耗的精力。打卡越早恢复越多，避免晚打卡导致精力不合理地回满
- **状态**: 已实现

### ADR-006: 完美一天动态判断
- **决策**: CustomTaskDef 新增 `countsForPerfectDay` 字段，完美一天结算基于该字段动态判断
- **原因**: 用户需要控制哪些任务计入完美一天（如 stretch/meditate/poop 不计入）
- **默认计入**: sleep, exercise, meals, water
- **默认不计入**: stretch, nap, meditate, poop
- **状态**: 已实现

### ADR-007: 自动云同步
- **决策**: 登录后自动拉取云端数据，每 60 秒自动推送，登出前自动保存
- **原因**: 减少手动操作，保留手动拉取/推送按钮作为兜底
- **同步策略**: 拉取=日志合并+状态取更新方，强制拉取=云端覆盖本地，推送=本地覆盖云端
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