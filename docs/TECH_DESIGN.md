# 精力管理可视化 - 技术设计文档

## 1. 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        用户界面层                                │
│  ┌──────────────────────┐     ┌──────────────────────────────┐  │
│  │   Chrome Extension   │     │         Web App              │  │
│  │  ┌────────────────┐  │     │  ┌────────────────────────┐  │  │
│  │  │ PopupApp.tsx   │  │     │  │ WebApp.tsx             │  │  │
│  │  │ (弹窗入口)     │  │     │  │ (网页入口)             │  │  │
│  │  └────────────────┘  │     │  └────────────────────────┘  │  │
│  │  ┌────────────────┐  │     │  ┌────────────────────────┐  │  │
│  │  │ FinishApp.tsx  │  │     │  │ AuthPanel.tsx          │  │  │
│  │  │ (全屏提醒)     │  │     │  │ (登录面板)             │  │  │
│  │  └────────────────┘  │     │  └────────────────────────┘  │  │
│  │  ┌────────────────┐  │     │                              │  │
│  │  │ SyncPanel.tsx  │  │     │                              │  │
│  │  │ (同步面板)     │  │     │                              │  │
│  │  └────────────────┘  │     │                              │  │
│  └──────────────────────┘     └──────────────────────────────┘  │
└────────────────────────────────┬────────────────────────────────┘
                                 │
┌────────────────────────────────┼────────────────────────────────┐
│                        共享组件层 (shared/components/)           │
│  ┌──────────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐   │
│  │MainDashboard │ │ StatsPage│ │RulesPage │ │SettingsPage  │   │
│  │(主面板)      │ │(统计页)  │ │(精力规则 │ │(设置页)      │   │
│  │              │ │          │ │+同步规则)│ │              │   │
│  └──────────────┘ └──────────┘ └──────────┘ └──────────────┘   │
│  ┌──────────────┐                                               │
│  │  MenuPanel   │                                               │
│  │ (侧边导航)   │                                               │
│  └──────────────┘                                               │
└────────────────────────────────┬────────────────────────────────┘
                                 │
┌────────────────────────────────┼────────────────────────────────┐
│                        存储抽象层                                │
│  ┌─────────────────────────────┴──────────────────────────┐     │
│  │              StorageInterface (shared/storage.ts)       │     │
│  │              get(keys) / set(data)                      │     │
│  └──────────┬──────────────────────────────┬──────────────┘     │
│             │                              │                     │
│  ┌──────────┴──────────┐     ┌─────────────┴───────────┐       │
│  │ chrome.storage.local│     │     localStorage         │       │
│  │ (extension/storage) │     │   (web/storage.ts)       │       │
│  └─────────────────────┘     └─────────────────────────┘       │
└────────────────────────────────┬────────────────────────────────┘
                                 │
┌────────────────────────────────┼────────────────────────────────┐
│                        后台引擎层                                │
│  ┌─────────────────────┐     ┌─────────────────────────┐       │
│  │ Service Worker       │     │ web-ticker.ts            │       │
│  │ (chrome.alarms)      │     │ (setInterval 60s)        │       │
│  │ - 精力衰减           │     │ - 精力衰减               │       │
│  │ - 日期翻转           │     │ - 日期翻转               │       │
│  │ - 番茄倒计时         │     │ - 番茄倒计时             │       │
│  │ - 低精力提醒(新标签) │     │ - 低精力提醒(当前页覆盖) │       │
│  │                      │     │ - 自动云同步(双向)       │       │
│  └─────────────────────┘     └─────────────────────────┘       │
└────────────────────────────────┬────────────────────────────────┘
                                 │
┌────────────────────────────────┼────────────────────────────────┐
│                       Firebase 云服务                            │
│  ┌─────────────────────┐     ┌─────────────────────────┐       │
│  │ Firebase Auth        │  │ Firestore            │  │ Hosting            │  │
│  │ - Google OAuth       │  │ - 用户数据存储        │  │ - Web 版静态托管    │  │
│  │ - Email/Password     │  │ - 跨设备双向同步      │  │ - SPA 路由重写      │  │
│  │ - 用户身份管理       │  │                       │  │                     │  │
│  └─────────────────────┘  └──────────────────────┘  └────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## 2. 技术栈选型

| 技术 | 版本 | 选型理由 |
|------|------|----------|
| React | 19 | 组件化开发，双端复用 UI 逻辑 |
| TypeScript | 5.9 | 严格类型检查，减少运行时错误 |
| Vite | 8 | 快速构建，支持多入口配置，Chrome 扩展友好 |
| Tailwind CSS | 3 | 原子类 CSS，组件内样式不冲突，构建体积小 |
| Firebase Auth | 12.x | Google 登录开箱即用，免服务端 |
| Firestore | 12.x | NoSQL 文档数据库，实时同步，免运维 |
| Chart.js | 4.x | 轻量图表库，满足折线图需求 |
| Lucide React | 1.x | 图标库，tree-shakable，体积小 |
| Chrome MV3 | - | 最新扩展标准，Service Worker 后台 |

## 3. 数据结构设计

### 3.1 本地存储结构 (StorageData)

```typescript
interface StorageData {
  config: Config
  taskDefs: CustomTaskDef[]
  state: AppState
  tasks: Tasks
  logs: CompactLog[]
  statsHistory: StatEntry[]
}
```

### 3.2 核心类型定义

```typescript
// 系统配置
interface Config {
  maxEnergy: number       // 精力上限 (默认 65)
  smallHeal: number       // 小恢复量 (默认 2)
  midHeal: number         // 中恢复量 (默认 5)
  bigHealRatio: number    // 大恢复比例 (默认 0.2, 按睡眠时长缩放)
  decayRate: number       // 每小时衰减量 (默认 4)
  penaltyMultiplier: number // 惩罚倍数 (默认 1.5)
  perfectDayBonus: number // 完美一天奖励 (默认 1)
  badDayPenalty: number   // 糟糕一天惩罚 (默认 1)
  lowEnergyThreshold: number  // 低精力提醒阈值 (默认 20)
}

// 每日状态
interface AppState {
  logicalDate: string     // 逻辑日期 "YYYY-MM-DD"
  energy: number          // 当前精力值
  maxEnergy: number       // 当日精力上限
  lastUpdateTime: number  // 最后更新时间戳
  lowEnergyReminded: boolean
  energyConsumed: number  // 当日总消耗
  pomoCount: number       // 今日番茄完成数 (合并时取 Math.max)
  pomoPerfectCount: number // 今日完美番茄数 (合并时取 Math.max)
  pomodoro: PomodoroTimer
}

// 番茄钟计时器 (原子同步，以 updatedAt 判定胜出方)
interface PomodoroTimer {
  status: 'ongoing' | 'idle'  // 运行状态 (timeLeft 由 startedAt 推算)
  startedAt: number | undefined // 开始时间戳 (idle 时为 undefined)
  updatedAt: number           // 最后更新时间戳 (用于原子合并)
  consecutiveCount: number    // 连续完成数 (与计时器原子绑定)
}

// 任务记录 (动态键值)
interface Tasks {
  [key: string]: number | boolean | null
}

// 自定义任务定义
interface CustomTaskDef {
  id: string              // 唯一标识 (内置: sleep/exercise/... 自定义: 自动生成)
  name: string            // 显示名称
  icon: string            // emoji 图标
  type: 'counter' | 'boolean' | 'number'
  healLevel: 'none' | 'small' | 'mid' | 'big'
  maxCount?: number       // counter 类型的上限
  unit?: string           // number 类型的单位
  placeholder?: string    // number 类型的占位文本
  builtin: boolean        // 是否内置任务
  enabled: boolean        // 是否启用
  countsForPerfectDay: boolean  // 是否计入完美一天
}

// 紧凑日志 [时间戳, 动作类型, 值, 精力变化]
type CompactLog = [number, number, number, number]

// 统计快照 (每日结算时记录)
interface StatEntry {
  date: string
  maxEnergy: number
  energyConsumed: number
  pomoCount: number
  perfectCount: number
}
```

### 3.3 Firestore Schema

```
Firestore Root
└── users (collection)
    └── {userId} (document)
        ├── config: Config
        ├── taskDefs: CustomTaskDef[]
        ├── state: AppState
        ├── tasks: Tasks
        ├── logs: {_t, _a, _v, _d}[]  // 对象数组，每个元素对应一条 CompactLog
        │                              // _t=timestamp, _a=action, _v=value, _d=energyDiff
        │                              // Firestore 不支持嵌套数组，改用对象数组存储
        ├── statsHistory: StatEntry[]
        └── dataResetAt: number | null // 软删除时间戳，该时间之前的数据视为已删除
```

**注意**: `logs` 字段在 Firestore 中以对象数组 `{_t, _a, _v, _d}[]` 存储，因为 Firestore 不原生支持嵌套数组。读写时通过 `logsToFirestore()` / `logsFromFirestore()` 转换。`dataResetAt` 用于跨设备软删除，同步时取两端最大值。

## 4. 跨端同步方案

### 4.1 同步策略

```
┌──────────────────────────────────────────────────┐
│                  同步时机                         │
├──────────────────────────────────────────────────┤
│ 登录成功     → 自动双向同步 (sync)               │
│ 每 60 秒     → 自动双向同步 (sync)               │
│ 登出前       → 自动推送                          │
│ 手动同步     → 双向合并 (sync)                   │
└──────────────────────────────────────────────────┘
```

### 4.2 双向合并逻辑 (sync)

单一 `sync()` 函数替代原先的 pullAndMerge / forcePull / syncToCloud 三操作。合并结果同时写入本地和云端。

**各字段合并规则:**

| 字段 | 合并策略 | 原因 |
|------|----------|------|
| `state.energy` | `Math.min(本地, 云端)` | 取保守值，防止精力虚高 |
| `state.energyConsumed` | `Math.max(本地, 云端)` | 消耗只增不减 |
| `state.pomoCount` | `Math.max(本地, 云端)` | 计数只增不减 |
| `state.pomoPerfectCount` | `Math.max(本地, 云端)` | 计数只增不减 |
| `state.pomodoro` | `updatedAt` 更大的一方胜出 | 计时器原子合并 |
| `logs` | `timestamp+action` 去重合并 + 排序 | 保留两端所有操作记录 |
| `tasks` | 逐字段取完成方 | 打卡只增不减 |
| `config` | 取更新时间晚的一方 | 配置整体替换 |
| `taskDefs` | 取更新时间晚的一方 | 定义整体替换 |
| `dataResetAt` | `Math.max(本地, 云端)` | 软删除跨设备生效 |

### 4.3 数据流

```
  本地操作 (打卡/番茄/衰减)
       │
       ▼
  更新本地存储 + 更新 lastUpdateTime
       │
       ▼ (每 60s / 手动点击 / 登录时)
  sync() ←→ Firestore users/{uid}
       │
       ▼
  读取本地 + 云端数据
       │
       ▼
  按字段分别合并 (energy→min, logs→去重, tasks→取完成方...)
       │
       ▼
  合并结果同时写入本地 + 云端
       │
       ▼
  刷新 UI
```

## 5. Firebase Auth 流程

### 5.1 Web 端登录

支持 Google 登录 + Email/Password 登录两种方式。

```
方式一: Google 登录
用户点击「Google 登录」→ signInWithPopup(auth, googleProvider)
       │
       ▼
方式二: Email/Password 登录
用户输入邮箱密码 → signInWithEmailAndPassword / createUserWithEmailAndPassword
       │
       ▼
Firebase 返回 UserCredential
       │
       ▼
保存 user.uid → 自动双向同步
       │
       ▼
启动自动同步定时器 (60s)
```

### 5.2 Chrome 扩展登录

支持 Google 登录 + Email/Password 登录两种方式。登录 UI 内联在 SyncPanel 中（无独立登录页）。

```
方式一: Google 登录
用户点击「Google 登录」
       │
       ▼
chrome.identity.getAuthToken({ interactive: true })
       │
       ▼
拿到 OAuth access_token
       │
       ▼
GoogleAuthProvider.credential(null, accessToken)
       │
       ▼
signInWithCredential(auth, credential)
       │
       ▼
方式二: Email/Password 登录
用户输入邮箱密码 → signInWithEmailAndPassword / createUserWithEmailAndPassword
       │
       ▼
Firebase 返回 UserCredential
       │
       ▼
保存 user.uid → 自动双向同步
       │
       ▼
启动自动同步定时器 (60s)
```

**为什么扩展不用 signInWithPopup?**
MV3 的 CSP 禁止加载外部脚本（`apis.google.com`），`signInWithPopup` 依赖该脚本，因此改用 `chrome.identity.getAuthToken` 获取 OAuth token。

## 6. 关键接口定义

### 6.1 StorageInterface

```typescript
interface StorageInterface {
  get(keys: string[] | null): Promise<Partial<StorageData>>
  set(data: Partial<StorageData>): Promise<void>
}
```

所有业务组件通过 props 接收 `storage: StorageInterface`，不直接依赖 chrome.storage 或 localStorage。

### 6.2 云同步函数

```typescript
// 双向同步 (本地 ←→ Firestore，按字段合并，结果同时写入两端)
async function sync(storage: StorageInterface): Promise<void>
// 内部逻辑:
// 1. 读取本地数据 + 云端数据
// 2. 按字段分别合并 (energy→Math.min, energyConsumed→Math.max,
//    pomoCount/pomoPerfectCount→Math.max, pomodoro→updatedAt wins,
//    logs→timestamp+action 去重, tasks→取完成方, dataResetAt→Math.max)
// 3. 合并结果同时写入本地存储 + Firestore
```

### 6.3 组件 Props 接口

```typescript
// MainDashboard
interface MainDashboardProps {
  data: StorageData
  storage: StorageInterface
  onOpenMenu: () => void
  onDataChange: () => void
  flat?: boolean           // true = 平铺样式 (Web), false = 卡片样式 (扩展)
}

// SettingsPage
interface SettingsPageProps {
  storage: StorageInterface
  onBack: () => void
}

// StatsPage
interface StatsPageProps {
  storage: StorageInterface
  onBack: () => void
}

// RulesPage
interface RulesPageProps {
  storage: StorageInterface
  onBack: () => void
}

// MenuPanel
interface MenuPanelProps {
  isOpen: boolean
  onClose: () => void
  onNavigate: (page: PageType) => void
}
```

### 6.4 后台 Tick 逻辑接口

```typescript
// 每分钟执行一次
async function tick(storage: StorageInterface): Promise<void>
// 内部逻辑:
// 1. 检测日期翻转 → 结算完美/糟糕一天（无日志则节假日豁免，不扣精力上限）
// 2. 精力衰减 → 计算 decay + 分时段餐食惩罚
//    (10:00 后未吃 1 餐 / 14:00 后未吃 2 餐 / 19:00 后未吃 3 餐 → 乘 penaltyMultiplier)
// 3. 番茄到期检测 → 检测完成/强制休息
// 4. 低精力检测 → 触发提醒

// 核心计算逻辑提取为纯函数 (shared/logic.ts):
function calculateDecay(config, tasks, minutesElapsed): number
function calculateRecovery(config, taskDef, value): number
function checkPomodoroExpired(pomodoro): boolean
function isPerfectDay(taskDefs, tasks, pomoPerfectCount): boolean
function calculateMaxEnergyDelta(config, taskDefs, tasks, pomoPerfectCount, logs): number
// 注: 仅处理糟糕一天惩罚，完美一天奖励在打卡时立即生效
```

## 7. 构建架构

### 7.1 项目根目录总览

```
项目根目录
├── extension/                 # Chrome 扩展端
│   ├── vite.config.ts         #   扩展 Vite 构建配置
│   ├── background/            #   Service Worker
│   ├── pages/popup/           #   弹窗入口
│   ├── pages/finish/          #   全屏提醒入口
│   ├── components/            #   SyncPanel 等扩展专属组件 (登录内联在 SyncPanel)
│   ├── storage.ts             #   chrome.storage.local 实现
│   └── public/manifest.json   #   Manifest V3
│
├── web/                       # Web 端
│   ├── vite.config.ts         #   Web Vite 构建配置
│   ├── WebApp.tsx             #   Web 版主组件
│   ├── main.tsx               #   React 入口
│   ├── index.html             #   HTML 模板
│   ├── storage.ts             #   localStorage 实现
│   ├── web-ticker.ts          #   setInterval 替代 chrome.alarms
│   └── components/            #   AuthPanel 等 Web 专属组件
│
├── shared/                    # 双端共享
│   ├── types/index.ts         #   TypeScript 类型定义
│   ├── firebase.ts            #   Firebase 初始化
│   ├── storage.ts             #   StorageInterface 抽象 + 云同步函数 (sync)
│   ├── logic.ts               #   纯计算逻辑 (calculateDecay, calculateRecovery, isPerfectDay 等)
│   ├── utils/time.ts          #   时间工具
│   ├── components/            #   MainDashboard, StatsPage, RulesPage, SettingsPage, MenuPanel
│   └── public/                #   共享静态资源 (图标等)
│
├── tests/                     # 测试 (165 cases)
│   ├── logic.test.ts          #   核心逻辑单测
│   ├── ticker.test.ts         #   共享 ticker 单测
│   ├── pomoSubmit.test.ts     #   番茄提交单测
│   ├── storage.test.ts        #   同步合并/迁移/Firestore 转换
│   ├── utils.test.ts          #   时间工具
│   ├── types.test.ts          #   类型结构验证
│   ├── web_ui.test.ts         #   Puppeteer UI 自动化
│   ├── background.test.ts     #   background tick handler
│   └── components/            #   UI 组件测试
│       ├── MainDashboard.test.tsx
│       ├── PomodoroRing.test.tsx
│       ├── SettingsPage.test.tsx
│       └── BaseAuthPanel.test.tsx
├── docs/                      # 项目文档
├── dist/                      # Chrome 扩展构建产物
├── dist-web/                  # Web 版构建产物
│
├── tsconfig.json              # TypeScript 根配置 (引用 app + node)
├── tsconfig.app.json          # 应用代码 (ES2023, strict, include: extension/ web/ shared/)
├── tsconfig.node.json         # Node 工具 (vite config 等)
├── tailwind.config.js         # Tailwind (扫描 extension/ web/ shared/)
├── postcss.config.js          # PostCSS
├── eslint.config.js           # ESLint
├── vitest.config.ts           # Vitest 测试
├── package.json               # 依赖 + 脚本
└── firebase.json              # Firebase Hosting 配置
```

### 7.2 Chrome 扩展构建

```
Vite (extension/vite.config.ts)
├── 入口:
│   ├── extension/pages/popup/index.html  → popup 页面
│   ├── extension/pages/finish/finish.html → finish 页面
│   └── extension/background/index.ts     → background.js
├── 输出: dist/
│   ├── background.js          (Service Worker)
│   ├── extension/pages/popup/index.html
│   ├── extension/pages/finish/finish.html
│   ├── assets/                (JS/CSS bundles)
│   └── manifest.json          (从 extension/public/ 复制)
└── 特殊处理:
    └── background 入口 → 不拆分 chunk，单文件输出
```

### 7.3 Web 版构建

```
Vite (web/vite.config.ts)
├── 入口: web/index.html
├── 输出: dist-web/
│   ├── index.html
│   └── assets/ (JS/CSS bundles)
└── 开发服务器: localhost:3000
```

### 7.4 npm 脚本

```bash
npm run build             # tsc + vite build --config extension/vite.config.ts → dist/
npm run build:web         # tsc + vite build --config web/vite.config.ts → dist-web/
npm run dev:web           # vite --config web/vite.config.ts (localhost:3000)
npm run deploy:web        # build:web + firebase deploy
npm run test              # vitest
npm run lint              # eslint
```
