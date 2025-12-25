## 技术栈

- **前端框架**: Vue 3
- **开发语言**: TypeScript
- **构建工具**: Vite
- **包管理器**: bun (禁止使用 npm/yarn/pnpm)
- **样式方案**: CSS3 (CSS Variables + 模块化)
- **数据处理**: js-yaml, papaparse

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
- `public/data/users.csv` - 用户列表
- ~~`public/data/validLevel.json` - 初赛有效关卡数据 (已废弃)~~
