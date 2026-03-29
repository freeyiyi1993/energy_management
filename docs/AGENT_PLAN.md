# 多 Agent 任务规划

## 概述

本项目已是一个功能完整的应用，当前阶段的主要任务是**维护、优化和新功能开发**。以下按模块划分 Agent 职责，便于并行开发。

> 注意：本项目当前状态已实现 PRD 中列出的全部核心功能。以下规划面向**后续迭代**中可能的新任务。

## 1. Agent 划分

### CTO: 主 Agent

**职责**: 全局协调、任务分发、冲突管理、项目文档维护

**文件边界** (可修改):
- `README.md`
- `CLAUDE.md`
- `status/` 目录

**工作内容**:
1. 将需求拆解为子任务，分发给对应 Agent
2. 所有 Agent 完成后，检查 `status/` 目录
3. 识别有交叉修改的文件，按优先级解决冲突
4. 运行完整构建 (`npm run build && npm run build:web`)
5. 运行测试 (`npm run test`)
6. 更新 README.md (项目说明、使用方式、目录结构等)
7. 更新 CLAUDE.md (状态、ADR 等)

**冲突优先级**:
- 类型定义 / 存储接口: 以 backend 为准
- UI 组件: 以 frontend 为准
- 平台代码: 以对应平台 Agent 为准

---

### backend: 后端

**职责**: 共享类型定义、存储接口、Firebase 配置、工具函数、后台引擎逻辑 (Service Worker / web-ticker)

**文件边界** (可修改):
- `shared/types/index.ts`
- `shared/storage.ts`
- `shared/firebase.ts`
- `shared/utils/time.ts`
- `extension/background/index.ts` (Service Worker tick 逻辑)
- `extension/storage.ts` (chrome.storage 实现 + 云同步)
- `web/storage.ts` (localStorage 实现 + 云同步)
- `web/web-ticker.ts` (Web 端 tick 逻辑)

**禁止动的文件**:
- 所有 `.tsx` UI 组件文件
- 根目录配置文件

**典型任务**:
- 新增/修改数据类型
- 修改存储接口及双端实现
- 衰减/番茄/日期翻转等后台逻辑
- 云同步策略调整

---

### frontend: 前端

**职责**: 所有共享 UI 组件的开发和修改

**文件边界** (可修改):
- `shared/components/MainDashboard.tsx`
- `shared/components/MenuPanel.tsx`
- `shared/components/RulesPage.tsx`
- `shared/components/StatsPage.tsx`
- `shared/components/SettingsPage.tsx`
- `shared/public/` (共享静态资源)

**禁止动的文件**:
- `shared/types/index.ts` (需要改类型时通知 backend)
- `extension/` 下所有文件
- `web/` 下所有文件

**依赖**: backend (类型变更后 frontend 才能使用新类型)

**典型任务**:
- UI 布局调整
- 新增 UI 功能（如新图表、新交互）
- 样式修改
- 规则说明页更新

---

### extension: Chrome 扩展端

**职责**: Chrome 扩展专属 UI —— 弹窗入口、登录页、全屏提醒页、同步面板

**文件边界** (可修改):
- `extension/pages/popup/PopupApp.tsx`
- `extension/pages/popup/main.tsx`
- `extension/pages/popup/index.html`
- `extension/pages/login/` (登录页)
- `extension/pages/finish/FinishApp.tsx`
- `extension/components/SyncPanel.tsx`
- `extension/public/manifest.json`

**禁止动的文件**:
- `shared/` 下所有文件 (需要改共享代码时通知 backend/frontend)
- `web/` 下所有文件
- `extension/background/index.ts` (归 backend)
- `extension/storage.ts` (归 backend)
- 根目录配置文件

**依赖**: backend (存储接口), frontend (UI 组件)

**典型任务**:
- 扩展页面入口组件修改
- 登录页/同步面板 UI
- manifest 权限调整

---

### web-app: Web 端

**职责**: Web 版专属 UI —— 入口组件、认证面板

**文件边界** (可修改):
- `web/WebApp.tsx`
- `web/main.tsx`
- `web/index.html`
- `web/components/AuthPanel.tsx`

**禁止动的文件**:
- `shared/` 下所有文件
- `extension/` 下所有文件
- `web/storage.ts` (归 backend)
- `web/web-ticker.ts` (归 backend)
- 根目录配置文件

**依赖**: backend (存储接口), frontend (UI 组件)

**典型任务**:
- Web 页面入口组件修改
- AuthPanel UI 修改

---

### qa: 质量保障

**职责**: 构建配置、测试、代码质量、依赖管理

**文件边界** (可修改):
- `extension/vite.config.ts`
- `web/vite.config.ts`
- `tsconfig.json` / `tsconfig.app.json` / `tsconfig.node.json`
- `tailwind.config.js`
- `vitest.config.ts`
- `postcss.config.js`
- `eslint.config.js`
- `tests/` 下所有文件
- `package.json`

**禁止动的文件**:
- 所有业务代码 (shared/ extension/ web/ 中非配置文件)

**典型任务**:
- 新增/修改测试用例
- 构建配置调整
- 依赖升级
- lint 规则维护

---

## 2. 执行顺序与并行策略

```
阶段 1 (并行):
┌───────────┐  ┌───────────┐
│ backend   │  │ qa        │
│ 后端      │  │ 质量保障  │
└─────┬─────┘  └───────────┘
      │
阶段 2 (等 backend 完成后并行):
      │
      ├──────────────┬───────────────┐
      ▼              ▼               ▼
┌───────────┐ ┌───────────┐ ┌───────────┐
│ frontend  │ │ extension │ │ web-app   │
│ 前端      │ │ 扩展端    │ │ Web 端    │
└───────────┘ └───────────┘ └───────────┘

阶段 3 (所有 Agent 完成后):
┌──────────────────────────┐
│ CTO (主 Agent)           │
│ - 冲突检测与解决          │
│ - 集成测试               │
│ - 更新 README.md         │
│ - 更新 CLAUDE.md         │
└──────────────────────────┘
```

**规则**:
- backend 和 qa 可以并行启动（无依赖）
- frontend / extension / web-app 必须等 backend 完成（依赖类型定义和存储接口）
- 如果任务不涉及类型变更，frontend / extension / web-app 可以与 backend 并行
- qa 可以在任意阶段独立运行

## 3. 共享文件处理策略

### 3.1 类型与存储 (`shared/types/`, `shared/storage.ts`)

- **唯一修改者**: backend
- **其他 Agent 需要新类型/接口**: 通过 status 文件通知 backend
- **合并策略**: 只由 backend 修改，无冲突风险

### 3.2 双端存储实现 (`extension/storage.ts`, `web/storage.ts`)

- **唯一修改者**: backend
- **extension / web-app 不碰这两个文件**
- 接口变更由 backend 统一处理

### 3.3 后台引擎 (`extension/background/`, `web/web-ticker.ts`)

- **唯一修改者**: backend
- 衰减、番茄、日期翻转等核心逻辑统一管理

### 3.4 共享组件 (`shared/components/`)

- **唯一修改者**: frontend
- **Props 变更**: frontend 修改 Props → extension / web-app 同步更新调用方

### 3.5 构建配置

- **Vite 配置**: qa 负责 `extension/vite.config.ts` 和 `web/vite.config.ts`
- **根目录配置** (tsconfig / tailwind / eslint / vitest): qa 统一管理

## 4. 提交规范

每个 Agent 完成一个独立功能点后**必须立即 commit**，不要攒到最后批量提交。

**规则**:
- commit message 格式: `type: 简要描述`（type: feat / fix / refactor / chore / docs）
- 每个 commit 只做一件事
- 先确认构建通过 (`npm run build` 或 `npm run build:web`) 再提交
- CTO 不负责替子 Agent 补提交

## 5. 状态汇报机制

每个 Agent 完成任务后，在 `status/` 目录写入汇报文件:

```
status/
├── backend.md      # 后端完成情况
├── frontend.md     # 前端完成情况
├── extension.md    # Chrome 扩展端完成情况
├── web-app.md      # Web 端完成情况
└── qa.md           # 质量保障完成情况
```

**汇报格式**:
```markdown
# [Agent 名] 完成报告

## 修改的文件
- file1.ts: 修改说明
- file2.tsx: 修改说明

## 新增的文件
- file3.ts: 用途说明

## 依赖变更
- 是否修改了接口/类型: 是/否
- 影响范围: 哪些 Agent 需要同步

## 测试状态
- 单元测试: 通过/未通过
- 构建: 通过/未通过

## 遗留问题
- (如有)
```
