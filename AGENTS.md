# AGENTS.md

在此代码库中工作的 AI 编码助手的约定。

## 应用概述

Mario Worker 杯官网 — 一个关卡设计比赛的官方网站。核心功能：赛程浏览（14届/2012-2026）、评分查询、关卡搜索、统计排名（单关/多关/积分）、数据导出（Excel）。

**数据流**: `public/data/` 静态文件 → `src/utils/` 工具函数（fetch + 解析 + 计算）→ `src/components/` Vue 组件渲染。无全局状态管理（无 Pinia/Vuex），数据在组件本地管理，通过路由 props 传递。

**测试**: 无测试框架。质量保证依赖 TypeScript 编译检查 + ESLint。

**自定义脚本**: `scripts/generateLevelIndex.js` 扫描 `public/data/levels/` 并匹配 YAML 元数据，生成 `levels/index.json`（该文件在 .gitignore 中，需本地生成）。

## 技术栈

- **框架**: Vue 3 (Composition API, `<script setup lang="ts">`)
- **语言**: TypeScript (严格模式)
- **构建**: Vite 8 (支持 gzip/brotli 压缩, terser 压缩, ES2022 目标)
- **包管理器**: bun — 不要使用 npm/yarn/pnpm
- **样式**: CSS (CSS 变量 + 模块化文件)
- **数据处理**: js-yaml, papaparse, xlsx, xlsx-js-style, decimal.js, marked

## 命令

```bash
bun run dev        # 开发服务器 (HMR, host 0.0.0.0)
bun run build      # 类型检查 (vue-tsc -b) 然后 vite build
bun run preview    # 预览生产构建
bun run lint       # ESLint 带 --fix
bun run deploy     # 部署到生产服务器
```

**验证顺序**: `lint` → `build` (包含类型检查)

## 项目结构

```
src/
├── components/    # Vue 单文件组件 (PascalCase: ScoreTable.vue)
├── router/        # Vue Router 配置
├── styles/        # CSS 模块 (theme, components, layout, animations)
├── types/         # TypeScript 接口/类型
├── utils/         # 辅助函数
└── App.vue        # 根组件
public/data/       # 静态数据 (CSV, JSON, YAML, Markdown)
scripts/           # 构建脚本 (例如 generateLevelIndex.js)
```

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

## 数据加载

静态资源位于 `public/data/`。使用 `Promise.all` 并行加载:

```typescript
const [levels, maxScore, config] = await Promise.all([
  fetch('/data/levels/index.json').then(r => r.json()),
  fetch('/data/maxScore.json').then(r => r.json()),
  fetch('/data/mwcup.yaml').then(r => r.text()),
])
```

## 类型定义

- 复杂类型放在 `src/types/`
- 使用 `.d.ts` 扩展第三方库类型
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

### 帖子链接 (`tieba_tid` / `mf_tid`)

`ScheduleLinkData` 中 `tieba_tid` 和 `mf_tid` 类型为 `string | Record<string, string> | undefined`。YAML 中帖子 ID 是数字（如 `2539354082`），但在 `yamlLoader.ts` 加载时已通过 `normalizeTids()` 统一转为字符串，下游代码无需处理 `number` 类型：

```typescript
const tid = typeof v.tieba_tid === 'string'
  ? v.tieba_tid
  : v.tieba_tid ? Object.values(v.tieba_tid)[0] : undefined
```

## 2012 年数据排除

2012 年（第一届）数据不完整，以下模块完全忽略 2012 年数据：
- **关卡排名** (`rankingCalculator.ts`): `calculateSingleLevelRanking`、`calculateMultiLevelRanking`、`calculateOriginalScoreRanking` 均过滤 `year !== 2012`；`getAvailableYears` 不返回 2012
- **举办情况** (`ChampionStatistics.vue`): 遍历赛季数据时跳过 `year === '2012'`
- **积分排行** (`TotalPointsRanking.vue`): 年份列表从 2013 开始

## CSS 约定

- 主题颜色使用 CSS 变量: `--primary-color`, `--text-primary`
- 模块化: theme.css, components.css, layout.css, animations.css
- 响应式: `@media (max-width: 768px)` 断点
- 动画类: `animate-fadeInUp`, `hover-scale`

## 路由

配置在 `src/router/index.ts`。使用 Vue Router 组合式 API:

```typescript
import { useRoute, useRouter } from 'vue-router'
const route = useRoute()
const year = route.params.year as string
```

## 评分方案

支持 YAML 中定义的 A/B/C/D/E/S 方案:
- A: ['欣赏性', '娱乐性', '挑战性', '创新性', '加分项', '扣分项']
- B: ['欣赏性', '设计水平', '创新性', '挑战性', '娱乐性', '加分项', '扣分项']
- C: 大项下辖子项
- D: 评委/大众混合评分
- E: 在 C 的基础上引入大众评分，按“评委评分×75% + 大众评分×25%”计算
- F: 大众评选方案（无评委）
- S: 2015 半决赛总分制

在应用评分逻辑前检查 `scoringScheme` — 每个方案有不同的类别。

## 数据源

- `public/data/docs/*.md` - 赛事文档
- `public/data/levels/index.json` - 关卡索引
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
- **构建**: 生产构建使用 terser 并剥离 console/debugger
- **部署**: 通过 rsync 部署到 `/data/wwwroot/mwcup.marioforever.net/`
