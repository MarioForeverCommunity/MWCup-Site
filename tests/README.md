# 回归测试基线

本目录用 Bun 内置测试框架（`bun test`）锁定 MWCup 历史评分与排名计算结果，确保整合重构不改变历史数据。

## 运行

```bash
bun run test       # 运行全部测试
bun test tests/pureFunctions.test.ts   # 只跑纯函数测试
```

## 文件说明

- `pureFunctions.test.ts`：纯函数精确断言（SCORING_SCHEMES、大众评分去极值、并列排名、未评分判定）。
- `regressionBaseline.test.ts`：用真实 `public/data` 计算历史评分/排名，与 `baselines/historical.json` 逐字段比对。
- `baselines/historical.json`：基线快照（943 条单关排名、27 条多关排名、943 条原始分排名、2013—2026 积分、2026 仅 F 正赛判定、9 个代表性轮次评分）。**请勿手工编辑。**
- `helpers/mockFetch.ts`：将 `/data/...` 请求映射到本地 `public/data` 的 fetch mock，使计算模块可离线运行。

## 前置条件

`regressionBaseline.test.ts` 依赖 `public/data/levels/index.json`。该文件被 gitignore，首次运行前需生成：

```bash
node scripts/generateLevelIndex.js
```

## 更新基线

当且仅当确认某项计算逻辑的变更是有意的历史结果修正时，才更新基线：

```bash
REGENERATE_BASELINE=1 bun test tests/regressionBaseline.test.ts
```

该命令会重新生成 `baselines/historical.json` 并以一条预期失败提示你；随后去掉环境变量重跑验证：

```bash
bun run test
```

更新基线属于重大变更，必须在提交信息中说明原因与影响范围。
