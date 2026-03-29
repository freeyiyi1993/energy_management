# QA Report - 目录重构

## 任务 1：消除 conf/ 目录

### 移动的文件

| 原路径 | 新路径 | 路径调整 |
|--------|--------|----------|
| conf/vite.extension.config.ts | extension/vite.config.ts | publicDir、postcss、outDir、rollupOptions.input 改为相对于 extension/ |
| conf/tsconfig.json | tsconfig.json | references 路径不变（已在同级） |
| conf/tsconfig.app.json | tsconfig.app.json | tsBuildInfoFile 从 `../node_modules` 改为 `./node_modules`；include 从 `../extension` 等改为 `extension` 等 |
| conf/tsconfig.node.json | tsconfig.node.json | include 从 `vite.config.ts` 改为 `extension/vite.config.ts, web/vite.config.ts, vitest.config.ts` |
| conf/tailwind.config.js | tailwind.config.js | content 路径不变（已是 `./extension/` 等相对根目录路径） |
| conf/postcss.config.js | postcss.config.js | tailwindcss config 从 `conf/tailwind.config.js` 改为 `tailwind.config.js` |
| conf/eslint.config.js | eslint.config.js | 无路径变更 |
| conf/vitest.config.ts | vitest.config.ts | 移除 `__dirname` 手动计算，移除 `root` 配置（默认即为项目根目录） |

### 更新的引用文件

- **package.json** - 5 处脚本路径更新：
  - `build`: `conf/tsconfig.app.json` -> `tsconfig.app.json`, `conf/vite.extension.config.ts` -> `extension/vite.config.ts`
  - `build:web`: `conf/tsconfig.app.json` -> `tsconfig.app.json`
  - `lint`: `conf/eslint.config.js` -> `eslint.config.js`
  - `test`: `conf/vitest.config.ts` -> `vitest.config.ts`
- **web/vite.config.ts** - postcss 路径从 `../conf/postcss.config.js` 改为 `../postcss.config.js`

### 删除

- `conf/` 目录整体删除

## 任务 2：创建 shared/public/

- 创建了 `shared/public/` 目录
- `extension/public/` 中仅有 `manifest.json`（Chrome 扩展专属配置），无共享静态资源需要移动
- shared/public/ 作为空目录就绪，待后续添加共享图标等资源

## 验证结果

| 命令 | 结果 |
|------|------|
| `npm run build` | PASS - 扩展构建成功，输出到 dist/ |
| `npm run build:web` | PASS - Web 构建成功，输出到 dist-web/ |
| `npm run test` | PASS - 1 test file, 3 tests passed |
