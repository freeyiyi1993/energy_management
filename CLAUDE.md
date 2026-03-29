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
shared/                       # 双端共享代码
├── types/index.ts            # TypeScript 接口 + CustomTaskDef + PageType
├── firebase.ts               # Firebase 初始化 (auth, db, googleProvider)
├── storage.ts                # StorageInterface 定义 + Firebase 云同步函数
├── utils/time.ts             # Time parsing utility
└── components/               # 共享 UI 组件 (MainDashboard, MenuPanel, RulesPage, StatsPage, SettingsPage)

extension/                    # Chrome 扩展专属代码
├── background/index.ts       # Service Worker: alarms, energy decay, day rollover
├── storage.ts                # chrome.storage.local 实现 StorageInterface
├── public/manifest.json      # Manifest V3 (构建时复制到 dist/)
└── pages/
    ├── popup/                # 扩展弹窗入口 (PopupApp.tsx, main.tsx, index.html)
    └── finish/               # 全屏提醒页 (FinishApp.tsx)

web/                          # Web 独立版专属代码
├── WebApp.tsx                # Web 版主组件
├── main.tsx                  # React 入口
├── index.html                # HTML 模板
├── storage.ts                # localStorage 实现 StorageInterface
├── web-ticker.ts             # setInterval 替代 chrome.alarms
├── vite.config.ts            # Web 版 Vite 配置
└── components/AuthPanel.tsx  # 登录/同步 UI

conf/                         # Build configs (vite, tsconfig, tailwind, vitest, postcss, eslint)
tests/                        # Unit tests + UI automation tests
dist/                         # Chrome 扩展构建产物
dist-web/                     # Web 版构建产物
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
- **决策**: 8h 标准恢复到精力上限，<8h 等比扣除当日 maxEnergy，>8h 无额外奖励
- **原因**: 睡眠直接影响当日精力上限，比固定比例恢复更贴近真实体感
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
- **同步策略**: 拉取=时间戳比较取新，强制拉取=云端覆盖本地，推送=本地覆盖云端
- **状态**: 已实现

### ADR-008: Chrome 扩展登录方案
- **决策**: 在新 tab 中打开独立登录页（auth page），使用标准 `signInWithPopup`
- **原因**: popup 中无法直接 `signInWithPopup`（弹窗导致 popup 关闭）；不依赖 `chrome.identity` API 和 OAuth Client ID
- **原理**: 扩展页面和 popup 共享 `chrome-extension://ID/` origin，Firebase Auth 通过 IndexedDB 自动共享登录状态
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
- [x] Chrome 扩展登录 + 云同步 (auth tab + SyncPanel)
- [ ] 更新 README

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