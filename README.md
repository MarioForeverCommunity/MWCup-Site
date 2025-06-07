# Mario Worker 杯官网

一个基于 Vue 3 + TypeScript + Vite 构建的 Mario Worker 杯比赛官方网站。

## 功能特性

### 🏆 核心功能
- **赛程安排**: 查看各届比赛的详细赛程安排
- **评分查询**: 按轮次查询比赛评分结果和统计数据
- **关卡查询**: 搜索和浏览参赛关卡文件
- **冠军统计**: 查看历届冠军获奖情况统计
- **📊 关卡排名**: 全新的排名系统，支持多种排名模式

### 🎯 排名系统
- **单关排名**: 基于得分率的单个关卡排名
- **多关排名**: MultiLevel 文件夹的综合排名
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
- **样式方案**: CSS3 (CSS Variables + 模块化)
- **数据处理**: js-yaml, papaparse

## 快速开始

### 安装依赖
```bash
npm install
```

### 开发环境
```bash
npm run dev
```

### 构建生产版本
```bash
npm run build
```

### 预览生产版本
```bash
npm run preview
```

## 项目结构

```
src/
├── components/          # Vue 组件
│   ├── RankingModule.vue    # 排名模块
│   ├── ScheduleTable.vue    # 赛程表
│   ├── RoundSelector.vue    # 轮次选择器
│   ├── ChampionStatistics.vue # 冠军统计
│   └── LevelFileSearch.vue  # 关卡搜索
├── styles/             # 样式文件
│   ├── theme.css           # 主题配色
│   ├── components.css      # 通用组件样式
│   ├── layout.css          # 布局样式
│   └── animations.css      # 动画效果
├── types/              # TypeScript 类型定义
│   └── ranking.ts          # 排名相关类型
├── utils/              # 工具函数
│   ├── rankingCalculator.ts # 排名计算器
│   ├── scoreCalculator.ts   # 评分计算器
│   └── scheduleYaml.ts      # 赛程数据处理
└── App.vue             # 主应用组件
```

## 数据格式

项目使用以下数据源：
- `public/data/levels/index.json` - 关卡索引
- `public/data/rounds/*.csv` - 各轮次评分数据
- `public/data/maxScore.json` - 满分配置
- `public/data/mwcup.yaml` - 比赛配置

## 贡献指南

欢迎提交 Issue 和 Pull Request 来改进项目！

## 许可证

本项目基于 MIT 许可证开源。
