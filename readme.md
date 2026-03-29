# 精力管理可视化

Chrome 扩展 + Web 双端应用。基于 React + Vite + Tailwind CSS，通过游戏化方式追踪身体精力与思维精力，支持 Firebase 跨设备同步。

**设计灵感来源于《精力管理》(The Power of Full Engagement)**：
> "管理精力，而非时间。一小时精神涣散的加班，产出远远比不上 20 分钟心流状态的极速冲刺。"

## 核心功能

- **精力条系统** — 实时精力值显示，自然衰减 + 分时段餐食惩罚（10:00/14:00/19:00），低精力全屏警告
- **打卡任务** — 8 个内置任务（睡眠/运动/三餐/饮水/拉伸/午睡/冥想/肠道管理）+ 自定义任务，打卡恢复精力
- **番茄钟** — 25 分钟专注计时，完成后评分 0-100%，连续 3 个强制休息
- **长期成长** — 完美一天 maxEnergy+1 / 糟糕一天 maxEnergy-1 / 节假日豁免
- **跨设备同步** — Google 登录，自动拉取/推送，Last-Write-Wins 策略
- **统计分析** — maxEnergy / 消耗量 / 番茄数趋势图 + 操作日志

## 技术栈

| 技术 | 用途 |
|------|------|
| React 19 + TypeScript | 组件化 UI，严格类型 |
| Vite 8 | 双端构建（扩展 + Web） |
| Tailwind CSS 3 | 原子类样式 |
| Firebase Auth + Firestore | Google 登录 + 云同步 |
| Chart.js | 统计图表 |
| Chrome Manifest V3 | 扩展标准，Service Worker 后台 |
| Vitest + Puppeteer | 单元测试 + UI 自动化 |

## 目录结构

```
extension/                     # Chrome 扩展端
├── vite.config.ts             #   扩展 Vite 构建配置
├── background/index.ts        #   Service Worker (衰减/番茄/日期翻转)
├── storage.ts                 #   chrome.storage.local 实现 + 云同步
├── pages/popup/               #   弹窗入口
├── pages/login/               #   登录页
├── pages/finish/              #   全屏提醒页
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
docs/                          # 项目文档 (PRD/技术设计/交互设计/Agent规划)
```

## 快速开始

### 环境要求

- Node.js v18+
- Firebase 项目（用于云同步，可选）

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env`，填入 Firebase 配置：

```bash
cp .env.example .env
```

### 3. Chrome 扩展

```bash
npm run build
```

在 Chrome 访问 `chrome://extensions/`，开启开发者模式，加载 `dist/` 目录。

### 4. Web 版

```bash
npm run dev:web           # 开发服务器 localhost:3000
npm run build:web         # 构建到 dist-web/
npm run deploy:web        # 部署到 Firebase Hosting
```

## 常用命令

```bash
npm run build             # 构建 Chrome 扩展 → dist/
npm run build:web         # 构建 Web 版 → dist-web/
npm run dev:web           # Web 开发服务器
npm run test              # 单元测试 (Vitest)
npm run test:ui           # UI 测试 (Puppeteer, 需先 build)
npm run lint              # ESLint
```

## 双端差异

| 维度 | Chrome 扩展 | Web 版 |
|------|------------|--------|
| 入口 | 浏览器工具栏弹窗 | 独立网页 |
| 后台 | Service Worker + chrome.alarms | setInterval (web-ticker) |
| 存储 | chrome.storage.local + Firebase | localStorage + Firebase |
| 登录 | chrome.identity OAuth | Firebase signInWithPopup |
| 提醒 | 新开标签页 | 当前页全屏覆盖 |

## 存储效率

日志采用压缩 Tuple 结构 `[时间戳, 动作ID, 数值, 精力变化]`，单条仅 ~26 Bytes。5MB 本地存储可支撑 **23+ 年**日常使用。
