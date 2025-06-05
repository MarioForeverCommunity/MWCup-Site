// 关卡文件与比赛数据匹配系统
import { getAllLevelFiles, type LevelFile } from './levelFileHelper'
import { fetchMarioWorkerYaml, extractSeasonData } from './yamlLoader'

// 比赛轮次信息
export interface RoundInfo {
  year: number
  roundKey: string
  roundName: string
  groupKey?: string
  groupName?: string
}

// 选手信息
export interface PlayerInfo {
  code: string
  name: string
  roundInfo: RoundInfo
}

// 关卡匹配结果
export interface LevelMatch {
  levelFile: LevelFile
  playerInfo: PlayerInfo
  confidence: 'exact' | 'partial' | 'fuzzy' // 匹配置信度
}

let mwcupDataCache: any = null

/**
 * 获取缓存的 MW 杯数据
 */
async function getMWCupData(): Promise<any> {
  if (!mwcupDataCache) {
    const doc = await fetchMarioWorkerYaml()
    mwcupDataCache = extractSeasonData(doc)
  }
  return mwcupDataCache
}

/**
 * 从 YAML 数据中提取所有选手信息
 */
export async function extractAllPlayers(): Promise<PlayerInfo[]> {
  const data = await getMWCupData()
  const players: PlayerInfo[] = []

  for (const [yearStr, yearData] of Object.entries(data)) {
    const year = parseInt(yearStr)
    if (!yearData || typeof yearData !== 'object' || !('rounds' in yearData)) continue

    const typedYearData = yearData as { rounds?: any }
    if (!typedYearData.rounds) continue

    for (const [roundKey, roundData] of Object.entries(typedYearData.rounds)) {
      if (!roundData || typeof roundData !== 'object' || !('players' in roundData)) continue

      const typedRoundData = roundData as { players?: any }
      if (!typedRoundData.players) continue

      const roundName = getRoundDisplayName(roundKey)
      
      // 处理不同的选手数据结构
      if (Array.isArray(typedRoundData.players)) {
        // P2 轮次格式：数组
        typedRoundData.players.forEach((playerName: string, index: number) => {
          if (typeof playerName === 'string') {
            players.push({
              code: (index + 1).toString(),
              name: playerName,
              roundInfo: { year, roundKey, roundName }
            })
          }
        })
      } else if (typeof typedRoundData.players === 'object' && typedRoundData.players) {
        // 其他轮次格式：对象
        for (const [groupKey, groupData] of Object.entries(typedRoundData.players)) {
          const groupName = getGroupDisplayName(groupKey)
          
          if (typeof groupData === 'string') {
            // 简单的 code: name 格式
            players.push({
              code: groupKey,
              name: groupData,
              roundInfo: { year, roundKey, roundName, groupKey, groupName }
            })
          } else if (typeof groupData === 'object' && groupData) {
            // 嵌套的分组格式
            for (const [playerCode, playerName] of Object.entries(groupData)) {
              if (typeof playerName === 'string') {
                players.push({
                  code: playerCode,
                  name: playerName,
                  roundInfo: { year, roundKey, roundName, groupKey, groupName }
                })
              }
            }
          }
        }
      }
    }
  }

  return players
}

/**
 * 根据年份、轮次、选手码查找选手信息
 */
export async function findPlayerInfo(
  year: number, 
  roundKey: string, 
  playerCode: string
): Promise<PlayerInfo | null> {
  const players = await extractAllPlayers()
  return players.find(p => 
    p.roundInfo.year === year && 
    p.roundInfo.roundKey === roundKey && 
    p.code.toUpperCase() === playerCode.toUpperCase()
  ) || null
}

/**
 * 根据选手码查找所有相关的选手信息（跨年份轮次）
 */
export async function findPlayersByCode(playerCode: string): Promise<PlayerInfo[]> {
  const players = await extractAllPlayers()
  return players.filter(p => 
    p.code.toUpperCase() === playerCode.toUpperCase()
  )
}

/**
 * 智能匹配关卡文件与选手信息
 */
export async function matchLevelFiles(): Promise<LevelMatch[]> {
  const [levelFiles, players] = await Promise.all([
    getAllLevelFiles(),
    extractAllPlayers()
  ])

  const matches: LevelMatch[] = []

  for (const levelFile of levelFiles) {
    if (!levelFile.playerCode) continue

    // 从文件路径中提取年份信息
    const yearMatch = levelFile.path.match(/(\d{4})年/)
    const year = yearMatch ? parseInt(yearMatch[1]) : null

    // 尝试从文件路径中提取轮次信息
    const roundInfo = extractRoundFromPath(levelFile.path)

    // 查找匹配的选手信息
    let bestMatch: PlayerInfo | null = null
    let confidence: 'exact' | 'partial' | 'fuzzy' = 'fuzzy'

    if (year && roundInfo) {      // 精确匹配：年份、轮次、选手码都匹配
      bestMatch = players.find(p => 
        p.roundInfo.year === year &&
        p.roundInfo.roundKey === roundInfo.roundKey &&
        levelFile.playerCode && p.code.toUpperCase() === levelFile.playerCode.toUpperCase()
      ) || null

      if (bestMatch) {
        confidence = 'exact'
      } else {        // 部分匹配：年份和选手码匹配，但轮次可能不同
        bestMatch = players.find(p => 
          p.roundInfo.year === year &&
          levelFile.playerCode && p.code.toUpperCase() === levelFile.playerCode.toUpperCase()
        ) || null

        if (bestMatch) {
          confidence = 'partial'
        }
      }
    }    if (!bestMatch) {
      // 模糊匹配：只根据选手码匹配
      bestMatch = players.find(p => 
        levelFile.playerCode && p.code.toUpperCase() === levelFile.playerCode.toUpperCase()
      ) || null
    }

    if (bestMatch) {
      matches.push({
        levelFile,
        playerInfo: bestMatch,
        confidence
      })
    }
  }

  return matches
}

/**
 * 根据选手信息查找对应的关卡文件
 */
export async function findLevelFileByPlayer(
  year: number,
  roundKey: string,
  playerCode: string
): Promise<LevelMatch[]> {
  const playerInfo = await findPlayerInfo(year, roundKey, playerCode)
  if (!playerInfo) return []

  const levelFiles = await getAllLevelFiles()
  const matches: LevelMatch[] = []

  for (const levelFile of levelFiles) {
    if (!levelFile.playerCode) continue

    // 检查选手码是否匹配
    if (levelFile.playerCode.toUpperCase() !== playerCode.toUpperCase()) continue

    // 从文件路径中提取年份
    const yearMatch = levelFile.path.match(/(\d{4})年/)
    const fileYear = yearMatch ? parseInt(yearMatch[1]) : null

    // 从文件路径中提取轮次信息
    const roundInfo = extractRoundFromPath(levelFile.path)

    let confidence: 'exact' | 'partial' | 'fuzzy' = 'fuzzy'

    if (fileYear === year && roundInfo && roundInfo.roundKey === roundKey) {
      confidence = 'exact'
    } else if (fileYear === year) {
      confidence = 'partial'
    }

    matches.push({
      levelFile,
      playerInfo,
      confidence
    })
  }

  return matches.sort((a, b) => {
    const confidenceOrder = { exact: 0, partial: 1, fuzzy: 2 }
    return confidenceOrder[a.confidence] - confidenceOrder[b.confidence]
  })
}

/**
 * 从文件路径中提取轮次信息
 */
function extractRoundFromPath(path: string): { roundKey: string, roundName: string } | null {
  // 匹配常见的轮次模式
  const patterns = [
    { pattern: /热身赛|练习赛|P1|P2/, key: 'P1', name: '热身赛' },
    { pattern: /初赛|I\d+/, key: 'I1', name: '初赛' },
    { pattern: /复赛|R\d*/, key: 'R', name: '复赛' },
    { pattern: /半决赛|S\d*/, key: 'S', name: '半决赛' },
    { pattern: /决赛|F/, key: 'F', name: '决赛' },
    { pattern: /分组赛|G\d+/, key: 'G1', name: '分组赛' },
    { pattern: /1\/4决赛|Q\d*/, key: 'Q', name: '1/4决赛' }
  ]

  for (const { pattern, key, name } of patterns) {
    if (pattern.test(path)) {
      return { roundKey: key, roundName: name }
    }
  }

  return null
}

/**
 * 获取轮次的显示名称
 */
function getRoundDisplayName(roundKey: string): string {
  const roundNames: Record<string, string> = {
    'P1': '第一次热身赛',
    'P2': '第二次热身赛',
    'I1': '初赛第一题', 'I2': '初赛第二题', 'I3': '初赛第三题', 'I4': '初赛第四题',
    'G1': '分组赛第一轮', 'G2': '分组赛第二轮', 'G3': '分组赛第三轮', 'G4': '分组赛第四轮',
    'Q': '1/4决赛', 'Q1': '1/4决赛第一轮', 'Q2': '1/4决赛第二轮',
    'R': '复赛', 'R1': '复赛第一轮', 'R2': '复赛第二轮', 'R3': '复赛第三轮',
    'S': '半决赛', 'S1': '半决赛第一轮', 'S2': '半决赛第二轮',
    'F': '决赛'
  }

  return roundNames[roundKey] || roundKey
}

/**
 * 获取分组的显示名称
 */
function getGroupDisplayName(groupKey: string): string {
  // 数字分组
  if (/^\d+$/.test(groupKey)) {
    return `第${groupKey}组`
  }
  
  // 字母分组
  if (/^[A-Z]$/i.test(groupKey)) {
    return `${groupKey.toUpperCase()}组`
  }
  
  // 特殊分组
  const specialGroups: Record<string, string> = {
    'I': '第一组', 'II': '第二组', 'III': '第三组',
    'a': 'a组', 'b': 'b组', 'c': 'c组', 'd': 'd组',
    'walk-in': '补签组'
  }
  
  return specialGroups[groupKey] || groupKey
}

/**
 * 清除缓存
 */
export function clearCache(): void {
  mwcupDataCache = null
}
