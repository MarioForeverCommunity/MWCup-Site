# Mario Worker 杯官网

Mario Worker 杯官方网站，覆盖**2012 年第一届至 2026 年第十五届赛事**的赛程浏览、评分查询、关卡搜索、数据统计与数据导出等能力。

网站采用 **Vue 3 + TypeScript + Vite** 构建，全部数据以静态文件形式存放在 `public/data/` 下，由前端工具函数负责读取、解析与计算，无需后端服务。

## 功能特性

### 🏆 赛事详览（`/matches`）
- 按届次与轮次浏览赛程安排、比赛试题与评分结果
- 轮次选择支持热身的 P1 至决赛的 F 全程，2013 年起附赛事 Wiki 链接
- 评分表支持按选手/评委搜索，并可将结果导出为 Excel（`.xlsx`）

### 📤 上传系统（`/upload`）
- 2022-2026 届：内嵌跳转至比赛系统页面
- 2012-2021 届：展示对应网盘（ysepan）地址与提取密码

### 🔍 关卡查询（`/levels`）
- 按选手名称、关卡关键词、文件类型检索历届参赛关卡文件
- 支持下载音乐包、预览关卡文件信息

### 📊 数据统计（`/stats`）
统计中心包含 7 个维度，通过 Tab 切换：
- **关卡排名**：单关排名、多关排名、原始得分率排名，支持按选手/关卡/届次/评分方案筛选，以及"仅高分（得分率 > 87%）"过滤
- **举办情况**：历届主办人、总评委、赛程、冠亚季军与上传地址
- **积分排行**：历届选手累计积分总榜，支持并列排名展示
- **选手战绩**：按选手聚合的参赛历史与最佳成绩
- **评委数据**：评委评分记录与统计
- **上传率**：各届各轮次的选手上传（出勤）统计
- **用户一览**：社区用户名与百度用户名映射管理

### 📜 规章标准（`/docs`）
- 以 Markdown 文档形式展示赛事规则、评分标准等，使用 `marked` 渲染

### 🃏 扑克周边（`/poker`）
- 2020 届扑克牌互动小工具（抽牌 / 多抽 / 是否包含大小王）

### 🧭 前往社区
- 站外链接，跳转至 Mario Forever 社区

## 技术栈

- **框架**: Vue 3（Composition API + `<script setup lang="ts">`）
- **语言**: TypeScript（严格模式，禁止 `any`）
- **构建**: Vite 8（gzip + brotli 压缩、terser 压缩、ES2022 目标、manualChunks 分包）
- **路由**: Vue Router 5
- **包管理器**: bun（请勿使用 npm / yarn / pnpm）
- **样式**: CSS3（CSS 变量 + 模块化文件，移动端 768px 断点）
- **数据处理**: decimal.js（数值精度）、js-yaml（YAML 解析）、papaparse（CSV 解析）、xlsx / xlsx-js-style（Excel 导出）、marked（Markdown 渲染）

## 快速开始

环境要求：已安装 [bun](https://bun.sh)（≥1.x）。

```bash
# 安装依赖
bun install

# 启动开发服务器（HMR，监听 0.0.0.0）
bun run dev

# 构建生产版本（先跑 vue-tsc 类型检查，再 vite build）
bun run build

# 本地预览生产构建
bun run preview

# 代码检查（ESLint，自动修复）
bun run lint

# 部署到生产服务器（git pull + build + rsync）
bun run deploy
```

> 注意：`bun run build` 会先执行类型检查（`vue-tsc -b`），随后执行 `vite build`，因此提交前建议先跑 `lint` 再跑 `build` 以完成质量校验。

## 项目结构

```
src/
├── components/    # Vue 单文件组件（PascalCase）
├── router/        # Vue Router 路由配置（index.ts）
├── styles/        # 样式模块（style / theme / components / layout / animations）
├── types/         # TypeScript 类型定义与类型守卫
├── utils/         # 数据加载、解析与计算工具
├── App.vue        # 根组件（侧边栏导航 + 版本与构建时间展示）
└── main.ts        # 应用入口（挂载路由与全局样式）
public/data/       # 全部静态数据（CSV / JSON / YAML / Markdown）
scripts/           # 构建辅助脚本（generateLevelIndex.js）
```

### 组件一览（`src/components/`）

| 组件 | 职责 |
|------|------|
| `RoundSelector.vue` | 赛事详览页：届次/轮次选择，组合赛程表、试题与评分表 |
| `ScheduleTable.vue` | 赛程表（含比赛/投票截止时间、Wiki 链接） |
| `SubjectDisplay.vue` | 比赛试题展示 |
| `ScoreTable.vue` | 评分数据表（搜索 + Excel 导出） |
| `UploadSystem.vue` | 上传系统（比赛系统 iframe / 网盘链接 + 密码） |
| `LevelFileSearch.vue` | 关卡文件搜索页 |
| `StatsAnalysis.vue` | 数据统计 Tab 容器 |
| `RankingModule.vue` | 单关 / 多关 / 原始得分率排名与筛选 |
| `ChampionStatistics.vue` | 举办情况（历届冠亚季军等） |
| `TotalPointsRanking.vue` | 积分排行 |
| `PlayerRecords.vue` | 选手战绩 |
| `JudgeRecords.vue` | 评委数据 |
| `AttendanceStats.vue` | 上传率（出勤率）统计 |
| `UserManagement.vue` | 用户一览（用户名映射管理） |
| `DocumentDisplay.vue` | 规章标准（Markdown 渲染） |
| `PokerTable.vue` | 2020 届扑克牌小工具 |
| `FoldButton.vue` | 折叠/展开按钮（通用交互） |

### 工具模块一览（`src/utils/`）

| 模块 | 职责 |
|------|------|
| `yamlLoader.ts` | 加载并缓存 `mwcup.yaml`，归一化帖子链接 ID |
| `scoreCalculator.ts` | **评分计算核心**：解析各轮次评分 CSV，支持 A-F/S 全部方案 |
| `rankingCalculator.ts` | 单关/多关/原始得分率排名计算 |
| `totalPointsCalculator.ts` | 积分排行计算（含 2019 及 2020+ 特殊规则） |
| `dataAnalyzer.ts` | 选手战绩、评委数据、上传率分析（含统一用户标识） |
| `userDataProcessor.ts` | 用户数据处理（users.csv 解析与索引、战绩类型与辅助函数） |
| `userMapper.ts` | 用户显示名映射（users.csv） |
| `scheduleHelper.ts` | 赛程数据组装、截止时间与评分可见性判断 |
| `roundNames.ts` | 轮次中文名映射（P/I/G/R/S/F 等） |
| `editionHelper.ts` | 届次计算与届次选项（2012=第一届） |
| `urlMap.ts` | 分届上传 URL 映射（2022+ 比赛系统 / 2012-2021 网盘 + 密码） |
| `levelFileHelper.ts` | 关卡索引读取与关键词/选手搜索 |
| `levelMatcher.ts` | 关卡文件与选手数据的匹配（精确/模糊/置信度） |
| `preliminaryValidInfoHelper.ts` | 初赛有效关卡信息获取 |
| `resultFormatter.ts` | 比赛结果文字格式化（晋级/名次等） |

### 类型定义（`src/types/`）

- `mwcup.ts`：核心领域类型与类型守卫（选手/评委数据、轮次配置、赛季数据等）
- `ranking.ts`：排名相关类型
- `poker.ts`：扑克牌类型与展示工具
- `xlsx-js-style.d.ts`：xlsx-js-style 类型声明补全
- `NoSubmissionRecord.d.ts`：为 `ScoreRecord` 扩展"未提交"标记

## 路由

| 路径 | 组件 | 说明 |
|------|------|------|
| `/` | - | 重定向到 `/matches` |
| `/matches` | `RoundSelector` | 赛事详览（默认届次） |
| `/matches/:year` | `RoundSelector` | 指定届次 |
| `/matches/:year/:round` | `RoundSelector` | 指定届次 + 轮次 |
| `/upload`、`/upload/:year` | `UploadSystem` | 上传系统 |
| `/levels` | `LevelFileSearch` | 关卡查询 |
| `/stats` | `StatsAnalysis` | 数据统计（默认单关排名） |
| `/stats/ranking/:type` | `RankingModule` | 排名（single/multi/original） |
| `/stats/totalpoints/:year` | `TotalPointsRanking` | 积分排行 |
| `/stats/:stat` | `StatsAnalysis` | 其他统计 Tab |
| `/docs`、`/docs/:doc` | `DocumentDisplay` | 规章标准 |
| `/poker` | `PokerTable` | 扑克周边 |

## 数据流

所有数据均以静态文件存放，采用**无全局状态管理**（无 Pinia/Vuex）的架构：

```
public/data/ 静态文件
      │  fetch 加载
      ▼
src/utils/ 工具函数（解析 + 计算，模块内缓存）
      │  返回类型化数据
      ▼
src/components/ Vue 组件渲染（组件间通过路由 props 传递）
```

各工具模块普遍采用"缓存值 + 进行中的 Promise"双缓存模式，避免并发重复请求与重复解析，例如 `yamlLoader.ts` 与 `scoreCalculator.ts`。

## 数据源（`public/data/`）

- `mwcup.yaml` - 比赛配置（届次、评分方案、轮次、选手/评委、赛程链接）
- `maxScore.json` - 各轮次满分配置（基础分 + 加分）
- `scores/*.csv` - 各轮次评委评分数据
- `votes/*.csv` - 各轮次大众评分数据
- `subjects/*.md` - 比赛试题
- `docs/*.md` - 赛事规章文档
- `levels/` - 关卡文件；`levels/index.json` 为索引（**由 `scripts/generateLevelIndex.js` 本地生成，不入库**）
- `specialLevels.json` - 特殊关卡文件名 → 选手码映射
- `levelSubjects.json` - 关卡对应题目映射（2026 年及以后）
- `poker2020.csv` - 2020 届扑克牌数据
- `users.csv` - 用户列表（用于统一不同平台用户名）

## 构建与部署

- **压缩**: gzip（level 9）+ brotli（quality 11），阈值 5120 字节
- **分包**: `manualChunks` 划分 vue-vendor / xlsx-vendor / data-vendor / ui-vendor
- **压缩**: terser 剥离 `console` 与 `debugger`
- **构建时间**: 通过 `define` 注入 `BUILD_TIME`，在侧边栏底部展示
- **部署**（`deploy.sh`）: `git pull` → `bun install` → `bun run build` → `rsync` 同步 `dist/` 至 `/data/wwwroot/mwcup.marioforever.net/`

## 相关文档

- [AGENTS.md](./AGENTS.md) - AI 编码助手约定（架构细节、代码风格、评分方案、特殊规则）

## 协议

MIT License
