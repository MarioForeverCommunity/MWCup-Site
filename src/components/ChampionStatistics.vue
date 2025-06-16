<template>
  <div v-if="loading" class="loading-state animate-pulse">
    <div class="loading-spinner"></div>
    <div class="loading-text">正在加载数据<span class="loading-dots"></span></div>
  </div>

  <div v-else-if="error" class="error-state">
    {{ error }}
  </div>

  <div v-else class="content-panel">
    <!-- 冠军列表 -->
    <div class="section-header animate-fadeInUp">
      <h3>历届MW杯举办情况</h3>
      <div class="table-wrapper animate-fadeInUp">
        <table class="table-base champions-table">
          <thead>
            <tr>
              <th>届次</th>
              <th>主办人</th>
              <th>总评委1</th>
              <th>总评委2</th>
              <th>预赛开始</th>
              <th>预赛结束</th>
              <th>资格赛开始</th>
              <th>资格赛结束</th>
              <th>正赛开始</th>
              <th>正赛结束</th>
              <th>冠军</th>
              <th>亚军</th>
              <th>季军(2020~)/四强</th>
              <th>四强</th>
              <th>上传地址</th>
            </tr>
          </thead>
          <tbody>
            <tr 
              v-for="(champion) in champions" 
              :key="champion.year"
              class="champion-row"
            >
              <td class="year">{{ champion.year }}年第{{ getEditionNumber(champion.year) }}届</td>
              <td class="host">{{ champion.host || '-' }}</td>
              <td class="judges">{{ champion.chiefJudges?.[0] || '-' }}</td>
              <td class="judges">{{ champion.chiefJudges?.[1] || '-' }}</td>
              <td class="date">{{ champion.p1Start || '-' }}</td>
              <td class="date">{{ champion.p1End || '-' }}</td>
              <td class="date">{{ champion.p2Start || '-' }}</td>
              <td class="date">{{ champion.p2End || '-' }}</td>
              <td class="date">{{ champion.mainStart || '-' }}</td>
              <td class="date">{{ champion.mainEnd || '-' }}</td>
              <td class="champion">{{ champion.first || '-' }}</td>
              <td class="second">{{ champion.second || '-' }}</td>
              <td class="third">{{ champion.third || '-' }}</td>
              <td class="fourth">{{ champion.fourth || '-' }}</td>
              <td class="link">
                <a v-if="urlMap[champion.year]" 
                   :href="urlMap[champion.year]" 
                   target="_blank" 
                   class="url-btn hover-scale">
                  前往
                </a>
                <span v-else>-</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { fetchMarioWorkerYaml, extractSeasonData } from '../utils/yamlLoader'
import { getEditionNumber } from '../utils/editionHelper'

// 网盘/上传系统URL映射
const urlMap: Record<string, string> = {
  '2025': 'https://mwcup2025.marioforever.net',
  '2024': 'https://mwcup2024.marioforever.net',
  '2023': 'https://mwcup2023.marioforever.net',
  '2022': 'https://mwcup2022.marioforever.net',
  '2021': 'http://2021mwcup.yspean.com/',
  '2020': 'http://mwcup2020.yspean.com/',
  '2019': 'http://mwcup2019.yspean.com/',
  '2018': 'http://mwcup2018.yspean.com/',
  '2017': 'http://2017mwcup.yspean.com/',
  '2016': 'http://mwcup2016.yspean.com/',
  '2015': 'http://mwcup2015.yspean.com/',
  '2014': 'http://mwcup3--2014.yspean.com/',
  '2013': 'http://2013mwcup.yspean.com/',
  '2012': 'http://mwcup.yspean.com/'
}
import { loadRoundScoreData } from '../utils/scoreCalculator'
import { Decimal } from 'decimal.js'

interface ChampionInfo {
  year: string
  first?: string
  second?: string
  third?: string
  fourth?: string
  host?: string
  chiefJudges?: string[]
  p1Start?: string  // 预赛开始日期
  p1End?: string    // 预赛结束日期
  p2Start?: string  // 资格赛开始日期
  p2End?: string    // 资格赛结束日期
  mainStart?: string // 正赛开始日期
  mainEnd?: string   // 正赛结束日期
}

const champions = ref<ChampionInfo[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

// 日期格式化函数：将ISO日期转换为中文格式
function formatDate(isoDate: string): string {
  if (!isoDate) return ''
  const date = new Date(isoDate)
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  return `${year}年${month}月${day}日`
}

// 提取比赛各阶段日期
function extractDates(yearData: any, _year: string) {
  const dates = {
    p1Start: '',
    p1End: '',
    p2Start: '',
    p2End: '',
    mainStart: '',
    mainEnd: ''
  }
  
  if (!yearData.rounds) return dates
  
  // 预赛P1日期
  const p1Round = yearData.rounds.P1
  if (p1Round?.schedule) {
    // P1开始：match开始时间
    if (p1Round.schedule.match?.start) {
      dates.p1Start = formatDate(p1Round.schedule.match.start)
    }
    // P1结束：judging结束时间（如果没有judging.end，则使用judging.start）
    if (p1Round.schedule.judging?.end) {
      dates.p1End = formatDate(p1Round.schedule.judging.end)
    } else if (p1Round.schedule.judging?.start) {
      dates.p1End = formatDate(p1Round.schedule.judging.start)
    } else if (p1Round.schedule.post_match_checkin?.start) {
      dates.p1End = formatDate(p1Round.schedule.post_match_checkin.start)
    }
  }
  
  // 资格赛P2日期
  const p2Round = yearData.rounds.P2
  if (p2Round?.schedule) {
    // P2开始：match开始时间
    if (p2Round.schedule.match?.start) {
      dates.p2Start = formatDate(p2Round.schedule.match.start)
    }
    // P2结束：judging结束时间（如果没有judging.end，则使用judging.start）
    if (p2Round.schedule.judging?.end) {
      dates.p2End = formatDate(p2Round.schedule.judging.end)
    } else if (p2Round.schedule.judging?.start) {
      dates.p2End = formatDate(p2Round.schedule.judging.start)
    }
  }
  // 正赛开始：处理数组格式的G1/I1轮次
  let mainStartFound = false
  
  // 查找G1或I1轮次（可能是数组格式）
  const rounds = yearData.rounds
  for (const roundKey of Object.keys(rounds)) {
    const round = rounds[roundKey]
    
    // 检查是否是数组格式的轮次（如[G1, G2, G3, G4]或[I1, I2, I3]）
    if (Array.isArray(roundKey) || roundKey.includes('[') || (round && round.schedule)) {
      if (round.schedule?.topics) {
        if (round.schedule.topics.G1?.time) {
          dates.mainStart = formatDate(round.schedule.topics.G1.time)
          mainStartFound = true
          break
        } else if (round.schedule.topics.I1?.time) {
          dates.mainStart = formatDate(round.schedule.topics.I1.time)
          mainStartFound = true
          break
        }
      }
      // 其他年份：使用match.start
      else if (round.schedule) {
        if (round.schedule.G1?.match?.start) {
          dates.mainStart = formatDate(round.schedule.G1.match.start)
          mainStartFound = true
          break
        } else if (round.schedule.I1?.match?.start) {
          dates.mainStart = formatDate(round.schedule.I1.match.start)
          mainStartFound = true
          break
        }
      }
    }
  }
  
  // 如果没有找到G1或I1，查找其他可能的正赛开始轮次
  if (!mainStartFound) {
    for (const roundKey of Object.keys(rounds)) {
      const round = rounds[roundKey]
      if (roundKey.startsWith('G') || roundKey.startsWith('I')) {
        if (round?.schedule?.match?.start) {
          dates.mainStart = formatDate(round.schedule.match.start)
          break
        }
      }
    }
  }
  // 正赛结束：决赛F的judging结束时间
  const finalRound = yearData.rounds.F
  if (finalRound?.schedule?.judging?.end) {
    dates.mainEnd = formatDate(finalRound.schedule.judging.end)
  }
  
  return dates
}

async function loadChampions() {
  loading.value = true
  error.value = null
  
  try {
    const yamlDoc = await fetchMarioWorkerYaml()
    const seasonData = extractSeasonData(yamlDoc)
    const championList: ChampionInfo[] = []
    
    for (const [year, yearData] of Object.entries(seasonData)) {
      if (typeof yearData === 'object' && yearData !== null) {
        const data = yearData as any
        const dates = extractDates(data, year)
        
        const championInfo: ChampionInfo = {
          year,
          host: data.host,
          chiefJudges: Array.isArray(data.chief_judge) ? data.chief_judge : data.chief_judge ? [data.chief_judge] : undefined,
          p1Start: dates.p1Start,
          p1End: dates.p1End,
          p2Start: dates.p2Start,
          p2End: dates.p2End,
          mainStart: dates.mainStart,
          mainEnd: dates.mainEnd
        }
          try {
          // 尝试加载并使用决赛评分数据
          const scoreData = await loadRoundScoreData(year, 'F', yamlDoc)
          if (scoreData?.playerScores?.length > 0) {
            // 按平均分排序，兼容Decimal
            const sortedPlayers = [...scoreData.playerScores].sort(
              (a, b) => {
                const aScore = a.averageScore instanceof Decimal ? a.averageScore : new Decimal(a.averageScore ?? 0)
                const bScore = b.averageScore instanceof Decimal ? b.averageScore : new Decimal(b.averageScore ?? 0)
                return bScore.comparedTo(aScore)
              }
            )
            // 分配名次
            championInfo.first = sortedPlayers[0].playerName
            if (sortedPlayers.length > 1) championInfo.second = sortedPlayers[1].playerName
            
            // 处理第三、第四名
            if (parseInt(year) <= 2019) {
              // 2019年及之前：决赛只有2人，第三、第四名来自半决赛被淘汰的选手
              
              // 首先检查YAML中是否有未上传的决赛选手信息
              const finalRound = data.rounds?.F
              if (finalRound?.players) {
                const allFinalists: string[] = []
                
                // 收集所有从YAML获取的决赛选手
                if (finalRound.players.M) allFinalists.push(finalRound.players.M)
                if (finalRound.players.W) allFinalists.push(finalRound.players.W)
                if (finalRound.players.S) allFinalists.push(finalRound.players.S)
                if (finalRound.players.P) allFinalists.push(finalRound.players.P)
                
                // 找出在YAML中存在但在评分数据中不存在的选手（未上传作品的选手）
                const scoredFinalists = sortedPlayers.map(p => p.playerName)
                const missingFinalists = allFinalists.filter(name => !scoredFinalists.includes(name))
                
                // 如果有缺失的决赛选手，补充到排名中
                if (missingFinalists.length > 0) {
                  if (!championInfo.second && missingFinalists[0]) {
                    championInfo.second = missingFinalists[0]
                  }
                }
              }
              
              // 然后再从半决赛获取第三、第四名
              try {
                let semifinalPlayers: { playerName: string, averageScore: number }[] = []
                
                // 处理特殊情况：2015年半决赛使用YAML中的scores
                if (year === '2015') {
                  const semifinalRound = data.rounds?.S
                  if (semifinalRound?.scores) {
                    // 从YAML的scores字段获取分数
                    semifinalPlayers = Object.entries(semifinalRound.scores).map(([playerCode, score]) => {
                      // 从players中找到对应的选手名字
                      const playerName = semifinalRound.players?.I?.[playerCode] || 
                                       semifinalRound.players?.II?.[playerCode] || 
                                       playerCode
                      return { playerName, averageScore: Number(score) }
                    })
                  }
                }
                // 处理有S1、S2两轮的半决赛（2013、2016年）
                else if (['2013', '2016'].includes(year)) {
                  try {
                    const s1Data = await loadRoundScoreData(year, 'S1', yamlDoc)
                    const s2Data = await loadRoundScoreData(year, 'S2', yamlDoc)
                    
                    // 合并两轮的分数
                    const playerScores: { [key: string]: { total: number, count: number } } = {}
                    
                    // 添加S1的分数
                    if (s1Data?.playerScores) {
                      s1Data.playerScores.forEach(p => {
                        if (p.averageScore !== undefined) {
                          playerScores[p.playerName] = {
                            total: Number(p.averageScore),
                            count: 1
                          }
                        }
                      })
                    }
                    
                    // 添加S2的分数
                    if (s2Data?.playerScores) {
                      s2Data.playerScores.forEach(p => {
                        if (p.averageScore !== undefined) {
                          // S1/S2合并分数
                          if (playerScores[p.playerName]) {
                            playerScores[p.playerName].total = Number(playerScores[p.playerName].total) + Number(p.averageScore)
                            playerScores[p.playerName].count += 1
                          } else {
                            playerScores[p.playerName] = {
                              total: Number(p.averageScore),
                              count: 1
                            }
                          }
                        }
                      })
                    }
                    
                    // 计算平均分并创建选手列表
                    semifinalPlayers = Object.entries(playerScores).map(([playerName, data]) => ({
                      playerName,
                      averageScore: data.total // 合计得分而非平均分
                    }))
                  } catch (err) {
                    console.warn(`${year} 年S1/S2数据加载失败，尝试加载S数据:`, err)
                    // 如果S1/S2失败，尝试加载S
                    const semifinalData = await loadRoundScoreData(year, 'S', yamlDoc)
                    if (semifinalData?.playerScores) {
                      semifinalPlayers = semifinalData.playerScores.map(p => ({
                        playerName: p.playerName,
                        averageScore: typeof p.averageScore === 'object' && 'toNumber' in p.averageScore ? p.averageScore.toNumber() : Number(p.averageScore)
                      }))
                    }
                  }
                }
                // 特殊处理2014年半决赛选手未上传的情况
                else if (year === '2014') {
                  const semifinalData = await loadRoundScoreData(year, 'S', yamlDoc)
                  
                  // 获取所有应该参加半决赛的选手
                  const semiRound = data.rounds?.S
                  const allSemiPlayers: string[] = []
                  
                  if (semiRound?.players) {
                    // 从YAML中获取所有半决赛选手
                    if (semiRound.players.I) {
                      Object.values(semiRound.players.I).forEach(name => allSemiPlayers.push(name as string))
                    }
                    if (semiRound.players.II) {
                      Object.values(semiRound.players.II).forEach(name => allSemiPlayers.push(name as string))
                    }
                  }
                  
                  // 合并评分数据和YAML数据
                  if (semifinalData?.playerScores) {
                    semifinalPlayers = semifinalData.playerScores.map(p => ({
                      playerName: p.playerName,
                      averageScore: Number(p.averageScore)
                    }))
                    
                    // 查找在YAML中有但评分数据中没有的选手（未上传）
                    const scoredPlayers = semifinalPlayers.map(p => p.playerName)
                    const missingPlayers = allSemiPlayers.filter(name => !scoredPlayers.includes(name))
                    
                    // 将未上传的选手添加到列表，但分数为0
                    missingPlayers.forEach(name => {
                      semifinalPlayers.push({ playerName: name, averageScore: 0 })
                    })
                  }
                }
                // 其他年份的正常半决赛
                else {
                  const semifinalData = await loadRoundScoreData(year, 'S', yamlDoc)
                  if (semifinalData?.playerScores) {
                    semifinalPlayers = semifinalData.playerScores.map(p => ({
                      playerName: p.playerName,
                      averageScore: Number(p.averageScore)
                    }))
                  }
                }
                
                if (semifinalPlayers.length > 0) {
                  // 获取所有决赛选手的名字（包括补充的未上传选手）
                  const finalistNames = [championInfo.first, championInfo.second].filter(Boolean) as string[]
                  
                  // 找出半决赛中未进入决赛的选手
                  const eliminatedPlayers = semifinalPlayers
                    .filter(p => !finalistNames.includes(p.playerName))
                    .sort((a, b) => Number(b.averageScore) - Number(a.averageScore))
                  
                  if (eliminatedPlayers.length > 0) championInfo.third = eliminatedPlayers[0].playerName
                  if (eliminatedPlayers.length > 1) championInfo.fourth = eliminatedPlayers[1].playerName
                }
              } catch (err) {
                console.warn(`${year} 年半决赛数据加载失败，无法确定第三、第四名:`, err)
              }
            } else {
              // 2020年之后：决赛理论上有4人，但可能有缺失的情况
              if (sortedPlayers.length > 2) championInfo.third = sortedPlayers[2].playerName
              if (sortedPlayers.length > 3) championInfo.fourth = sortedPlayers[3].playerName
              
              // 如果决赛少于4人，尝试从YAML中获取缺失的选手信息
              if (sortedPlayers.length < 4) {
                const finalRound = data.rounds?.F
                if (finalRound?.players) {
                  // 检查YAML中是否有第四名选手信息但在评分数据中缺失
                  if (finalRound.players.P && !championInfo.fourth) {
                    championInfo.fourth = finalRound.players.P
                  }
                }
              }
            }
            
            championList.push(championInfo)
            continue
          }
          throw new Error('评分数据不完整')
        } catch (err) {
          console.warn(`${year} 年决赛评分数据加载失败:`, err)
          
          // 使用 yaml 中的记录作为备选
          const finalRound = data.rounds?.F
          if (!finalRound?.players) {
            console.warn(`${year} 年决赛选手记录不存在，跳过`)
            continue
          }
          
          // 确定冠亚军
          if (finalRound.players.S) {
            championInfo.first = finalRound.players.S
            championInfo.second = finalRound.players.M || finalRound.players.W
          } else if (finalRound.players.M) {
            championInfo.first = finalRound.players.M
            championInfo.second = finalRound.players.W
          }
          
          if (parseInt(year) >= 2020) {
            // 2020年及之后的比赛额外记录季军和第四名
            if (!championInfo.second && finalRound.players.W) {
              championInfo.third = finalRound.players.W
            }
            if (finalRound.players.P) {
              championInfo.fourth = finalRound.players.P
            }
          } else {
            // 2019年及之前，尝试从半决赛数据获取第三、第四名
            try {
              let semifinalPlayers: { playerName: string, averageScore: number }[] = []
              
              // 处理特殊情况：2015年半决赛使用YAML中的scores
              if (year === '2015') {
                const semifinalRound = data.rounds?.S
                if (semifinalRound?.scores) {
                  semifinalPlayers = Object.entries(semifinalRound.scores).map(([playerCode, score]) => {
                    const playerName = semifinalRound.players?.I?.[playerCode] || 
                                     semifinalRound.players?.II?.[playerCode] || 
                                     playerCode
                    return { playerName, averageScore: Number(score) }
                  })
                }
              }
              // 处理有S1、S2两轮的半决赛（2013、2016）
              else if (['2013', '2016'].includes(year)) {
                try {
                  const s1Data = await loadRoundScoreData(year, 'S1', yamlDoc)
                  const s2Data = await loadRoundScoreData(year, 'S2', yamlDoc)
                  
                  const playerScores: { [key: string]: { total: number, count: number } } = {}
                  
                  if (s1Data?.playerScores) {
                    s1Data.playerScores.forEach(p => {
                      if (p.averageScore !== undefined) {
                        playerScores[p.playerName] = {
                          total: Number(p.averageScore),
                          count: 1
                        }
                      }
                    })
                  }
                  
                  if (s2Data?.playerScores) {
                    s2Data.playerScores.forEach(p => {
                      if (p.averageScore !== undefined) {
                        // S1/S2合并分数
                        if (playerScores[p.playerName]) {
                          playerScores[p.playerName].total = Number(playerScores[p.playerName].total) + Number(p.averageScore)
                          playerScores[p.playerName].count += 1
                        } else {
                          playerScores[p.playerName] = {
                            total: Number(p.averageScore),
                            count: 1
                          }
                        }
                      }
                    })
                  }
                  
                  semifinalPlayers = Object.entries(playerScores).map(([playerName, data]) => ({
                    playerName,
                    averageScore: data.total // 合计分数
                  }))
                } catch (err) {
                  console.warn(`${year} 年S1/S2数据加载失败，尝试加载S数据:`, err)
                  // 如果S1/S2失败，尝试加载S
                  const semifinalData = await loadRoundScoreData(year, 'S', yamlDoc)
                  if (semifinalData?.playerScores) {
                    semifinalPlayers = semifinalData.playerScores.map(p => ({
                      playerName: p.playerName,
                      averageScore: typeof p.averageScore === 'object' && 'toNumber' in p.averageScore ? p.averageScore.toNumber() : Number(p.averageScore)
                    }))
                  }
                }
              }
              // 特殊处理2014年半决赛选手未上传的情况
              else if (year === '2014') {
                const semifinalData = await loadRoundScoreData(year, 'S', yamlDoc)
                
                // 获取所有应该参加半决赛的选手
                const semiRound = data.rounds?.S
                const allSemiPlayers: string[] = []
                
                if (semiRound?.players) {
                  // 从YAML中获取所有半决赛选手
                  if (semiRound.players.I) {
                    Object.values(semiRound.players.I).forEach(name => allSemiPlayers.push(name as string))
                  }
                  if (semiRound.players.II) {
                    Object.values(semiRound.players.II).forEach(name => allSemiPlayers.push(name as string))
                  }
                }
                
                // 合并评分数据和YAML数据
                if (semifinalData?.playerScores) {
                  semifinalPlayers = semifinalData.playerScores.map(p => ({
                    playerName: p.playerName,
                    averageScore: Number(p.averageScore)
                  }))
                  
                  // 查找在YAML中有但评分数据中没有的选手（未上传）
                  const scoredPlayers = semifinalPlayers.map(p => p.playerName)
                  const missingPlayers = allSemiPlayers.filter(name => !scoredPlayers.includes(name))
                  
                  // 将未上传的选手添加到列表，但分数为0
                  missingPlayers.forEach(name => {
                    semifinalPlayers.push({ playerName: name, averageScore: 0 })
                  })
                }
              }
              // 其他年份的正常半决赛
              else {
                const semifinalData = await loadRoundScoreData(year, 'S', yamlDoc)
                if (semifinalData?.playerScores) {
                  semifinalPlayers = semifinalData.playerScores.map(p => ({
                    playerName: p.playerName,
                    averageScore: Number(p.averageScore)
                  }))
                }
              }
              
              if (semifinalPlayers.length > 0) {
                // 获取所有决赛选手的名字
                const finalistNames = [championInfo.first, championInfo.second].filter(Boolean) as string[]
                
                // 找出半决赛中未进入决赛的选手
                const eliminatedPlayers = semifinalPlayers
                  .filter(p => !finalistNames.includes(p.playerName))
                  .sort((a, b) => Number(b.averageScore) - Number(a.averageScore))
                
                if (eliminatedPlayers.length > 0) championInfo.third = eliminatedPlayers[0].playerName
                if (eliminatedPlayers.length > 1) championInfo.fourth = eliminatedPlayers[1].playerName
              }
            } catch (err) {
              console.warn(`${year} 年半决赛数据加载失败，无法确定第三、第四名:`, err)
            }
          }
          
          championList.push(championInfo)
        }
      }
    }
    
    championList.sort((a, b) => parseInt(a.year) - parseInt(b.year))
    champions.value = championList
    
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载失败'
    console.error('加载冠军数据失败:', err)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadChampions()
})
</script>

<style scoped>
/* 组件特定样式 - 使用新的CSS类系统 */
.champions-table {
  white-space: nowrap;
}

.year {
  color: var(--text-primary);
}

.champion {
  color: #e67e22; /* 冠军：橙色 */
}

.second {
  color: #3498db; /* 亚军：蓝色 */
}

.third {
  color: #9b59b6; /* 季军：紫色 */
}

.fourth {
  color: #6cc1c7; /* 第四名：灰蓝色 */
}

.host {
  color: #27ae60;
}

.judges {
  color: #e63fbc;
}

.date {
  color: #4a90e2;
  white-space: nowrap;
}

/* 表格行动画效果 */
.champion-row {
  transition: all 0.3s ease;
}

.champion-row:hover {
  background-color: rgba(255, 99, 71, 0.05);
}

/* 年份列特殊样式 */
.year {
  background: linear-gradient(135deg, var(--primary-color), #ff8a65);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  font-weight: 700;
}

.url-btn {
  padding: 4px 8px;
  background: linear-gradient(135deg, var(--primary-hover), var(--primary-color));
  color: white;
  border: none;
  border-radius: var(--radius-medium);
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: var(--transition-normal);
  min-width: 50px;
  white-space: nowrap;
}

.url-btn:hover {
  background: linear-gradient(135deg, var(--primary-active), var(--primary-dark));
  transform: translateY(-1px);
  box-shadow: var(--shadow-button);
}

@media (min-width: 768px) {
  .table-wrapper {
    display: flex;
    justify-content: center;
    width: 100%;
  }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .champions-table {
    font-size: 12px;
    white-space: nowrap;
  }
}
</style>