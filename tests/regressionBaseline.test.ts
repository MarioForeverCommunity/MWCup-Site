/**
 * 端到端回归基线测试 —— 用真实 public/data 计算历史评分与排名，
 * 与已提交的 JSON 基线快照逐字段比对。
 *
 * 目的：确保重构（入口统一、前后端整合、计分规则后端化等）不改变历史计算结果。
 *
 * 基线生成/更新：
 *   REGENERATE_BASELINE=1 bun test tests/regressionBaseline.test.ts
 * 基线文件：tests/baselines/historical.json
 *
 * 注意：levels/index.json 是 gitignore 的本地生成文件。
 * 首次运行前需执行 `node scripts/generateLevelIndex.js` 生成它。
 */
import { describe, it, expect, beforeAll } from 'bun:test'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { installFetchMock } from './helpers/mockFetch'

const TEST_DIR = dirname(fileURLToPath(import.meta.url))
const BASELINE_PATH = join(TEST_DIR, 'baselines', 'historical.json')
const REGENERATE = process.env.REGENERATE_BASELINE === '1'

beforeAll(() => {
  installFetchMock()
})

interface Baseline {
  generatedAt: string
  note: string
  rankings: {
    single: unknown[]
    multi: unknown[]
    original: unknown[]
    availableYears: number[]
  }
  totalPoints: Record<string, unknown[]>
  yearOnlyFRounds: Record<string, boolean>
  scoring: Record<string, unknown>
}

function normalize(value: unknown): unknown {
  // Decimal 实例序列化为字符串，保证可比性
  return JSON.parse(JSON.stringify(value, (_key, v) => {
    if (v && typeof v === 'object' && typeof (v as { toFixed?: unknown }).toFixed === 'function' && (v as { constructor?: { name?: string } }).constructor?.name === 'Decimal') {
      return (v as { toString(): string }).toString()
    }
    return v
  })) as unknown
}

async function buildBaseline(): Promise<Baseline> {
  const { fetchMarioWorkerYaml } = await import('../src/utils/yamlLoader')
  const { calculateSingleLevelRanking, calculateMultiLevelRanking, calculateOriginalScoreRanking, getAvailableYears } = await import('../src/utils/rankingCalculator')
  const { loadTotalPointsData, isYearOnlyFRounds } = await import('../src/utils/totalPointsCalculator')
  const { loadRoundScoreData } = await import('../src/utils/scoreCalculator')

  const yaml = await fetchMarioWorkerYaml()

  // 全部排名（默认过滤器覆盖所有年份/方案）
  const single = normalize(await calculateSingleLevelRanking())
  const multi = normalize(await calculateMultiLevelRanking())
  const original = normalize(await calculateOriginalScoreRanking())
  const availableYears = await getAvailableYears()

  // 各年积分排行（2013—2026，2012 排除）
  const totalPoints: Record<string, unknown[]> = {}
  for (let year = 2013; year <= 2026; year++) {
    const data = await loadTotalPointsData(String(year), yaml)
    totalPoints[String(year)] = normalize(data.players)
  }

  // 仅 F 正赛年份判定（2022+ 特殊积分规则）
  const yearOnlyFRounds: Record<string, boolean> = {}
  for (let year = 2013; year <= 2026; year++) {
    yearOnlyFRounds[String(year)] = isYearOnlyFRounds(yaml, String(year))
  }

  // 代表性轮次的原始评分数据（覆盖 A/B/C/D/E/F/S 方案）
  const scoring: Record<string, unknown> = {}
  const sampleRounds: Array<[string, string]> = [
    ['2013', 'P1'], ['2014', 'P1'], ['2015', 'S'],
    ['2016', 'Q2'], ['2021', 'F1'], ['2022', 'P2'],
    ['2023', 'P2'], ['2024', 'I1'], ['2026', 'F1'],
  ]
  for (const [year, round] of sampleRounds) {
    try {
      const data = await loadRoundScoreData(year, round, yaml)
      scoring[`${year}${round}`] = normalize(data)
    } catch (error) {
      scoring[`${year}${round}`] = { error: String(error) }
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    note: 'MWCup 历史评分/排名回归基线；由 bun test tests/regressionBaseline.test.ts -REGENERATE 生成，请勿手工编辑',
    rankings: {
      single: single as unknown[],
      multi: multi as unknown[],
      original: original as unknown[],
      availableYears,
    },
    totalPoints,
    yearOnlyFRounds,
    scoring,
  }
}

describe('历史评分与排名回归基线', () => {
  it('计算结果与基线快照一致', async () => {
    const actual = await buildBaseline()
    const actualCore = { rankings: actual.rankings, totalPoints: actual.totalPoints, yearOnlyFRounds: actual.yearOnlyFRounds, scoring: actual.scoring }

    if (REGENERATE) {
      await mkdir(dirname(BASELINE_PATH), { recursive: true })
      await writeFile(BASELINE_PATH, JSON.stringify(actual, null, 2) + '\n', 'utf-8')
      throw new Error('基线已重新生成（REGENERATE_BASELINE=1），请去掉该环境变量后重新运行以验证')
    }

    let baselineText: string
    try {
      baselineText = await readFile(BASELINE_PATH, 'utf-8')
    } catch {
      throw new Error(`缺少基线文件 ${BASELINE_PATH}，请先运行 REGENERATE_BASELINE=1 bun test tests/regressionBaseline.test.ts 生成`)
    }
    const baseline = JSON.parse(baselineText) as Baseline
    const expectedCore = { rankings: baseline.rankings, totalPoints: baseline.totalPoints, yearOnlyFRounds: baseline.yearOnlyFRounds, scoring: baseline.scoring }

    expect(actualCore).toEqual(expectedCore)
  }, 120_000)
})
