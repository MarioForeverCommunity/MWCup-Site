<template>
  <div class="page-header animate-fadeInUp">
    <h2 class="animate-textGlow">Mario Worker 杯历届冠军统计</h2>
    <p>从2013年到2025年的所有决赛冠军信息</p>
  </div>
  <div v-if="loading" class="loading-state animate-pulse">
    <div class="loading-spinner"></div>
    <div class="loading-text">正在加载数据<span class="loading-dots"></span></div>
  </div>

  <div v-else-if="error" class="error-state animate-pulse">
    {{ error }}
  </div>

  <div v-else class="content-panel animate-fadeInUp">
    <!-- 冠军列表 -->
    <div class="section-header">
      <h3>历届决赛排名</h3>
      <div class="table-wrapper">
        <table class="table-base champions-table">
          <thead>
            <tr>
              <th>年份</th>
              <th>冠军</th>
              <th>亚军</th>
              <th v-if="hasThirdPrize">季军</th>
              <th v-if="hasFourthPrize">第四名</th>
              <th>主办人</th>
              <th>总评委</th>
            </tr>
          </thead>
          <tbody>
            <tr 
              v-for="(champion) in champions" 
              :key="champion.year"
              class="champion-row"
            >
              <td class="year">{{ champion.year }}年第{{ getEditionNumber(champion.year) }}届</td>
              <td class="champion">{{ champion.first || '-' }}</td>
              <td class="second">{{ champion.second || '-' }}</td>
              <td v-if="hasThirdPrize" class="third">{{ champion.third || '-' }}</td>
              <td v-if="hasFourthPrize" class="fourth">{{ champion.fourth || '-' }}</td>
              <td class="host">{{ champion.host || '-' }}</td>
              <td class="judges">{{ champion.chiefJudges?.join('、') || '-' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { fetchMarioWorkerYaml, extractSeasonData } from '../utils/yamlLoader'
import { getEditionNumber } from '../utils/editionHelper'
import { loadRoundScoreData } from '../utils/scoreCalculator'

interface ChampionInfo {
  year: string
  first?: string
  second?: string
  third?: string
  fourth?: string
  host?: string
  chiefJudges?: string[]
}

const champions = ref<ChampionInfo[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

const hasThirdPrize = computed(() => champions.value.some(c => c.third))
const hasFourthPrize = computed(() => champions.value.some(c => c.fourth))
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
        
        const championInfo: ChampionInfo = {
          year,
          host: data.host,
          chiefJudges: Array.isArray(data.chief_judge) ? data.chief_judge : 
                       data.chief_judge ? [data.chief_judge] : undefined
        }
          try {
          // 尝试加载并使用决赛评分数据
          const scoreData = await loadRoundScoreData(year, 'F', yamlDoc)
          if (scoreData?.playerScores?.length > 0) {
            // 按平均分排序
            const sortedPlayers = [...scoreData.playerScores].sort(
              (a, b) => (b.averageScore ?? 0) - (a.averageScore ?? 0)
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
                            total: p.averageScore,
                            count: 1
                          }
                        }
                      })
                    }
                    
                    // 添加S2的分数
                    if (s2Data?.playerScores) {
                      s2Data.playerScores.forEach(p => {
                        if (p.averageScore !== undefined) {
                          if (playerScores[p.playerName]) {
                            playerScores[p.playerName].total += p.averageScore
                            playerScores[p.playerName].count += 1
                          } else {
                            playerScores[p.playerName] = {
                              total: p.averageScore,
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
                        averageScore: p.averageScore ?? 0
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
                      averageScore: p.averageScore ?? 0
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
                      averageScore: p.averageScore ?? 0
                    }))
                  }
                }
                
                if (semifinalPlayers.length > 0) {
                  // 获取所有决赛选手的名字（包括补充的未上传选手）
                  const finalistNames = [championInfo.first, championInfo.second].filter(Boolean) as string[]
                  
                  // 找出半决赛中未进入决赛的选手
                  const eliminatedPlayers = semifinalPlayers
                    .filter(p => !finalistNames.includes(p.playerName))
                    .sort((a, b) => b.averageScore - a.averageScore)
                  
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
              // 处理有S1、S2两轮的半决赛（2013、2016年）
              else if (['2013', '2016'].includes(year)) {
                try {
                  const s1Data = await loadRoundScoreData(year, 'S1', yamlDoc)
                  const s2Data = await loadRoundScoreData(year, 'S2', yamlDoc)
                  
                  const playerScores: { [key: string]: { total: number, count: number } } = {}
                  
                  if (s1Data?.playerScores) {
                    s1Data.playerScores.forEach(p => {
                      if (p.averageScore !== undefined) {
                        playerScores[p.playerName] = { 
                          total: p.averageScore,
                          count: 1
                        }
                      }
                    })
                  }
                  
                  if (s2Data?.playerScores) {
                    s2Data.playerScores.forEach(p => {
                      if (p.averageScore !== undefined) {
                        if (playerScores[p.playerName]) {
                          playerScores[p.playerName].total += p.averageScore
                          playerScores[p.playerName].count += 1
                        } else {
                          playerScores[p.playerName] = {
                            total: p.averageScore,
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
                      averageScore: p.averageScore ?? 0
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
                    averageScore: p.averageScore ?? 0
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
                    averageScore: p.averageScore ?? 0
                  }))
                }
              }
              
              if (semifinalPlayers.length > 0) {
                // 获取所有决赛选手的名字
                const finalistNames = [championInfo.first, championInfo.second].filter(Boolean) as string[]
                
                // 找出半决赛中未进入决赛的选手
                const eliminatedPlayers = semifinalPlayers
                  .filter(p => !finalistNames.includes(p.playerName))
                  .sort((a, b) => b.averageScore - a.averageScore)
                
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
    
    // 按年份降序排序
    championList.sort((a, b) => parseInt(b.year) - parseInt(a.year))
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
  width: 100%;
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
  font-size: 14px;
}

/* 表格行动画效果 */
.champion-row {
  transition: all 0.3s ease;
  cursor: pointer;
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

/* 渐变动画 */
@keyframes gradientMove {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
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
    font-size: 14px;
    min-width: 800px; /* 确保表格有足够宽度触发横向滚动 */
    table-layout: fixed; /* 防止单元格内容影响表格布局 */
  }
  
  .year {
    font-size: 13px;
  }
  
  .judges {
    font-size: 12px;
  }
}
</style>