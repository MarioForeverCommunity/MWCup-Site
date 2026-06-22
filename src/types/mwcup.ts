/**
 * MWCup YAML 数据核心类型定义
 * 基于 public/data/mwcup.yaml 的数据结构
 */

// ===== 选手数据结构 =====

/** 扁平选手映射：{ '1': 用户名, '2': 用户名, ... } */
export type FlatPlayerMap = Record<string, string>

/** 分组选手映射：{ A: { A1: 用户名, ... }, ... } */
export type GroupedPlayerMap = Record<string, FlatPlayerMap>

/** 选手数据：可能是数组、扁平映射或分组映射 */
export type PlayerData = string[] | FlatPlayerMap | GroupedPlayerMap

// ===== 评委数据结构 =====

/** 扁平评委映射：{ J1: 用户名, J2: 用户名, ... } */
export type FlatJudgeMap = Record<string, string>

/** 分组评委映射：{ A: { J1: 用户名, ... }, ... } */
export type GroupedJudgeMap = Record<string, FlatJudgeMap>

/** 评委数据：可能是扁平映射或分组映射 */
export type JudgeData = FlatJudgeMap | GroupedJudgeMap

// ===== 赛程相关 =====

/** 链接数据（贴吧/社区帖子ID） */
export interface ScheduleLinkData {
  time?: string
  start?: string
  end?: string
  tieba_tid?: string | Record<string, string>
  mf_tid?: string | Record<string, string>
  links?: string[]
}

/** 比赛阶段赛程 */
export interface MatchSchedule extends ScheduleLinkData {
  deadlines?: string[]
}

/** 评分阶段赛程 */
export interface JudgingSchedule extends ScheduleLinkData {
  deadlines?: string[]
}

/** 大众评分赛程 */
export type VotingSchedule = ScheduleLinkData

/** 轮次赛程配置 */
export interface RoundSchedule {
  deadlines?: string[]
  topics?: Record<string, ScheduleLinkData>
  match?: MatchSchedule
  judging?: JudgingSchedule
  voting?: VotingSchedule
  draw?: ScheduleLinkData | string
  registration?: ScheduleLinkData | string
  pre_match_checkin?: ScheduleLinkData | string
  post_match_checkin?: ScheduleLinkData | string
  promotion?: ScheduleLinkData | string
  [key: string]: unknown
}

// ===== 轮次数据 =====

/** 轮次配置 */
export interface RoundConfig {
  players?: PlayerData
  judges?: JudgeData
  scoring_scheme?: string
  is_warmup?: boolean
  schedule?: RoundSchedule
  deadlines?: string[]
  scores?: Record<string, unknown>
  [key: string]: unknown
}

// ===== 年度数据 =====

/** 年度赛季配置 */
export interface SeasonYearData {
  rounds: Record<string, RoundConfig>
  scoring_scheme?: string
  [key: string]: unknown
}

// ===== 顶层 YAML 结构 =====

/** MWCup YAML 顶层文档 */
export interface MWCupYamlDoc {
  season: Record<string, SeasonYearData>
}

// ===== 辅助类型 =====

/** 选手-评委映射（buildPlayerJudgeMap 返回值） */
export interface PlayerJudgeMap {
  players: Record<string, string>
  judges: Record<string, string>
  playerGroups: Record<string, string>
}

/** 轮次信息（用于 getRoundChineseName 等函数） */
export interface RoundNameData {
  year?: string
  is_warmup?: boolean
  [key: string]: unknown
}

// ===== 满分数据 =====

/** 轮次满分配置 */
export interface RoundMaxScore {
  base_score: number
  bonus_score: number
}

/** 满分数据结构 */
export interface MaxScoreData {
  maxScore: Record<string, Record<string, RoundMaxScore>>
}

// ===== 关卡索引数据 =====

/** 关卡索引条目（来自 levels/index.json） */
export interface LevelIndexItem {
  name: string
  path: string
  mtime: string
  size: number
  playerCode: string
  year: number
  roundType: string
  playerName: string
  roundKey: string
  groupCode: string
  hasPlayerInfo: boolean
  isMultiLevel?: boolean
  multiLevelFolder?: { folderName: string; playerCode: string } | null
  subject?: string | null
  [key: string]: unknown
}

// ===== 类型守卫 =====

/** 判断选手数据是否为数组格式 */
export function isPlayerArray(players: PlayerData): players is string[] {
  return Array.isArray(players)
}

/** 判断选手数据是否为扁平映射格式 */
export function isFlatPlayerMap(players: PlayerData): players is FlatPlayerMap {
  return !Array.isArray(players) && typeof players === 'object' && players !== null &&
    Object.values(players).every(v => typeof v === 'string')
}

/** 判断选手数据是否为分组映射格式 */
export function isGroupedPlayerMap(players: PlayerData): players is GroupedPlayerMap {
  return !Array.isArray(players) && typeof players === 'object' && players !== null &&
    Object.values(players).some(v => typeof v === 'object' && v !== null)
}

/** 判断评委数据是否为扁平映射格式 */
export function isFlatJudgeMap(judges: JudgeData): judges is FlatJudgeMap {
  return typeof judges === 'object' && judges !== null &&
    Object.values(judges).every(v => typeof v === 'string')
}

/** 判断评委数据是否为分组映射格式 */
export function isGroupedJudgeMap(judges: JudgeData): judges is GroupedJudgeMap {
  return typeof judges === 'object' && judges !== null &&
    Object.values(judges).some(v => typeof v === 'object' && v !== null)
}

/**
 * 从 YAML 赛季数据中查找轮次配置
 * 支持直接键和逗号分隔的多轮次键（如 G1,G2,G3）
 */
export function findRoundConfig(
  seasonData: SeasonYearData,
  roundKey: string
): RoundConfig | null {
  // 直接查找
  if (seasonData.rounds[roundKey]) {
    return seasonData.rounds[roundKey]
  }

  // 在多轮次键中查找
  for (const [key, data] of Object.entries(seasonData.rounds)) {
    if (key.includes(',')) {
      const rounds = key.split(',').map(r => r.trim())
      if (rounds.includes(roundKey)) {
        return data
      }
    }
  }

  return null
}

/**
 * 从轮次配置中提取选手名称列表
 */
export function extractPlayerNames(roundConfig: RoundConfig): string[] {
  if (!roundConfig.players) return []

  if (isPlayerArray(roundConfig.players)) {
    return roundConfig.players.filter(Boolean)
  }

  if (isFlatPlayerMap(roundConfig.players)) {
    return Object.values(roundConfig.players)
  }

  if (isGroupedPlayerMap(roundConfig.players)) {
    const names: string[] = []
    for (const groupData of Object.values(roundConfig.players)) {
      if (typeof groupData === 'object' && groupData) {
        names.push(...Object.values(groupData).filter((v): v is string => typeof v === 'string'))
      }
    }
    return names
  }

  return []
}

/**
 * 从轮次配置中计算选手数量
 */
export function countPlayers(roundConfig: RoundConfig): number {
  if (!roundConfig.players) return 0

  if (isPlayerArray(roundConfig.players)) {
    return roundConfig.players.length
  }

  if (isFlatPlayerMap(roundConfig.players)) {
    return Object.keys(roundConfig.players).filter(key => !key.startsWith('~')).length
  }

  if (isGroupedPlayerMap(roundConfig.players)) {
    let count = 0
    for (const groupData of Object.values(roundConfig.players)) {
      if (typeof groupData === 'object' && groupData) {
        count += Object.keys(groupData).filter(key => !key.startsWith('~')).length
      }
    }
    return count
  }

  return 0
}

/**
 * 检查选手是否在轮次的选手列表中
 */
export function isPlayerInRound(roundConfig: RoundConfig, playerName: string): boolean {
  if (!roundConfig.players) return false

  if (isPlayerArray(roundConfig.players)) {
    return roundConfig.players.includes(playerName)
  }

  if (isFlatPlayerMap(roundConfig.players)) {
    return Object.values(roundConfig.players).includes(playerName)
  }

  if (isGroupedPlayerMap(roundConfig.players)) {
    for (const groupData of Object.values(roundConfig.players)) {
      if (typeof groupData === 'object' && groupData) {
        if (Object.values(groupData).includes(playerName)) {
          return true
        }
      }
    }
  }

  return false
}

/**
 * 从赛季数据中提取所有轮次键
 */
export function extractRoundKeys(roundsConfig: Record<string, RoundConfig>): string[] {
  const rounds: string[] = []

  for (const [key] of Object.entries(roundsConfig)) {
    if (key.includes(',')) {
      const roundList = key.split(',').map(r => r.trim())
      rounds.push(...roundList)
    } else {
      rounds.push(key)
    }
  }

  return [...new Set(rounds)]
}
