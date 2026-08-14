# AGENTS.md

在此代码库中工作的 AI 编码助手的约定。本文档面向所有在本仓库中编写、修改代码的 AI 助手，包含项目架构、数据流、代码风格、评分方案与特殊规则。

## 应用概述

Mario Worker 杯官网 — 一个关卡设计比赛的官方网站，覆盖**2012 年第一届至 2026 年第十五届的赛事**。核心功能：赛程浏览、评分查询、关卡搜索、统计排名（单关/多关/积分/选手战绩/评委数据/上传率/用户一览）、数据导出（Excel）。

**数据流**: `public/data/` 静态文件 → `src/utils/` 工具函数（fetch + 解析 + 计算）→ `src/components/` Vue 组件渲染。**无全局状态管理**（无 Pinia/Vuex），数据在组件本地管理，通过路由 props 传递。

**测试**: 无测试框架。质量保证依赖 TypeScript 编译检查 + ESLint。验证顺序为 `lint` → `build`（build 内含 `vue-tsc -b` 类型检查）。

**自定义脚本**: `scripts/generateLevelIndex.js` 扫描 `public/data/levels/` 并匹配 YAML 元数据，生成 `levels/index.json`（该文件在 .gitignore 中，需本地生成）。

## 技术栈

- **框架**: Vue 3 (Composition API, `<script setup lang="ts">`)
- **语言**: TypeScript (严格模式)
- **构建**: Vite 8（gzip/brotli 压缩、terser 压缩、ES2022 目标、manualChunks 分包）
- **路由**: Vue Router 5
- **包管理器**: bun — 不要使用 npm/yarn/pnpm
- **样式**: CSS (CSS 变量 + 模块化文件)
- **数据处理**: js-yaml, papaparse, xlsx, xlsx-js-style, decimal.js, marked

## 命令

```bash
bun run dev        # 开发服务器 (HMR, host 0.0.0.0)
bun run build      # 类型检查 (vue-tsc -b) 然后 vite build
bun run preview    # 预览生产构建
bun run lint       # ESLint 带 --fix
bun run deploy     # 部署到生产服务器 (bash deploy.sh)
```

**验证顺序**: `lint` → `build` (包含类型检查)

## 项目结构

```
src/
├── components/    # Vue 单文件组件 (PascalCase: ScoreTable.vue)
├── router/        # Vue Router 路由配置 (index.ts)
├── styles/        # CSS 模块 (style, theme, components, layout, animations)
├── types/         # TypeScript 接口/类型 + 类型守卫
├── utils/         # 数据加载、解析、计算工具
├── App.vue        # 根组件（侧边栏导航 + 版本与构建时间展示）
└── main.ts        # 应用入口
public/data/       # 静态数据 (CSV, JSON, YAML, Markdown)
scripts/           # 构建脚本 (generateLevelIndex.js)
```

### 组件职责（`src/components/`）

| 组件 | 职责 |
|------|------|
| `App.vue` | 侧边栏导航（赛事详览/上传系统/关卡查询/数据统计/规章标准/扑克周边/前往社区）、移动端适配、返回顶部、版本与构建时间显示 |
| `RoundSelector.vue` | 赛事详览页：届次/轮次选择（含 Wiki 链接），组合 ScheduleTable + SubjectDisplay + ScoreTable |
| `ScheduleTable.vue` | 赛程表（含比赛/投票截止时间、Wiki 链接） |
| `SubjectDisplay.vue` | 比赛试题展示 |
| `ScoreTable.vue` | 评分数据表（选手/评委搜索 + Excel 导出） |
| `UploadSystem.vue` | 上传系统（2022+ 比赛系统 iframe / 2012-2021 网盘链接 + 密码） |
| `LevelFileSearch.vue` | 关卡文件搜索页 |
| `StatsAnalysis.vue` | 数据统计 Tab 容器（ranking/holding/totalpoints/players/judges/attendance/users） |
| `RankingModule.vue` | 单关/多关/原始得分率排名 + 筛选（选手/关卡/届次/方案 A-F/仅高分 87%） |
| `ChampionStatistics.vue` | 举办情况（主办人/总评委/赛程/冠亚季军/上传地址） |
| `TotalPointsRanking.vue` | 积分排行（并列排名） |
| `PlayerRecords.vue` | 选手战绩 |
| `JudgeRecords.vue` | 评委数据 |
| `AttendanceStats.vue` | 上传率（出勤率）统计 |
| `UserManagement.vue` | 用户一览（用户名映射） |
| `DocumentDisplay.vue` | 规章标准（marked 渲染 Markdown） |
| `PokerTable.vue` | 2020 届扑克牌小工具 |
| `FoldButton.vue` | 折叠/展开按钮（通用交互） |

### 工具模块职责（`src/utils/`）

| 模块 | 职责 |
|------|------|
| `yamlLoader.ts` | 加载并缓存 `mwcup.yaml`；`normalizeTids` 归一化帖子链接 ID |
| `scoreCalculator.ts` | **评分计算核心**：解析各轮次评分 CSV，支持 A-F/S 全部方案，`SCORING_SCHEMES` 常量定义各方案类别 |
| `rankingCalculator.ts` | 单关/多关/原始得分率排名计算 |
| `totalPointsCalculator.ts` | 积分排行计算（含 2019 及 2020+ 特殊规则） |
| `dataAnalyzer.ts` | 选手战绩、评委数据、上传率分析（含统一用户标识 `getUnifiedUserId`） |
| `userDataProcessor.ts` | 用户数据处理（users.csv 解析与姓名索引、战绩类型、`getStageLevel`/`isValidJudge` 等辅助） |
| `userMapper.ts` | 用户显示名映射（users.csv） |
| `scheduleHelper.ts` | 赛程数据组装、截止时间判断（2026+ 评分截止过滤） |
| `roundNames.ts` | 轮次中文名映射（P/I/G/R/S/F 等） |
| `editionHelper.ts` | 届次计算与届次选项（2012=第一届） |
| `urlMap.ts` | 分届上传 URL 映射（2022+ 比赛系统 / 2012-2021 网盘 + 密码） |
| `levelFileHelper.ts` | 关卡索引读取与关键词/选手搜索 |
| `levelMatcher.ts` | 关卡文件与选手数据的匹配（exact/partial/fuzzy 置信度） |
| `preliminaryValidInfoHelper.ts` | 初赛有效关卡信息获取 |
| `resultFormatter.ts` | 比赛结果文字格式化（晋级/名次等） |

### 类型定义（`src/types/`）

- `mwcup.ts`：核心领域类型与类型守卫（选手/评委数据、轮次配置、赛季数据、满分配置等）
- `ranking.ts`：排名相关类型（含 `RankingFilters`）
- `poker.ts`：扑克牌类型与展示工具
- `xlsx-js-style.d.ts`：xlsx-js-style 类型声明补全
- `NoSubmissionRecord.d.ts`：为 `ScoreRecord` 扩展 `isNoSubmission?` 标记

## 路由

配置在 `src/router/index.ts`。使用 Vue Router 组合式 API：

```typescript
import { useRoute, useRouter } from 'vue-router'
const route = useRoute()
const year = route.params.year as string
```

| 路径 | 组件 | 说明 |
|------|------|------|
| `/` | - | 重定向到 `/matches` |
| `/matches` | `RoundSelector` | 赛事详览（props: true 传 year/round） |
| `/matches/:year` | `RoundSelector` | 指定届次 |
| `/matches/:year/:round` | `RoundSelector` | 指定届次 + 轮次 |
| `/upload`、`/upload/:year` | `UploadSystem` | 上传系统 |
| `/levels` | `LevelFileSearch` | 关卡查询 |
| `/stats` | `StatsAnalysis` | 数据统计（重定向到单关排名） |
| `/stats/ranking` | - | 重定向到 `ranking/single` |
| `/stats/ranking/:type` | `RankingModule` | 排名（single/multi/original，懒加载） |
| `/stats/totalpoints` | - | 重定向到 `totalpoints/2025` |
| `/stats/totalpoints/:year` | `TotalPointsRanking` | 积分排行（懒加载） |
| `/stats/:stat` | `StatsAnalysis` | 其他统计 Tab |
| `/docs`、`/docs/:doc` | `DocumentDisplay` | 规章标准 |
| `/poker` | `PokerTable` | 扑克周边 |

## 代码风格

### 格式化 (来自 .editorconfig + eslint.config.js)

- **缩进**: 所有文件 2 个空格
- **字符集**: UTF-8, 文件末尾插入换行
- **对象花括号**: 内部始终有空格 `{ a }` 而不是 `{a}`
- **花括号**: 多行语句必须使用
- **最大空行**: 1 行, 没有尾随空行
- **尾随空格**: 禁止
- **分号/引号/逗号**: 无强制要求
- **换行符样式**: 无强制要求 (Windows 风格也可以)

### 导入顺序

1) 外部库, 2) 内部工具/类型, 3) Vue 组件。

```typescript
import { ref, computed, watch } from 'vue'
import { Decimal } from 'decimal.js'
import { loadRoundScoreData, type ScoreRecord } from '../utils/scoreCalculator'
import ScoreTable from './ScoreTable.vue'
```

使用 `import type` 进行仅类型导入。

### 命名约定

| 类型 | 约定 | 示例 |
|------|------|------|
| 组件 | PascalCase | `ScoreTable.vue` |
| 函数 | camelCase | `loadRoundScoreData` |
| 常量 | UPPER_SNAKE_CASE | `SCORING_SCHEMES` |
| 变量 | camelCase | `selectedYear` |
| 类型/接口 | PascalCase | `ScoreRecord` |

### TypeScript

- `strict: true`; **禁止使用 `any`** (ESLint `@typescript-eslint/no-explicit-any` 规则已启用)
- 未使用变量: 以 `_` 前缀忽略警告
- 可选属性使用 `?`
- 使用类型守卫区分联合类型（见下方"YAML 数据类型"章节）

### Vue 组件

```vue
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

const props = defineProps<{
  year: string
  round: string
}>()

const scoreData = ref<RoundScoreData | null>(null)

const filteredData = computed(() => {
  if (!scoreData.value) return []
  return scoreData.value.filter(...)
})

onMounted(() => { /* 初始化逻辑 */ })
</script>
```

强制的 Vue ESLint 规则:
- 单行最多 3 个属性; 多行每行 1 个属性
- HTML 缩进: 2 个空格
- Mustache 插值: `{{ value }}` 而不是 `{{value}}`
- `prop-name-casing` 和 `multi-word-component-names` 已关闭

多根节点组件（fragment）必须声明 `defineProps` 并设置 `inheritAttrs: false`，否则 Vue 会警告非 props 属性无法继承：

```vue
<script setup lang="ts">
defineProps<{
  year?: string
  round?: string
}>()

defineOptions({ inheritAttrs: false })
</script>
```

### 比较

使用 `===`/`!==`。例外: 允许 `== null`/`== undefined` (智能模式)。

### 变量

始终使用 `const`, 从不使用 `var`。仅在需要修改时使用 `let`。

### 错误处理

用 try-catch 包装异步操作。使用中文错误消息。在组件中维护 `error` ref 用于 UI 显示。

```typescript
try {
  const res = await fetch(url)
  if (!res.ok) throw new Error('网络错误: 无法加载数据')
} catch (error) {
  console.error('加载失败:', error)
  throw error
}
```

允许空的 catch 块。

## 数值精度

所有分数计算使用 `decimal.js`:

```typescript
import { Decimal } from 'decimal.js'
Decimal.set({ precision: 10, rounding: Decimal.ROUND_HALF_UP })
const avg = new Decimal(score).div(count).toDecimalPlaces(1)
```

## 数据加载与缓存约定

静态资源位于 `public/data/`。使用 `Promise.all` 并行加载:

```typescript
const [levels, maxScore, config] = await Promise.all([
  fetch('/data/levels/index.json').then(r => r.json()),
  fetch('/data/maxScore.json').then(r => r.json()),
  fetch('/data/mwcup.yaml').then(r => r.text()),
])
```

**缓存约定**: 各工具模块普遍采用"缓存值 + 进行中的 Promise"双缓存模式，避免并发重复请求与重复解析：

- `yamlLoader.ts`: `yamlDocCache` / `yamlDocPromise`
- `scoreCalculator.ts`: `roundScoreDataCache` / `roundScoreDataPromise`（按 `year_round` 键）；`csvTextCache` / `csvTextPromise`（按 URL，供评分与出勤分析共享，通过 `fetchCachedCsvText` 访问）

修改加载逻辑时请保持该模式：先查缓存值，再查进行中的 Promise，均未命中才发起新请求并缓存。

## 类型定义

- 复杂类型放在 `src/types/`
- 使用 `.d.ts` 扩展第三方库类型（如 `xlsx-js-style.d.ts`、`NoSubmissionRecord.d.ts`）
- 使用 `export interface` 或 `export type` 导出类型

## YAML 数据类型

YAML 数据结构动态性较强，`src/types/mwcup.ts` 定义了核心类型和类型守卫。处理 YAML 数据时必须使用类型守卫区分联合类型：

### 选手数据 (`PlayerData`)

`PlayerData` 是联合类型 `string[] | FlatPlayerMap | GroupedPlayerMap`：
- `FlatPlayerMap`: `{ M: "选手名", W: "选手名" }` — 值为字符串
- `GroupedPlayerMap`: `{ A: { A1: "选手名", ... }, B: { ... } }` — 值为嵌套对象

必须使用类型守卫后再访问：

```typescript
import { isGroupedPlayerMap, isFlatPlayerMap, isPlayerArray } from '../types/mwcup'

if (isGroupedPlayerMap(players)) {
  // players 是 GroupedPlayerMap，遍历 Object.entries(players) 获取各组
} else if (isFlatPlayerMap(players)) {
  // players 是 FlatPlayerMap，直接 Object.entries(players) 获取选手
} else if (isPlayerArray(players)) {
  // players 是 string[]
}
```

### 多轮次键

YAML 中 `rounds` 的键可包含逗号表示多轮次共享配置（如 `"G1,G2,G3,G4"`）。使用 `extractRoundKeys` 拆分，使用 `findRoundConfig` 查找某轮次对应的配置项。

### 帖子链接 (`tieba_tid` / `mf_tid`)

`ScheduleLinkData` 中 `tieba_tid` 和 `mf_tid` 类型为 `string | Record<string, string> | undefined`。YAML 中帖子 ID 是数字（如 `2539354082`），但在 `yamlLoader.ts` 加载时已通过 `normalizeTids()` 统一转为字符串，下游代码无需处理 `number` 类型：

```typescript
const tid = typeof v.tieba_tid === 'string'
  ? v.tieba_tid
  : v.tieba_tid ? Object.values(v.tieba_tid)[0] : undefined
```

## 评分方案

支持 YAML 中 `scoring_scheme` 定义的 A/B/C/D/E/F/S 七种方案，类别定义在 `scoreCalculator.ts` 的 `SCORING_SCHEMES` 常量中：

- A: `['欣赏性', '娱乐性', '挑战性', '创新性', '加分项', '扣分项']`
- B: `['欣赏性', '设计水平', '创新性', '挑战性', '娱乐性', '加分项', '扣分项']`
- C: 大项下辖子项（得体度/美观度/独特度/思辨度/完成度/合理度/有效度/参与度/耐玩度/成就度）
- D: `['欣赏性', '创新性', '设计性', '游戏性', '加分项', '扣分项']` — 评委/大众混合评分，含加权去极值逻辑
- E: 在 C 的基础上引入大众评分，按"评委评分×75% + 大众评分×25%"计算最终得分（`finalScore`）
- F: 纯大众评分方案（`SCORING_SCHEMES.F = []`，无评委 CSV），走 `handlePublicOnlyScoring` 从 votes CSV 统计
- S: 2015 半决赛总分制（`['总分']`），从 YAML `scores` 直接读取

在应用评分逻辑前检查 `scoringScheme` — 每个方案有不同的类别与计算分支。轮次可在 `rounds` 配置中覆盖赛季级方案。

## 用户统一标识

`public/data/users.csv` 维护百度用户名、社区用户名/UID、别名之间的映射。`userDataProcessor.ts` 负责解析并构建姓名索引，`dataAnalyzer.ts` 通过 `getUnifiedUserId` 生成 `community_{UID}` 或 `user_{序号}` 作为统一标识，合并同一选手在不同平台的不同名字。`userMapper.ts` 提供显示名映射。

## 2012 年数据排除

2012 年（第一届）数据不完整，以下模块完全忽略 2012 年数据：
- **关卡排名** (`rankingCalculator.ts`): `calculateSingleLevelRanking`、`calculateMultiLevelRanking`、`calculateOriginalScoreRanking` 均过滤 `year !== 2012`；`getAvailableYears` 不返回 2012
- **举办情况** (`ChampionStatistics.vue`): 遍历赛季数据时跳过 `year === '2012'`
- **积分排行** (`TotalPointsRanking.vue`): 年份列表从 2013 开始

## 特殊年份与轮次规则

- **2026 年起评分截止过滤**: `scheduleHelper.ts` 的 `shouldApplyDeadlineFilter`（≥2026 生效）与 `shouldShowScoreData` 决定未到截止时间的轮次不显示评分
- **2019**: 小组赛 4 选 3 + 超时扣分；积分计算走 `calculate2019TotalScore`
- **2020/2021**: 初赛有效关卡制（含累计超时扣分）
- **2022 起**: 初赛有效关卡制（无扣分）；`isYearOnlyFRounds` 判定仅含 F1/F2/F3 正赛的年份（积分排行按总积分统计冠亚季军）
- **2012 I2**: 无评分，使用关卡上传数据
- **2015 S**: 半决赛总分制从 YAML `scores` 读取
- **2022P2 / 2023P2**: CSV 使用"选手用户名"列而非"选手码"
- **2013 起**: 赛程附 Wiki 链接

## CSS 约定

- 主题颜色使用 CSS 变量: `--primary-color`, `--text-primary`
- 模块化: style.css, theme.css, components.css, layout.css, animations.css
- 响应式: `@media (max-width: 768px)` 断点
- 动画类: `animate-fadeInUp`, `hover-scale`

## 数据源

- `public/data/docs/*.md` - 赛事文档
- `public/data/levels/index.json` - 关卡索引（本地生成）
- `public/data/scores/*.csv` - 各轮次评分数据
- `public/data/subjects/*.md` - 比赛试题
- `public/data/votes/*.csv` - 各轮次大众评分数据
- `public/data/maxScore.json` - 各轮次满分配置
- `public/data/mwcup.yaml` - 比赛配置
- `public/data/specialLevels.json` - 特殊关卡映射
- `public/data/levelSubjects.json` - 关卡对应题目映射 (2026年及以后)
- `public/data/poker2020.csv` - 2020年扑克牌数据
- `public/data/users.csv` - 用户列表

## 注意事项

- **语言**: 注释和错误消息使用中文
- **浏览器**: 目标现代浏览器
- **响应式**: 支持移动端 (768px 断点)
- **性能**: 大数据集使用分页或懒加载
- **构建**: 生产构建使用 terser 并剥离 console/debugger；`BUILD_TIME` 由 vite `define` 注入，用于展示构建时间
- **部署**: 通过 rsync 部署到 `/data/wwwroot/mwcup.marioforever.net/`
