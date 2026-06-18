# Mario Worker 杯官网

一个基于 Vue 3 + TypeScript + Vite 构建的 Mario Worker 杯比赛官方网站。

## 功能特性

### 🏆 核心功能
- **赛程安排**: 查看各届比赛的详细赛程安排
- **评分查询**: 按轮次查询比赛评分结果和统计数据
- **关卡查询**: 搜索和浏览参赛关卡文件
- **冠军统计**: 查看历届冠军获奖情况统计
- **关卡排名**: 全新的排名系统，支持多种排名模式

### 📊 排名系统
- **单关排名**: 基于得分率的单个关卡排名
- **多关排名**: 多关题目的关卡排名
- **原始得分率排名**: 对比原始分与最终分的排名变化

### 🔍 筛选功能
- 按选手名称搜索
- 按关卡名称搜索
- 按届次筛选
- 实时过滤结果

### 🎨 设计特色
- 响应式设计，支持移动端
- 橙色主题配色
- 玻璃拟态效果
- 流畅的动画过渡

## 技术栈

- **前端框架**: Vue 3 (Composition API)
- **开发语言**: TypeScript
- **构建工具**: Vite
- **包管理器**: bun
- **样式方案**: CSS3 (CSS Variables + 模块化)
- **数据处理**: js-yaml, papaparse

## 快速开始

### 安装依赖
```bash
bun install
```

### 开发环境
```bash
bun run dev
```

### 构建生产版本
```bash
bun run build
```

### 部署生产版本
```bash
bun run deploy
```

## 项目结构

```
src/
├── components/          # Vue 组件
│   ├── AttendanceStats.vue  # 上传率（出勤率）模块
│   ├── ChampionStatistics.vue  # 冠军统计 & 举办情况
│   ├── DocumentDisplay.vue  # 赛事文档显示模块
│   ├── FoldButton.vue       # 折叠展开按钮
│   ├── JudgeRecords.vue     # 评委数据
│   ├── LevelFileSearch.vue  # 关卡搜索
│   ├── PlayerRecords.vue    # 选手战绩
│   ├── PokerTable.vue       # 扑克牌数据模块
│   ├── RankingModule.vue    # 关卡排名
│   ├── RoundSelector.vue    # 轮次选择模块
│   ├── ScheduleTable.vue    # 赛程表
│   ├── ScoreTable.vue       # 分轮次评分数据
│   ├── StatsAnalysis.vue    # 数据统计 Tab
│   ├── SubjectDisplay.vue   # 比赛试题显示
│   ├── TotalPointsRanking.vue  # 积分排行
│   ├── UploadSystem.vue     # 上传系统 iframe
│   └── UserManagement.vue   # 用户一览
├── router/             # Vue 路由配置
│   └── index.ts        # 路由定义
├── styles/             # 样式文件
│   ├── style.css           # 主样式文件
│   ├── theme.css           # 主题配色
│   ├── components.css      # 通用组件样式
│   ├── layout.css          # 布局样式
│   └── animations.css      # 动画效果
├── types/              # TypeScript 类型定义
│   ├── poker.ts            # 扑克牌数据类型定义
│   ├── ranking.ts          # 排名相关类型
│   └── xlsx-js-style.d.ts  # xlsx-js 样式类型定义
├── utils/              # 工具函数
│   ├── dataAnalyzer.ts      # 数据统计分析
│   ├── editionHelper.ts     # 届数计算
│   ├── levelFileHelper.ts   # 关卡索引读取
│   ├── levelMatcher.ts      # 获取分组的显示名称
│   ├── preliminaryValidInfoHelper.ts  # 初赛有效题目信息获取
│   ├── rankingCalculator.ts # 排名计算
│   ├── resultFormatter.ts   # 战绩格式处理
│   ├── roundNames.ts        # 轮次名称映射
│   ├── scheduleHelper.ts    # 赛程数据处理
│   ├── scoreCalculator.ts   # 评分计算
│   ├── totalPointsCalculator.ts  # 积分排行计算
│   ├── urlMap.ts            # 分届上传 URL 映射
│   ├── userDataProcessor.ts # 用户数据处理
│   ├── userMapper.ts        # 用户映射
│   └── yamlLoader.ts        # YAML 解析
└── App.vue             # 主应用组件
```

## 数据源

项目使用以下数据源：

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
