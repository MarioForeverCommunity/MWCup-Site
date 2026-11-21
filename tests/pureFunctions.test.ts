/**
 * 纯函数回归测试 —— 精确断言，捕捉评分/排名算法的细微回归。
 *
 * 这些测试不依赖任何外部数据，锁定：
 * - SCORING_SCHEMES 各方案类别常量
 * - 大众评分去极值算法 calculateFinalPublicScore
 * - 并列排名 calculateRankingWithTies
 * - 赛季年份判定 isYearOnlyFRounds
 */
import { describe, it, expect } from 'bun:test'
import { Decimal } from 'decimal.js'
import { SCORING_SCHEMES, calculateFinalPublicScore } from '../src/utils/scoreCalculator'
import { calculateRankingWithTies } from '../src/utils/totalPointsCalculator'
import { isNotYetRated } from '../src/utils/scoreCalculator'
import type { PlayerTotalPoints } from '../src/utils/totalPointsCalculator'

describe('SCORING_SCHEMES 评分方案类别常量', () => {
  it('A 方案类别', () => {
    expect(SCORING_SCHEMES.A).toEqual(['欣赏性', '娱乐性', '挑战性', '创新性', '加分项', '扣分项'])
  })
  it('B 方案类别', () => {
    expect(SCORING_SCHEMES.B).toEqual(['欣赏性', '设计水平', '创新性', '挑战性', '娱乐性', '加分项', '扣分项'])
  })
  it('C 方案类别', () => {
    expect(SCORING_SCHEMES.C).toEqual([
      '得体度', '美观度', '独特度', '思辨度', '完成度',
      '合理度', '有效度', '参与度', '耐玩度', '成就度', '加分项', '扣分项',
    ])
  })
  it('D 方案类别', () => {
    expect(SCORING_SCHEMES.D).toEqual(['欣赏性', '创新性', '设计性', '游戏性', '加分项', '扣分项'])
  })
  it('E 方案类别（大众评分换算项）', () => {
    expect(SCORING_SCHEMES.E).toEqual([
      '得体度', '美观度', '独特度', '思辨度', '完成度',
      '合理度', '有效度', '参与度', '耐玩度', '成就度', '加分项', '扣分项', '换算后大众评分',
    ])
  })
  it('F 方案为空数组（纯大众评分）', () => {
    expect(SCORING_SCHEMES.F).toEqual([])
  })
  it('S 方案为总分制', () => {
    expect(SCORING_SCHEMES.S).toEqual(['总分'])
  })
})

describe('calculateFinalPublicScore 大众评分去极值算法', () => {
  const D = (n: number) => new Decimal(n)

  it('无评分返回 0', () => {
    expect(calculateFinalPublicScore([]).toNumber()).toBe(0)
  })

  it('≤4 票：直接取平均并保留 1 位小数', () => {
    expect(calculateFinalPublicScore([D(8), D(9)]).toNumber()).toBe(8.5)
    expect(calculateFinalPublicScore([D(1), D(2), D(3), D(4)]).toNumber()).toBe(2.5)
  })

  it('=5 票：最低/最高各半 + 中间三项，除以 4', () => {
    // (2/2 + 4 + 5 + 6 + 8/2) / 4 = (1+4+5+6+4)/4 = 20/4 = 5
    expect(calculateFinalPublicScore([D(2), D(4), D(5), D(6), D(8)]).toNumber()).toBe(5)
  })

  it('>5 票：去一最高一最低后取平均', () => {
    // 去掉 1 和 10，(3+4+5+6+7+8+9)/7 = 42/7 = 6
    expect(calculateFinalPublicScore([D(1), D(3), D(4), D(5), D(6), D(7), D(8), D(9), D(10)]).toNumber()).toBe(6)
  })

  it('允许负分', () => {
    expect(calculateFinalPublicScore([D(-2), D(-4)]).toNumber()).toBe(-3)
  })
})

describe('calculateRankingWithTies 并列排名', () => {
  const mk = (name: string, total: number, rounds: number): PlayerTotalPoints => ({
    playerName: name,
    unifiedUserId: name,
    totalPoints: new Decimal(total),
    validRoundsCount: rounds,
  } as PlayerTotalPoints)

  it('分数与有效轮次均相同才并列，且后续跳号', () => {
    const players = [
      mk('A', 100, 3),
      mk('B', 90, 3),
      mk('C', 90, 3),
      mk('D', 80, 2),
    ]
    const result = calculateRankingWithTies(players)
    expect(result.map((p) => p.displayRank)).toEqual([1, 2, 2, 4])
  })

  it('分数相同但有效轮次不同则不并列', () => {
    const players = [mk('A', 100, 3), mk('B', 100, 2), mk('C', 90, 3)]
    const result = calculateRankingWithTies(players)
    expect(result.map((p) => p.displayRank)).toEqual([1, 2, 3])
  })
})

describe('isNotYetRated 未评分判定', () => {
  it('无 scores 视为未评分', () => {
    expect(isNotYetRated({ scores: {} } as never)).toBe(true)
  })
  it('全零分视为未评分', () => {
    expect(isNotYetRated({ scores: { a: new Decimal(0), b: 0 } } as never)).toBe(true)
  })
  it('存在非零分视为已评分', () => {
    expect(isNotYetRated({ scores: { a: new Decimal(0), b: 9 } } as never)).toBe(false)
  })
})
